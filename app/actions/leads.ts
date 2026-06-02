'use server'

import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import type { Lead, LeadStage } from '@/lib/supabase'

// ─── Briefing ─────────────────────────────────────────────────────────────────

export interface BriefingData {
  leadsToday: number
  quotesPending: number
  followUpsDue: number
  bookedThisWeek: number
  urgentLeads: Lead[]
  attentionLeads: Lead[]
}

export async function getBriefingData(businessId: string): Promise<BriefingData> {
  const empty: BriefingData = { leadsToday: 0, quotesPending: 0, followUpsDue: 0, bookedThisWeek: 0, urgentLeads: [], attentionLeads: [] }
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (error || !data) return empty

    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000
    const dayAgo = now - DAY
    const threeDaysAgo = now - 3 * DAY
    const weekStart = (() => {
      const d = new Date()
      d.setDate(d.getDate() - d.getDay())
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })()

    const lastTouch = (l: Lead) =>
      l.last_contacted_at ? new Date(l.last_contacted_at).getTime() : new Date(l.created_at).getTime()

    const active = data.filter(l => l.stage !== 'Complete')

    return {
      leadsToday:     data.filter(l => new Date(l.created_at).getTime() >= dayAgo).length,
      quotesPending:  data.filter(l => l.stage === 'Quoted').length,
      followUpsDue:   active.filter(l => lastTouch(l) < threeDaysAgo).length,
      bookedThisWeek: data.filter(l =>
        (l.stage === 'Booked' || l.stage === 'Scheduled') &&
        new Date(l.created_at).getTime() >= weekStart
      ).length,
      urgentLeads:    active.filter(l => lastTouch(l) < dayAgo).slice(0, 8) as Lead[],
      attentionLeads: data.filter(l => l.stage === 'Quoted' && lastTouch(l) < threeDaysAgo).slice(0, 8) as Lead[],
    }
  } catch {
    return empty
  }
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function getLeads(businessId: string): Promise<Lead[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    return (data as Lead[]) ?? []
  } catch {
    return []
  }
}

export async function updateLeadStage(
  leadId: string,
  stage: LeadStage,
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) return { success: false }

  try {
    const supabase = createAdminClient()

    const biz = await resolveBusinessForUser(userId)
    if (!biz) return { success: false }

    const { error } = await supabase
      .from('leads')
      .update({ stage })
      .eq('id', leadId)
      .eq('business_id', biz.id)

    return { success: !error }
  } catch {
    return { success: false }
  }
}

export async function createLead(input: {
  business_id: string
  customer_name: string
  customer_phone: string
  customer_email: string
  service_type: string
  urgency: string
  value: number
  notes: string
}): Promise<{ success: boolean; lead?: Lead; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()

    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== input.business_id) return { success: false, error: 'Business not found' }

    const { data, error } = await supabase
      .from('leads')
      .insert({ ...input, stage: 'New Lead' })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, lead: data as Lead }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
