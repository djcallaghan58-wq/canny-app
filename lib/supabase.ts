import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Types ────────────────────────────────────────────────────────────────────

export type TradeType =
  | 'HVAC'
  | 'Plumbing'
  | 'Electrical'
  | 'Roofing'
  | 'General Contractor'
  | 'Other'

export type LeadStage =
  | 'New Lead'
  | 'Quoted'
  | 'Following Up'
  | 'Booked'
  | 'Scheduled'
  | 'Complete'

export type ProspectStage = 'New' | 'Researched' | 'Contacted' | 'Responded' | 'Meeting Set' | 'Closed'

export interface CatalogItem {
  name: string
  price: number
  unit: 'per hour' | 'per job' | 'per unit' | 'per item'
}

export interface Business {
  id: string
  name: string
  trade_type: TradeType
  industry: string | null
  ideal_customer: string | null
  main_service: string | null
  city: string
  phone: string
  owner_id: string
  created_at: string
  org_id: string | null
  writing_style: WritingStyle | null
  business_description: string | null
  // New onboarding fields
  service_area: string
  catalog: CatalogItem[] | null
  target_customer_type: string
  customer_types: string[] | null
  ideal_customer_description: string | null
  onboarding_complete: boolean
}

export interface WritingStyle {
  tone: string
  sentence_length: string
  greeting_style: string
  phrases: string[]
  signature: string
  summary: string
}

export interface Lead {
  id: string
  business_id: string
  customer_name: string
  customer_phone: string
  customer_email: string
  service_type: string
  urgency: 'Low' | 'Medium' | 'High' | 'Emergency'
  stage: LeadStage
  value: number
  notes: string
  created_at: string
  last_contacted_at: string | null
}

export type ProspectStatus = 'new' | 'contacted' | 'pipeline' | 'dismissed'

export interface Prospect {
  id: string
  business_id: string
  company_name: string
  contact_name: string
  contact_title: string
  email: string
  phone: string
  website: string
  location: string
  company_overview: string
  email_format: string
  pain_points: string
  pitch_angle: string
  talking_points: string   // JSON-encoded string[]
  enriched: boolean
  notes: string
  stage: ProspectStage
  status: ProspectStatus
  search_query: string
  source: string
  dismiss_reason: string
  last_outreach_at: string | null
  value: number
  created_at: string
  updated_at: string | null
}

export interface ProspectSearch {
  id: string
  business_id: string
  query: string
  results_count: number
  created_at: string
}

// ─── Accent colors per trade type ────────────────────────────────────────────

export const TRADE_ACCENT: Record<TradeType, string> = {
  HVAC: '#059669',
  Plumbing: '#0891B2',
  Electrical: '#F59E0B',
  Roofing: '#7C3AED',
  'General Contractor': '#059669',
  Other: '#059669',
}

export function getAccent(trade: TradeType | undefined): string {
  return trade ? TRADE_ACCENT[trade] : '#059669'
}

export function getGlow(trade: TradeType | undefined): string {
  const hex = getAccent(trade)
  // Map accent to rgba glow
  const glows: Record<string, string> = {
    '#059669': 'rgba(5,150,105,0.15)',
    '#0891B2': 'rgba(8,145,178,0.15)',
    '#F59E0B': 'rgba(245,158,11,0.15)',
    '#7C3AED': 'rgba(124,58,237,0.15)',
  }
  return glows[hex] ?? 'rgba(5,150,105,0.15)'
}
