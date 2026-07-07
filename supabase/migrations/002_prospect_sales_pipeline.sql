-- ============================================================
-- Salevo — Prospect sales pipeline stage taxonomy
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Collapses the old, HVAC-era "Lead" job-board stages and the
-- half-finished Prospect stages into one real sales pipeline:
--   New -> Contacted -> Replied -> Meeting Set -> Proposal
--        -> Closed Won / Closed Lost
--
-- Safe to re-run: uses IF EXISTS / IF NOT EXISTS everywhere.
-- ============================================================

-- Defensive: make sure columns the app already relies on exist
-- (value + last_outreach_at were added out-of-band after 001_initial_schema.sql).
alter table prospects add column if not exists value numeric(10,2) not null default 0;
alter table prospects add column if not exists last_outreach_at timestamptz;
alter table prospects add column if not exists updated_at timestamptz;

-- Drop the old stage constraint (matches either the original 001 migration's
-- values or whatever was later applied out-of-band via the dashboard).
alter table prospects drop constraint if exists prospects_stage_check;

-- Backfill existing rows into the new taxonomy before adding the new constraint.
-- Covers both historical vocabularies this table has used
-- (001_initial_schema.sql's New/Contacted/Meeting Set/Proposal/Active, and the
-- later out-of-band New/Researched/Contacted/Responded/Meeting Set/Closed).
update prospects set stage = 'New'        where stage in ('Researched');
update prospects set stage = 'Replied'    where stage in ('Responded');
update prospects set stage = 'Proposal'   where stage in ('Active');
update prospects set stage = 'Closed Won' where stage in ('Closed');
-- Anything already sitting in a Closed state is treated as a won deal by
-- default since there's no way to distinguish won/lost retroactively.
-- Reclassify manually in the app if any of these were actually lost deals.

-- New constraint matching lib/supabase.ts ProspectStage
alter table prospects add constraint prospects_stage_check
  check (stage in ('New','Contacted','Replied','Meeting Set','Proposal','Closed Won','Closed Lost'));

alter table prospects alter column stage set default 'New';
