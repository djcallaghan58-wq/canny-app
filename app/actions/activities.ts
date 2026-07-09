'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import type { Prospect } from '@/lib/supabase'
import type { DealStage, DealWithHealth } from '@/types/deals'

// The Daily Briefing ("Today") - the one screen meant to clear a day's worth
// of follow-up work without visiting the Pipeline board. See
// app/components/briefing-view.tsx. Deliberately does NOT pre-draft emails
// in the background (no nightly cron): every draft here is generated
// on-demand through the same /api/prospect/draft-email path the rest of the
// app already uses, so there's no silent AI spend and no email content
// nobody asked for yet - see chat history for why this was cut from the
// original spec's Phase 3.

export interface BriefingActivity {
  id:           string
  dealId:       string
  companyName:  string
  contactName:  string | null
  contactEmail: string | null
  stage:        DealStage
  value:        number | null
  prospectId:   string | null
  title:        string
  dueAt:        string
}

export interface BriefingData {
  overdue:       BriefingActivity[]
  dueToday:      BriefingActivity[]
  rescue:        DealWithHealth[]
  newProspects:  Prospect[]
  summary:       string
}

interface ActivityRow {
  id: string
  title: string
  due_at: string
  deal: {
    id: string
    company_name: string
    contact_name: string | null
    contact_email: string | null
    stage: DealStage
    value: number | null
    prospect_id: string | null
  } | null
}

export async function getBriefingData(businessId: string): Promise<BriefingData> {
  const empty: BriefingData = { overdue: [], dueToday: [], rescue: [], newProspects: [], summary: 'Nothing due today.' }
  try {
    const supabase = createAdminClient()
    const now = new Date()
    const startOfToday    = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)

    const [activitiesRes, rescueRes, newProspectsRes] = await Promise.all([
      supabase
        .from('activities')
        .select('id, title, due_at, deal:deals(id, company_name, contact_name, contact_email, stage, value, prospect_id)')
        .eq('business_id', businessId)
        .is('completed_at', null)
        .order('due_at', { ascending: true }),
      supabase
        .from('deal_health')
        .select('*')
        .eq('business_id', businessId)
        .in('health', ['rotting', 'no_next_step'])
        .order('last_activity_at', { ascending: true })
        .limit(15),
      supabase
        .from('prospects')
        .select('*')
        .eq('business_id', businessId)
        .eq('stage', 'New')
        .not('status', 'in', '(pipeline,dismissed)')
        .order('created_at', { ascending: true })
        .limit(10),
    ])

    const rows = ((activitiesRes.data as unknown as ActivityRow[]) ?? []).filter(r => r.deal)
    const toItem = (r: ActivityRow): BriefingActivity => ({
      id: r.id, dealId: r.deal!.id, companyName: r.deal!.company_name,
      contactName: r.deal!.contact_name, contactEmail: r.deal!.contact_email,
      stage: r.deal!.stage, value: r.deal!.value, prospectId: r.deal!.prospect_id,
      title: r.title, dueAt: r.due_at,
    })

    const overdue  = rows.filter(r => new Date(r.due_at) < startOfToday).map(toItem)
    const dueToday = rows.filter(r => {
      const d = new Date(r.due_at)
      return d >= startOfToday && d < startOfTomorrow
    }).map(toItem)

    const rescue       = (rescueRes.data as DealWithHealth[]) ?? []
    const newProspects = (newProspectsRes.data as Prospect[]) ?? []
    const goingCold     = rescue.filter(d => d.health === 'rotting').length

    const parts = [
      overdue.length + dueToday.length > 0 ? `${overdue.length + dueToday.length} follow-up${overdue.length + dueToday.length === 1 ? '' : 's'} due` : null,
      goingCold > 0 ? `${goingCold} deal${goingCold === 1 ? '' : 's'} going cold` : null,
      newProspects.length > 0 ? `${newProspects.length} new prospect${newProspects.length === 1 ? '' : 's'} to reach out to` : null,
    ].filter(Boolean)

    return {
      overdue, dueToday, rescue, newProspects,
      summary: parts.length ? parts.join(' · ') : 'All clear - nothing needs you right now.',
    }
  } catch (e) {
    console.error('[getBriefingData] error:', e)
    return empty
  }
}

// Recomputes a deal's next_activity_at from whatever's still open after this
// completion/snooze, so deal_health keeps reflecting reality.
async function recomputeNextActivity(
  supabase: ReturnType<typeof createAdminClient>, dealId: string,
): Promise<void> {
  const { data: openOnes } = await supabase
    .from('activities')
    .select('due_at')
    .eq('deal_id', dealId)
    .is('completed_at', null)
    .order('due_at', { ascending: true })
    .limit(1)

  await supabase
    .from('deals')
    .update({ next_activity_at: openOnes?.[0]?.due_at ?? null, last_activity_at: new Date().toISOString() })
    .eq('id', dealId)
}

export async function completeActivity(
  activityId: string, businessId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    const { data: activity } = await supabase
      .from('activities').select('deal_id').eq('id', activityId).eq('business_id', businessId).maybeSingle()
    if (!activity) return { success: false, error: 'Activity not found' }

    const { error } = await supabase
      .from('activities').update({ completed_at: new Date().toISOString() }).eq('id', activityId)
    if (error) return { success: false, error: error.message }

    await recomputeNextActivity(supabase, activity.deal_id)
    await supabase.from('timeline_events').insert({
      deal_id: activity.deal_id, business_id: businessId, type: 'activity_completed', payload: { activity_id: activityId },
    })

    revalidatePath('/dashboard/today')
    revalidatePath('/dashboard/pipeline')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function snoozeActivity(
  activityId: string, businessId: string, days: number = 3,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    const { data: activity } = await supabase
      .from('activities').select('deal_id, due_at').eq('id', activityId).eq('business_id', businessId).maybeSingle()
    if (!activity) return { success: false, error: 'Activity not found' }

    const newDue = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await supabase.from('activities').update({ due_at: newDue }).eq('id', activityId)
    if (error) return { success: false, error: error.message }

    await recomputeNextActivity(supabase, activity.deal_id)

    revalidatePath('/dashboard/today')
    revalidatePath('/dashboard/pipeline')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
