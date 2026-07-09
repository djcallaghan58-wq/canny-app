-- ============================================================
-- SALEVO MIGRATION 001: Deal Management Foundation (CORRECTED)
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS throughout).
--
-- Corrections vs. the drafted version:
--   1. Tenant key changed from owner_id (text, Clerk user id) to
--      business_id (uuid, FK -> businesses.id). Every existing table
--      (prospects, leads, writing_styles) scopes by business_id, not
--      owner_id directly - owner_id only exists on the businesses row
--      itself. Kept owner_id as a denormalized column for fast filtering
--      without a join, but business_id is the real FK and RLS anchor.
--   2. RLS predicate changed from auth.uid()::text = owner_id to the
--      auth.jwt() ->> 'sub' pattern already used by prospects/leads.
--      auth.uid() is a Supabase Auth uuid and will never match a Clerk
--      user id - that policy as originally written would silently pass
--      zero rows under anon/authenticated roles (harmless today since
--      all writes go through the service-role client, but wrong and
--      worth fixing before it's load-bearing).
--   3. prospect_id given a real FK to prospects(id) (uuid, confirmed
--      column) with on delete set null, instead of a bare unreferenced uuid.
--   4. Section 9 backfill corrected: prospects has no in_pipeline flag.
--      Pipeline membership today is purely stage-derived - see
--      PIPELINE_STAGES in app/components/prospects-view.tsx. Backfill
--      below uses that same condition.
--   5. Stage vocabulary mismatch flagged, NOT silently resolved: prospects
--      just shipped a 7-value ProspectStage taxonomy (New, Contacted,
--      Replied, Meeting Set, Proposal, Closed Won, Closed Lost). This
--      migration's deals.stage is a 6-value taxonomy (new_lead, contacted,
--      in_conversation, quote_sent, won, lost) that collapses Replied +
--      Meeting Set into one bucket. The backfill below maps Meeting Set
--      into in_conversation. If you want Meeting Set to stay distinct,
--      say so before running this - it's a one-line change to the stage
--      check constraint and the backfill CASE, but it's a real product
--      decision, not a default I should pick for you.
-- ============================================================

-- ------------------------------------------------------------
-- 1. DEALS — first-class opportunity object
-- ------------------------------------------------------------
create table if not exists deals (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  owner_id          text not null,                 -- denormalized Clerk user id, for filter convenience only
  prospect_id       uuid references prospects(id) on delete set null,
  company_name      text not null,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  title             text not null default 'New opportunity',
  value             numeric(12,2),
  stage             text not null default 'new_lead'
                      check (stage in ('new_lead','contacted','in_conversation','quote_sent','won','lost')),
  expected_close    date,
  loss_reason       text
                      check (loss_reason is null or loss_reason in
                        ('price','competitor','timing','no_response','not_a_fit','other')),
  loss_notes        text,
  won_at            timestamptz,
  lost_at           timestamptz,
  source            text not null default 'salevo_ai'
                      check (source in ('salevo_ai','manual','import')),
  last_activity_at  timestamptz not null default now(),
  next_activity_at  timestamptz,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists deals_business_stage_idx on deals (business_id, stage);
create index if not exists deals_next_activity_idx on deals (business_id, next_activity_at);

-- ------------------------------------------------------------
-- 2. ACTIVITIES — the "next action" engine
-- ------------------------------------------------------------
create table if not exists activities (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references deals(id) on delete cascade,
  business_id   uuid not null references businesses(id) on delete cascade,
  type          text not null default 'task'
                  check (type in ('call','email','task','meeting')),
  title         text not null,
  due_at        timestamptz not null,
  completed_at  timestamptz,
  notes         text,
  created_by    text not null default 'user'
                  check (created_by in ('user','salevo')),
  draft_email_id uuid,
  created_at    timestamptz not null default now()
);

create index if not exists activities_deal_idx on activities (deal_id);
create index if not exists activities_business_due_idx on activities (business_id, due_at)
  where completed_at is null;

-- ------------------------------------------------------------
-- 3. TIMELINE EVENTS — unified history per deal
-- ------------------------------------------------------------
create table if not exists timeline_events (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid references deals(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  type        text not null
                check (type in ('deal_created','stage_change','activity_completed',
                                'email_drafted','email_opened_in_gmail','note',
                                'outcome_marked','deal_won','deal_lost')),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists timeline_deal_idx on timeline_events (deal_id, created_at desc);

-- ------------------------------------------------------------
-- 4. STAGE SETTINGS — per-stage rotting thresholds + auto-follow-up rules
-- ------------------------------------------------------------
create table if not exists stage_settings (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references businesses(id) on delete cascade,
  stage                 text not null,
  rotting_days          integer not null default 5,
  auto_followup_days    integer,
  unique (business_id, stage)
);

-- Seed sensible defaults (call from app on first deal creation, upsert on conflict do nothing):
-- insert into stage_settings (business_id, stage, rotting_days, auto_followup_days) values
--   ('BUSINESS_ID', 'new_lead',        3, 1),
--   ('BUSINESS_ID', 'contacted',       4, 3),
--   ('BUSINESS_ID', 'in_conversation', 5, 3),
--   ('BUSINESS_ID', 'quote_sent',      3, 2)
-- on conflict (business_id, stage) do nothing;

-- ------------------------------------------------------------
-- 5. EMAIL OUTCOMES — learning loop signal
-- ------------------------------------------------------------
create table if not exists email_outcomes (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  deal_id           uuid references deals(id) on delete set null,
  writing_style_id  uuid references writing_styles(id) on delete set null,
  email_subject     text,
  email_body        text,
  email_type        text not null default 'outreach'
                      check (email_type in ('outreach','followup','rescue','quote_followup')),
  outcome           text
                      check (outcome is null or outcome in ('replied','no_reply','bounced','meeting_booked')),
  outcome_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists email_outcomes_business_idx on email_outcomes (business_id, outcome);

-- ------------------------------------------------------------
-- 6. HEALTH VIEW — powers the daily briefing and rotting UI
-- ------------------------------------------------------------
create or replace view deal_health
  with (security_invoker = true) as
select
  d.*,
  coalesce(s.rotting_days, 5) as rotting_days,
  case
    when d.stage in ('won','lost')                        then 'closed'
    when d.next_activity_at is null                       then 'no_next_step'
    when d.next_activity_at < now()                       then 'overdue'
    when d.last_activity_at < now()
         - (coalesce(s.rotting_days,5) || ' days')::interval then 'rotting'
    else 'healthy'
  end as health
from deals d
left join stage_settings s
  on s.business_id = d.business_id and s.stage = d.stage;

-- ------------------------------------------------------------
-- 7. updated_at trigger
-- ------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists deals_updated_at on deals;
create trigger deals_updated_at
  before update on deals
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 8. RLS — matches the auth.jwt() ->> 'sub' pattern used by
--    businesses/leads/prospects. Service-role client bypasses this in
--    server actions; kept on as defense-in-depth per CLAUDE.md rule 3.
-- ------------------------------------------------------------
alter table deals            enable row level security;
alter table activities       enable row level security;
alter table timeline_events  enable row level security;
alter table stage_settings   enable row level security;
alter table email_outcomes   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['deals','activities','timeline_events','stage_settings','email_outcomes']
  loop
    execute format('drop policy if exists %I_owner_all on %I', t, t);
    execute format(
      'create policy %I_owner_all on %I for all
         using (business_id in (select id from businesses where owner_id = (auth.jwt() ->> ''sub'')))
         with check (business_id in (select id from businesses where owner_id = (auth.jwt() ->> ''sub'')))', t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 9. BACKFILL — promote existing pipeline-stage prospects into deals.
--    Run once, after confirming the stage-vocabulary mapping above.
--    Uses PIPELINE_STAGES (Replied/Meeting Set/Proposal/Closed Won/
--    Closed Lost) as the pipeline-membership condition, since that's
--    the real (only) signal today - there is no in_pipeline column.
-- ------------------------------------------------------------
-- insert into deals (business_id, prospect_id, company_name, contact_name,
--                     contact_email, value, stage, won_at, lost_at, source, created_at)
-- select
--   p.business_id,
--   p.id,
--   p.company_name,
--   p.contact_name,
--   p.email,
--   p.value,
--   case p.stage
--     when 'Replied'      then 'in_conversation'
--     when 'Meeting Set'  then 'in_conversation'   -- see note above if this should be distinct
--     when 'Proposal'     then 'quote_sent'
--     when 'Closed Won'   then 'won'
--     when 'Closed Lost'  then 'lost'
--   end,
--   case when p.stage = 'Closed Won'  then p.updated_at end,
--   case when p.stage = 'Closed Lost' then p.updated_at end,
--   'salevo_ai',
--   p.created_at
-- from prospects p
-- where p.stage in ('Replied','Meeting Set','Proposal','Closed Won','Closed Lost')
-- on conflict do nothing;
