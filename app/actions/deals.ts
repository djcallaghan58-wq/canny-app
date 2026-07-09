'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import type { Deal, DealStage, LossReason } from '@/types/deals'

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getDeals(businessId: string): Promise<Deal[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('deals')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    return (data as Deal[]) ?? []
  } catch {
    return []
  }
}

// ─── Create — the new "Add to Pipeline" ───────────────────────────────────────
// Only ever called from the manual "Mark Replied" action in Outreach. Never
// mutates the prospect's stage - the prospect keeps whatever stage it had
// (usually 'Contacted'). We flip prospects.status to 'pipeline' instead,
// purely as an "already has a deal, stop showing in Outreach" signal -
// app/actions/reports.ts already reads this exact status value.
// No optimistic UI: caller only updates local state from the row this
// returns, never before the insert is confirmed.

export async function promoteProspectToDeal(
  prospectId: string,
  businessId: string,
): Promise<{ success: boolean; deal?: Deal; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    const { data: owner } = await supabase
      .from('businesses').select('owner_id').eq('id', businessId).single()
    if (!owner) return { success: false, error: 'Owner not found for business' }

    const { data: prospect, error: fetchErr } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .eq('business_id', businessId)
      .maybeSingle()

    if (fetchErr) return { success: false, error: `Prospect fetch: ${fetchErr.message}` }
    if (!prospect) return { success: false, error: 'Prospect not found' }

    const { data: deal, error: insertErr } = await supabase
      .from('deals')
      .insert({
        business_id:    businessId,
        owner_id:       owner.owner_id,
        prospect_id:    prospectId,
        company_name:   prospect.company_name,
        contact_name:   prospect.contact_name || null,
        contact_email:  prospect.email || null,
        contact_phone:  prospect.phone || null,
        value:          prospect.value || null,
        stage:          'Replied',
        source:         'salevo_ai',
      })
      .select()
      .single()

    if (insertErr) {
      // Partial unique index on prospect_id (from migration 003) means a
      // double-click race lands here instead of creating a duplicate deal -
      // fetch and return the existing one so this action is idempotent.
      if (insertErr.code === '23505') {
        const { data: existing } = await supabase
          .from('deals').select('*').eq('prospect_id', prospectId).maybeSingle()
        if (existing) {
          return { success: true, deal: existing as Deal }
        }
      }
      console.error('[promoteProspectToDeal] insert error:', {
        code: insertErr.code, message: insertErr.message, details: insertErr.details,
      })
      return { success: false, error: `${insertErr.code ?? 'ERR'}: ${insertErr.message}` }
    }

    // Informational only - never the source of truth for pipeline stage.
    await supabase
      .from('prospects')
      .update({ status: 'pipeline', updated_at: new Date().toISOString() })
      .eq('id', prospectId)
      .eq('business_id', businessId)

    await supabase.from('timeline_events').insert({
      deal_id: deal.id, business_id: businessId, type: 'deal_created',
      payload: { source: 'prospect_replied', prospect_id: prospectId },
    })

    // Seed stage_settings defaults for this business on first deal, ignored
    // thereafter (unique on business_id+stage). Rotting thresholds are a
    // starting point - Phase 2 exposes these as user-editable.
    await supabase.from('stage_settings').upsert(
      [
        { business_id: businessId, stage: 'Replied',     rotting_days: 3, auto_followup_days: 2 },
        { business_id: businessId, stage: 'Meeting Set', rotting_days: 3, auto_followup_days: null },
        { business_id: businessId, stage: 'Proposal',    rotting_days: 4, auto_followup_days: 3 },
      ],
      { onConflict: 'business_id,stage', ignoreDuplicates: true },
    )

    revalidatePath('/dashboard/prospects')
    revalidatePath('/dashboard/pipeline')
    return { success: true, deal: deal as Deal }
  } catch (e) {
    console.error('[promoteProspectToDeal] unexpected error:', e)
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Stage / value / lost updates ──────────────────────────────────────────────
// Phase 1 keeps these deliberately minimal (write + timeline log only).
// Auto-follow-up activity creation and won/lost gating are Phase 2.

export async function updateDealStage(
  id: string,
  businessId: string,
  stage: DealStage,
): Promise<{ success: boolean; deal?: Deal; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    const { data: current } = await supabase
      .from('deals').select('stage').eq('id', id).eq('business_id', businessId).maybeSingle()
    if (!current) return { success: false, error: 'Deal not found' }

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { stage, last_activity_at: now, updated_at: now }
    if (stage === 'Closed Won') patch.won_at = now
    if (stage === 'Closed Lost') patch.lost_at = now

    const { data: deal, error } = await supabase
      .from('deals').update(patch).eq('id', id).eq('business_id', businessId).select().single()
    if (error) return { success: false, error: error.message }

    await supabase.from('timeline_events').insert({
      deal_id: id, business_id: businessId, type: 'stage_change',
      payload: { from: current.stage, to: stage },
    })

    revalidatePath('/dashboard/pipeline')
    return { success: true, deal: deal as Deal }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function markDealLost(
  id: string,
  businessId: string,
  lossReason?: LossReason,
): Promise<{ success: boolean; deal?: Deal; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    const now = new Date().toISOString()
    const { data: deal, error } = await supabase
      .from('deals')
      .update({ stage: 'Closed Lost', lost_at: now, loss_reason: lossReason ?? null, last_activity_at: now, updated_at: now })
      .eq('id', id).eq('business_id', businessId)
      .select().single()
    if (error) return { success: false, error: error.message }

    await supabase.from('timeline_events').insert({
      deal_id: id, business_id: businessId, type: 'deal_lost',
      payload: { loss_reason: lossReason ?? null },
    })

    revalidatePath('/dashboard/pipeline')
    return { success: true, deal: deal as Deal }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function updateDeal(
  id: string,
  businessId: string,
  updates: Partial<Pick<Deal, 'value' | 'contact_name' | 'contact_email' | 'contact_phone' | 'title' | 'expected_close'>>,
): Promise<{ success: boolean; deal?: Deal; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    const { data: deal, error } = await supabase
      .from('deals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).eq('business_id', businessId)
      .select().single()
    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard/pipeline')
    return { success: true, deal: deal as Deal }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Bumps last_activity_at without changing anything else - used when an
// email gets opened/sent for a deal, so deal_health's "rotting" calc reflects
// real activity. Logs email_opened_in_gmail as a lightweight timeline event.
export async function touchDeal(id: string, businessId: string): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) return { success: false }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false }

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('deals').update({ last_activity_at: now, updated_at: now }).eq('id', id).eq('business_id', businessId)
    if (error) return { success: false }

    await supabase.from('timeline_events').insert({
      deal_id: id, business_id: businessId, type: 'email_opened_in_gmail', payload: {},
    })
    return { success: true }
  } catch {
    return { success: false }
  }
}
