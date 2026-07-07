'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import type { Prospect, ProspectStage, ProspectStatus, ProspectSearch, LeadStage } from '@/lib/supabase'

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
    if (!biz) {
      console.error('[saveProspectFromSearch] resolveBusinessForUser returned null for userId:', userId)
      return { success: false, error: 'Business not found for this user' }
    }
    if (biz.id !== input.business_id) {
      console.error('[saveProspectFromSearch] business_id mismatch:', { resolved: biz.id, provided: input.business_id })
      return { success: false, error: `Business ID mismatch (resolved: ${biz.id}, provided: ${input.business_id})` }
    }

    // Dedup check
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
        stage:    'New',
        status:   'new',
        enriched: true,
        source:   input.source ?? 'ai_search',
      })
      .select()
      .single()

    if (error) {
      console.error('[saveProspectFromSearch] insert error:', {
        code: error.code, message: error.message, details: error.details,
      })
      return { success: false, error: `${error.code ?? 'ERR'}: ${error.message}` }
    }
    revalidatePath('/dashboard/prospects')
    return { success: true, prospect: data as Prospect }
  } catch (e) {
    console.error('[saveProspectFromSearch] unexpected error:', e)
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Move to leads pipeline ───────────────────────────────────────────────────

export async function getProspectById(prospectId: string): Promise<Prospect | null> {
  const { userId } = await auth()
  if (!userId) return null
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('prospects').select('*').eq('id', prospectId).maybeSingle()
    return (data as Prospect) ?? null
  } catch {
    return null
  }
}

export async function moveToLeadsPipeline(
  prospectId: string,
  businessId: string,
  options?: { stage?: LeadStage },
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()

    // Fetch the prospect row
    const { data: prospect, error: fetchErr } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .eq('business_id', businessId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[moveToLeadsPipeline] prospect fetch error:', fetchErr)
      return { success: false, error: `Prospect fetch: ${fetchErr.message}` }
    }
    if (!prospect) {
      console.error('[moveToLeadsPipeline] prospect not found', { prospectId, businessId })
      return { success: false, error: 'Prospect not found' }
    }

    // Build insert payload — log it before sending
    const insertPayload: Record<string, unknown> = {
      business_id:    businessId,
      customer_name:  prospect.contact_name || prospect.company_name,
      customer_email: prospect.email ?? '',
      customer_phone: prospect.phone ?? '',
      service_type:   prospect.company_overview ? prospect.company_overview.slice(0, 80) : '',
      urgency:        'Medium',
      stage:          options?.stage ?? 'New Lead',
      source:         'prospecting',
      prospect_id:    prospectId,
      value:          prospect.value ?? 0,
      notes: [
        prospect.pain_points ? `Pain points: ${prospect.pain_points}` : '',
        prospect.pitch_angle ? `Pitch: ${prospect.pitch_angle}` : '',
        prospect.notes       ? prospect.notes : '',
      ].filter(Boolean).join('\n\n'),
    }

    console.log('[moveToLeadsPipeline] inserting lead:', {
      businessId,
      prospectId,
      customer_name: insertPayload.customer_name,
      stage: insertPayload.stage,
      source: insertPayload.source,
    })

    let { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert(insertPayload)
      .select('id')
      .single()

    // If new columns don't exist yet, retry dropping them gracefully
    if (leadError?.code === '42703') {
      const missing = leadError.message?.match(/"(\w+)"/) ?.[1] ?? ''
      console.warn(`[moveToLeadsPipeline] column "${missing}" missing — retrying without it`)
      const stripped = { ...insertPayload }
      delete stripped.source
      delete stripped.prospect_id
      const retry = await supabase.from('leads').insert(stripped).select('id').single()
      lead      = retry.data
      leadError = retry.error
    }

    if (leadError) {
      console.error('[moveToLeadsPipeline] lead insert error:', {
        code:    leadError.code,
        message: leadError.message,
        details: leadError.details,
        hint:    leadError.hint,
      })
      return { success: false, error: `${leadError.code ?? 'ERR'}: ${leadError.message}` }
    }

    // Update prospect status
    await supabase
      .from('prospects')
      .update({ status: 'pipeline', stage: 'Contacted', updated_at: new Date().toISOString() })
      .eq('id', prospectId)

    revalidatePath('/dashboard/prospects')
    revalidatePath('/dashboard/pipeline')
    console.log('[moveToLeadsPipeline] success, leadId:', lead!.id)
    return { success: true, leadId: lead!.id }
  } catch (e) {
    console.error('[moveToLeadsPipeline] unexpected error:', e)
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

// ─── Auto-contacted tracking ──────────────────────────────────────────────────
// Call this whenever an outreach email is actually opened/sent for a prospect
// (not on a separate manual "mark contacted" click - that step gets skipped
// and status drifts). Advances New -> Contacted automatically, and always
// bumps last_outreach_at so follow-up scheduling and staleness badges stay
// accurate. Never downgrades a prospect that's already moved further along
// (Replied, Meeting Set, Proposal, Closed Won/Lost) back to Contacted.

export async function markProspectOutreachSent(
  id: string,
  businessId: string,
): Promise<{ success: boolean; stage?: ProspectStage; lastOutreachAt?: string; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    const { data: current } = await supabase
      .from('prospects')
      .select('stage')
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle()

    const nextStage: ProspectStage = current?.stage === 'New' ? 'Contacted' : (current?.stage as ProspectStage) ?? 'Contacted'
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('prospects')
      .update({ stage: nextStage, last_outreach_at: now, updated_at: now })
      .eq('id', id)
      .eq('business_id', businessId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/prospects')
    return { success: true, stage: nextStage, lastOutreachAt: now }
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
