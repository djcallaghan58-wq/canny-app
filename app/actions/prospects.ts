'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import type { Prospect, ProspectStage, ProspectStatus, ProspectSearch } from '@/lib/supabase'

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getProspects(businessId: string): Promise<Prospect[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('prospects')
      .select('*')
      .eq('business_id', businessId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false })
    return (data as Prospect[]) ?? []
  } catch {
    return []
  }
}

// ─── Search memory ────────────────────────────────────────────────────────────

export async function checkRecentSearch(
  businessId: string,
  query: string,
): Promise<{ found: boolean; search?: ProspectSearch; prospects?: Prospect[] }> {
  try {
    const supabase = createAdminClient()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: search } = await supabase
      .from('prospect_searches')
      .select('*')
      .eq('business_id', businessId)
      .eq('query', query.trim())
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!search) return { found: false }

    const { data: prospects } = await supabase
      .from('prospects')
      .select('*')
      .eq('business_id', businessId)
      .eq('search_query', query.trim())
      .order('created_at', { ascending: false })

    return { found: true, search: search as ProspectSearch, prospects: (prospects as Prospect[]) ?? [] }
  } catch {
    return { found: false }
  }
}

export async function saveSearch(
  businessId: string,
  query: string,
  resultsCount: number,
): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('prospect_searches').insert({
      business_id: businessId,
      query: query.trim(),
      results_count: resultsCount,
    })
  } catch { /* non-critical */ }
}

// ─── Save from AI search (with dedup) ─────────────────────────────────────────

export async function saveProspectFromSearch(input: {
  business_id: string
  company_name: string
  contact_name?: string
  contact_title?: string
  email?: string
  phone?: string
  website?: string
  location?: string
  company_overview?: string
  email_format?: string
  pain_points?: string
  pitch_angle?: string
  talking_points?: string
  search_query?: string
  source?: string
}): Promise<{ success: boolean; prospect?: Prospect; duplicate?: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()

    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== input.business_id) return { success: false, error: 'Business not found' }

    // Dedup check: same company_name + business_id
    const { data: existing } = await supabase
      .from('prospects')
      .select('id, company_name, status')
      .eq('business_id', input.business_id)
      .ilike('company_name', input.company_name.trim())
      .maybeSingle()

    if (existing) {
      return { success: true, duplicate: true, prospect: existing as Prospect }
    }

    const { data, error } = await supabase
      .from('prospects')
      .insert({
        ...input,
        company_name: input.company_name.trim(),
        stage: 'Researched',
        status: 'new',
        enriched: true,
        source: input.source ?? 'ai_search',
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/prospects')
    return { success: true, prospect: data as Prospect }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Move to leads pipeline ───────────────────────────────────────────────────

export async function moveToLeadsPipeline(
  prospectId: string,
  businessId: string,
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()

    const { data: prospect } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .eq('business_id', businessId)
      .maybeSingle()

    if (!prospect) return { success: false, error: 'Prospect not found' }

    // Create lead record
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        business_id: businessId,
        customer_name: prospect.contact_name || prospect.company_name,
        customer_email: prospect.email ?? '',
        customer_phone: prospect.phone ?? '',
        service_type: prospect.company_overview ? prospect.company_overview.slice(0, 80) : '',
        urgency: 'Medium',
        stage: 'New Lead',
        value: prospect.value ?? 0,
        notes: [
          prospect.pain_points  ? `Pain points: ${prospect.pain_points}` : '',
          prospect.pitch_angle  ? `Pitch: ${prospect.pitch_angle}` : '',
          prospect.notes        ? prospect.notes : '',
        ].filter(Boolean).join('\n\n'),
      })
      .select('id')
      .single()

    if (leadError) return { success: false, error: leadError.message }

    // Update prospect status
    await supabase
      .from('prospects')
      .update({ status: 'pipeline', stage: 'Contacted', updated_at: new Date().toISOString() })
      .eq('id', prospectId)

    revalidatePath('/dashboard/prospects')
    revalidatePath('/dashboard/pipeline')
    return { success: true, leadId: lead.id }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Dismiss ──────────────────────────────────────────────────────────────────

export async function dismissProspect(
  id: string,
  reason?: string,
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) return { success: false }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz) return { success: false }
    await supabase.from('prospects').update({
      status: 'dismissed',
      dismiss_reason: reason ?? '',
      updated_at: new Date().toISOString(),
    }).eq('id', id).eq('business_id', biz.id)
    revalidatePath('/dashboard/prospects')
    return { success: true }
  } catch {
    return { success: false }
  }
}

// ─── Existing CRUD (unchanged) ────────────────────────────────────────────────

export async function createProspect(input: {
  business_id: string
  company_name: string
  contact_name?: string
  contact_title?: string
  email?: string
  phone?: string
  company_overview?: string
  email_format?: string
  pain_points?: string
  pitch_angle?: string
  talking_points?: string
  enriched?: boolean
  notes?: string
  stage?: ProspectStage
}): Promise<{ success: boolean; prospect?: Prospect; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== input.business_id) return { success: false, error: 'Business not found' }
    const { data, error } = await supabase.from('prospects').insert({ stage: 'New', status: 'new', ...input }).select().single()
    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/prospects')
    return { success: true, prospect: data as Prospect }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function updateProspectStage(id: string, stage: ProspectStage): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) return { success: false }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz) return { success: false }
    const { error } = await supabase.from('prospects').update({ stage, updated_at: new Date().toISOString() }).eq('id', id).eq('business_id', biz.id)
    return { success: !error }
  } catch {
    return { success: false }
  }
}

export async function updateProspect(
  id: string,
  updates: Partial<Pick<Prospect, 'notes' | 'stage' | 'status' | 'pain_points' | 'pitch_angle' | 'talking_points' | 'company_overview' | 'email_format' | 'contact_name' | 'contact_title' | 'enriched' | 'last_outreach_at' | 'value'>>,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz) return { success: false, error: 'Business not found' }
    const { error } = await supabase.from('prospects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('business_id', biz.id)
    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/prospects')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function importProspects(
  businessId: string,
  rows: { company_name: string; contact_name: string; contact_title: string; email: string; phone: string; notes: string }[],
): Promise<{ success: boolean; count: number; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, count: 0, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, count: 0, error: 'Business not found' }
    const inserts = rows.map(r => ({ ...r, business_id: businessId, stage: 'New' as ProspectStage, status: 'new' as ProspectStatus }))
    const { data, error } = await supabase.from('prospects').insert(inserts).select()
    if (error) return { success: false, count: 0, error: error.message }
    revalidatePath('/dashboard/prospects')
    return { success: true, count: data?.length ?? 0 }
  } catch (e) {
    return { success: false, count: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
