'use server'

import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import { auth } from '@clerk/nextjs/server'

export interface FollowupItem {
  id:              string
  type:            'lead' | 'prospect'
  company_name:    string
  contact_name:    string | null
  stage:           string
  service_type:    string | null
  days_overdue:    number
  last_contact:    string | null
  email:           string | null
  follow_up_number: 1 | 2 | 3
}

export interface ReactivationItem {
  id:                 string
  type:               'lead' | 'prospect'
  company_name:       string
  contact_name:       string | null
  service_type:       string | null
  days_since_contact: number
  last_contact:       string | null
  email:              string | null
}

export interface FollowupData {
  followups:     FollowupItem[]
  reactivations: ReactivationItem[]
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function getFollowupData(businessId: string): Promise<FollowupData> {
  const empty: FollowupData = { followups: [], reactivations: [] }
  try {
    const supabase  = createAdminClient()

    const [bizRes, leadsRes, prospectsRes] = await Promise.all([
      supabase.from('businesses').select('follow_up_schedule, reactivation_days').eq('id', businessId).single(),
      supabase.from('leads').select('*').eq('business_id', businessId),
      supabase.from('prospects').select('*').eq('business_id', businessId),
    ])

    const biz       = bizRes.data
    const leads     = leadsRes.data     ?? []
    const prospects = prospectsRes.data ?? []
    const now       = Date.now()

    const sched: { first: number; second: number; third: number } =
      (biz?.follow_up_schedule as { first: number; second: number; third: number }) ?? { first: 3, second: 7, third: 14 }
    const reactDays: number = biz?.reactivation_days ?? 60

    const firstMs  = sched.first  * DAY_MS
    const secondMs = sched.second * DAY_MS
    const thirdMs  = sched.third  * DAY_MS
    const reactMs  = reactDays    * DAY_MS

    const followups:     FollowupItem[]     = []
    const reactivations: ReactivationItem[] = []

    // ── Leads ──────────────────────────────────────────────────────────────
    for (const l of leads) {
      const lastTouch  = l.last_contacted_at ?? l.created_at
      const elapsed    = now - new Date(lastTouch).getTime()
      const elapsedDays = Math.floor(elapsed / DAY_MS)

      if (l.stage === 'Complete') {
        if (elapsed >= reactMs) {
          reactivations.push({
            id: l.id, type: 'lead',
            company_name: l.customer_name, contact_name: null,
            service_type: l.service_type   || null,
            days_since_contact: elapsedDays,
            last_contact: lastTouch,
            email: l.customer_email || null,
          })
        }
      } else {
        let followUpNumber: 1 | 2 | 3 | null = null
        let threshold = 0
        if      (elapsed >= thirdMs)  { followUpNumber = 3; threshold = sched.third  }
        else if (elapsed >= secondMs) { followUpNumber = 2; threshold = sched.second }
        else if (elapsed >= firstMs)  { followUpNumber = 1; threshold = sched.first  }

        if (followUpNumber) {
          followups.push({
            id: l.id, type: 'lead',
            company_name: l.customer_name, contact_name: null,
            stage: l.stage,
            service_type: l.service_type || null,
            days_overdue: elapsedDays - threshold,
            last_contact: lastTouch,
            email: l.customer_email || null,
            follow_up_number: followUpNumber,
          })
        }
      }
    }

    // ── Prospects ──────────────────────────────────────────────────────────
    for (const p of prospects) {
      const lastTouch   = p.last_outreach_at ?? p.created_at
      const elapsed     = now - new Date(lastTouch).getTime()
      const elapsedDays = Math.floor(elapsed / DAY_MS)

      if (p.stage === 'Closed Won') {
        // Former customer - eligible for a reactivation nudge after a long gap.
        if (elapsed >= reactMs) {
          reactivations.push({
            id: p.id, type: 'prospect',
            company_name: p.company_name, contact_name: p.contact_name || null,
            service_type: null,
            days_since_contact: elapsedDays,
            last_contact: lastTouch,
            email: p.email || null,
          })
        }
      } else if (p.stage === 'Closed Lost') {
        // Deal's dead - don't keep nagging a lost prospect.
      } else if (p.status === 'pipeline') {
        // Has an active deal in the Sales Pipeline now - prospect.stage is
        // frozen at whatever it was when promoted (never mutated for deal
        // progression, see app/actions/deals.ts), so it can't be trusted
        // for follow-up timing anymore. Deal-level follow-up/activity
        // tracking (Phase 2) owns this instead; outreach follow-ups stand
        // down here rather than re-nagging someone who already replied.
      } else if (p.stage !== 'New') {
        // Only follow-up on prospects that have been contacted at some point
        if (p.last_outreach_at) {
          let followUpNumber: 1 | 2 | 3 | null = null
          let threshold = 0
          if      (elapsed >= thirdMs)  { followUpNumber = 3; threshold = sched.third  }
          else if (elapsed >= secondMs) { followUpNumber = 2; threshold = sched.second }
          else if (elapsed >= firstMs)  { followUpNumber = 1; threshold = sched.first  }

          if (followUpNumber) {
            followups.push({
              id: p.id, type: 'prospect',
              company_name: p.company_name, contact_name: p.contact_name || null,
              stage: p.stage,
              service_type: null,
              days_overdue: elapsedDays - threshold,
              last_contact: lastTouch,
              email: p.email || null,
              follow_up_number: followUpNumber,
            })
          }
        }
      }
    }

    // Sort: most overdue first
    followups.sort((a, b) => b.days_overdue - a.days_overdue)
    reactivations.sort((a, b) => b.days_since_contact - a.days_since_contact)

    return { followups, reactivations }
  } catch {
    return empty
  }
}

export async function markLeadContacted(leadId: string): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) return { success: false }
  try {
    const biz      = await resolveBusinessForUser(userId)
    if (!biz) return { success: false }
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('leads')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('business_id', biz.id)
    return { success: !error }
  } catch {
    return { success: false }
  }
}

export async function markProspectContacted(prospectId: string): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) return { success: false }
  try {
    const biz      = await resolveBusinessForUser(userId)
    if (!biz) return { success: false }
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('prospects')
      .update({ last_outreach_at: new Date().toISOString() })
      .eq('id', prospectId)
      .eq('business_id', biz.id)
    return { success: !error }
  } catch {
    return { success: false }
  }
}
