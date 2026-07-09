// Types mirroring supabase/migrations 001_deal_management_CORRECTED.sql +
// 003_deal_stage_alignment_and_backfill.sql. Deal.stage reuses the exact
// ProspectStage vocabulary (lib/supabase.ts) on purpose - no translation
// layer between prospects and deals. See chat history for reasoning.

import type { ProspectStage } from '@/lib/supabase'

export type DealStage = ProspectStage

export type DealHealth = 'healthy' | 'no_next_step' | 'overdue' | 'rotting' | 'closed'

export type LossReason =
  | 'price' | 'competitor' | 'timing' | 'no_response' | 'not_a_fit' | 'other'

export interface Deal {
  id:               string
  business_id:      string
  owner_id:         string
  prospect_id:      string | null
  company_name:     string
  contact_name:     string | null
  contact_email:    string | null
  contact_phone:    string | null
  title:            string
  value:            number | null
  stage:            DealStage
  expected_close:   string | null
  loss_reason:      LossReason | null
  loss_notes:       string | null
  won_at:           string | null
  lost_at:          string | null
  source:           'salevo_ai' | 'manual' | 'import'
  last_activity_at: string
  next_activity_at: string | null
  position:         number
  created_at:       string
  updated_at:       string
}

// deal_health view = deals.* + rotting_days + health
export interface DealWithHealth extends Deal {
  rotting_days: number
  health:       DealHealth
}

export interface Activity {
  id:             string
  deal_id:        string
  business_id:    string
  type:           'call' | 'email' | 'task' | 'meeting'
  title:          string
  due_at:         string
  completed_at:   string | null
  notes:          string | null
  created_by:     'user' | 'salevo'
  draft_email_id: string | null
  created_at:     string
}

export type TimelineEventType =
  | 'deal_created' | 'stage_change' | 'activity_completed'
  | 'email_drafted' | 'email_opened_in_gmail' | 'note'
  | 'outcome_marked' | 'deal_won' | 'deal_lost'

export interface TimelineEvent {
  id:          string
  deal_id:     string | null
  business_id: string
  type:        TimelineEventType
  payload:     Record<string, unknown>
  created_at:  string
}

export interface StageSetting {
  id:                 string
  business_id:        string
  stage:              string
  rotting_days:       number
  auto_followup_days: number | null
}

export type EmailOutcomeType = 'outreach' | 'followup' | 'rescue' | 'quote_followup'
export type EmailOutcomeResult = 'replied' | 'no_reply' | 'bounced' | 'meeting_booked'

export interface EmailOutcome {
  id:               string
  business_id:      string
  deal_id:          string | null
  writing_style_id: string | null
  email_subject:    string | null
  email_body:       string | null
  email_type:       EmailOutcomeType
  outcome:          EmailOutcomeResult | null
  outcome_at:       string | null
  created_at:       string
}
