-- ============================================================
-- TradeCommand — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already enabled on Supabase by default)
create extension if not exists "uuid-ossp";

-- ─── businesses ──────────────────────────────────────────────────────────────
create table if not exists businesses (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  trade_type  text not null check (trade_type in ('HVAC','Plumbing','Electrical','Roofing','General Contractor','Other')),
  city        text not null,
  phone       text not null,
  owner_id    text not null,          -- Clerk user ID (e.g. user_2abc...)
  created_at  timestamptz not null default now()
);

create unique index if not exists businesses_owner_id_idx on businesses (owner_id);

-- ─── leads ───────────────────────────────────────────────────────────────────
create table if not exists leads (
  id                  uuid primary key default uuid_generate_v4(),
  business_id         uuid not null references businesses (id) on delete cascade,
  customer_name       text not null,
  customer_phone      text not null default '',
  customer_email      text not null default '',
  service_type        text not null default '',
  urgency             text not null default 'Medium' check (urgency in ('Low','Medium','High','Emergency')),
  stage               text not null default 'New Lead' check (stage in ('New Lead','Quoted','Following Up','Booked','Scheduled','Complete')),
  value               numeric(10,2) not null default 0,
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  last_contacted_at   timestamptz
);

create index if not exists leads_business_id_idx on leads (business_id);
create index if not exists leads_stage_idx       on leads (stage);

-- ─── prospects ───────────────────────────────────────────────────────────────
create table if not exists prospects (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references businesses (id) on delete cascade,
  company_name    text not null,
  contact_name    text not null default '',
  contact_title   text not null default '',
  email           text not null default '',
  notes           text not null default '',
  stage           text not null default 'New' check (stage in ('New','Contacted','Meeting Set','Proposal','Active')),
  created_at      timestamptz not null default now()
);

create index if not exists prospects_business_id_idx on prospects (business_id);

-- ============================================================
-- Row-Level Security
-- Clerk passes the user ID as a JWT claim. We read it via
-- auth.jwt() -> 'sub'. All rows are scoped to the owner.
-- ============================================================

alter table businesses enable row level security;
alter table leads       enable row level security;
alter table prospects   enable row level security;

-- businesses: owner can read/write their own row
create policy "businesses: owner full access"
  on businesses for all
  using  (owner_id = (auth.jwt() ->> 'sub'))
  with check (owner_id = (auth.jwt() ->> 'sub'));

-- leads: owner sees leads for their business
create policy "leads: owner full access"
  on leads for all
  using  (business_id in (select id from businesses where owner_id = (auth.jwt() ->> 'sub')))
  with check (business_id in (select id from businesses where owner_id = (auth.jwt() ->> 'sub')));

-- prospects: owner sees prospects for their business
create policy "prospects: owner full access"
  on prospects for all
  using  (business_id in (select id from businesses where owner_id = (auth.jwt() ->> 'sub')))
  with check (business_id in (select id from businesses where owner_id = (auth.jwt() ->> 'sub')));
