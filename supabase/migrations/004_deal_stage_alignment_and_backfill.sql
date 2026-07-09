-- ============================================================
-- SALEVO MIGRATION 003: Align deal stage taxonomy + backfill
-- Run in Supabase SQL Editor, after 001_deal_management_CORRECTED.sql.
-- Safe to re-run.
--
-- What this does:
--   1. Replaces deals.stage's 6-value taxonomy (new_lead/contacted/
--      in_conversation/quote_sent/won/lost) with the 7-value ProspectStage
--      taxonomy already live in the Outreach/Pipeline UI (New/Contacted/
--      Replied/Meeting Set/Proposal/Closed Won/Closed Lost). Meeting Set
--      stays its own stage - not collapsed into a generic "in conversation"
--      bucket. See chat for full reasoning.
--   2. Updates deal_health to match the new stage values.
--   3. Adds a partial unique index on prospect_id so the backfill's
--      "on conflict do nothing" actually has something to key off -
--      without it, re-running the backfill would duplicate every deal.
--   4. Backfills existing Replied+ prospects into deals now (not deferred),
--      so the board isn't empty the moment Phase 1 switches reads over to
--      the deals table.
-- ============================================================

-- 1. Stage taxonomy alignment
alter table deals drop constraint if exists deals_stage_check;
alter table deals add constraint deals_stage_check
  check (stage in ('New','Contacted','Replied','Meeting Set','Proposal','Closed Won','Closed Lost'));
alter table deals alter column stage set default 'Replied';

-- 2. Health view, updated for the new stage values
create or replace view deal_health
  with (security_invoker = true) as
select
  d.*,
  coalesce(s.rotting_days, 5) as rotting_days,
  case
    when d.stage in ('Closed Won','Closed Lost')          then 'closed'
    when d.next_activity_at is null                       then 'no_next_step'
    when d.next_activity_at < now()                       then 'overdue'
    when d.last_activity_at < now()
         - (coalesce(s.rotting_days,5) || ' days')::interval then 'rotting'
    else 'healthy'
  end as health
from deals d
left join stage_settings s
  on s.business_id = d.business_id and s.stage = d.stage;

-- 3. Make the backfill actually idempotent
create unique index if not exists deals_prospect_id_unique
  on deals (prospect_id) where prospect_id is not null;

-- 4. Backfill — direct passthrough now that vocab matches 1:1
insert into deals (
  business_id, prospect_id, company_name, contact_name, contact_email,
  contact_phone, value, stage, won_at, lost_at, source, created_at, owner_id
)
select
  p.business_id,
  p.id,
  p.company_name,
  p.contact_name,
  p.email,
  p.phone,
  p.value,
  p.stage,
  case when p.stage = 'Closed Won'  then p.updated_at end,
  case when p.stage = 'Closed Lost' then p.updated_at end,
  'salevo_ai',
  p.created_at,
  b.owner_id
from prospects p
join businesses b on b.id = p.business_id
where p.stage in ('Replied','Meeting Set','Proposal','Closed Won','Closed Lost')
on conflict (prospect_id) where prospect_id is not null do nothing;
