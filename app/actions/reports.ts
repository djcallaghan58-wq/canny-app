'use server'

import { createAdminClient } from '@/lib/supabase-server'
import type { Lead } from '@/lib/supabase'

export interface ReportsData {
  // Pipeline summary
  leadsByStage:     Record<string, number>
  totalValue:       number
  avgDaysToClose:   number
  // Prospecting activity
  totalProspects:   number
  prospectsLast30d: number
  enrichedCount:    number
  inPipelineCount:  number
  recentSearches:   Array<{ query: string; results_count: number; created_at: string }>
  // Follow-up performance
  overdueCount:     number   // no contact in 3+ days (default threshold)
  staleCount:       number   // no contact in 14+ days
  avgResponseDays:  number   // avg days between created and last_contacted
  // Raw leads for CSV export
  leads:            Lead[]
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function getReportsData(businessId: string): Promise<ReportsData> {
  const empty: ReportsData = {
    leadsByStage: {}, totalValue: 0, avgDaysToClose: 0,
    totalProspects: 0, prospectsLast30d: 0, enrichedCount: 0, inPipelineCount: 0,
    recentSearches: [], overdueCount: 0, staleCount: 0, avgResponseDays: 0, leads: [],
  }
  try {
    const supabase   = createAdminClient()
    const now        = Date.now()
    const thirtyAgo  = new Date(now - 30 * DAY_MS).toISOString()
    const threeDayMs = 3  * DAY_MS
    const fourteenMs = 14 * DAY_MS

    const [leadsRes, prospectsRes, searchesRes, bizRes] = await Promise.all([
      supabase.from('leads').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
      supabase.from('prospects').select('id, enriched, status, stage, created_at').eq('business_id', businessId),
      supabase.from('prospect_searches').select('query, results_count, created_at').eq('business_id', businessId).order('created_at', { ascending: false }).limit(10),
      supabase.from('businesses').select('follow_up_schedule').eq('id', businessId).single(),
    ])

    const leads     = (leadsRes.data     ?? []) as Lead[]
    const prospects = prospectsRes.data  ?? []
    const searches  = searchesRes.data   ?? []
    const sched     = (bizRes.data?.follow_up_schedule as { first: number } | null) ?? { first: 3 }
    const overdueMsThresh = sched.first * DAY_MS

    // Pipeline summary
    const leadsByStage: Record<string, number> = {}
    let totalValue     = 0
    let closedDaysSum  = 0
    let closedCount    = 0

    for (const l of leads) {
      leadsByStage[l.stage] = (leadsByStage[l.stage] ?? 0) + 1
      const active = l.stage !== 'Complete'
      if (active) totalValue += Number(l.value) || 0

      if (l.stage === 'Complete' && l.last_contacted_at) {
        const days = (new Date(l.last_contacted_at).getTime() - new Date(l.created_at).getTime()) / DAY_MS
        if (days > 0) { closedDaysSum += days; closedCount++ }
      }
    }
    const avgDaysToClose = closedCount > 0 ? Math.round(closedDaysSum / closedCount) : 0

    // Follow-up performance
    let overdueCount    = 0
    let staleCount      = 0
    let responseDaysSum = 0
    let responsedCount  = 0

    for (const l of leads) {
      if (l.stage === 'Complete') continue
      const lastTouch = l.last_contacted_at ?? l.created_at
      const elapsed   = now - new Date(lastTouch).getTime()
      if (elapsed >= overdueMsThresh)  overdueCount++
      if (elapsed >= fourteenMs)       staleCount++
      if (l.last_contacted_at) {
        const days = (new Date(l.last_contacted_at).getTime() - new Date(l.created_at).getTime()) / DAY_MS
        if (days >= 0) { responseDaysSum += days; responsedCount++ }
      }
    }
    const avgResponseDays = responsedCount > 0 ? Math.round(responseDaysSum / responsedCount) : 0

    return {
      leadsByStage,
      totalValue,
      avgDaysToClose,
      totalProspects:   prospects.length,
      prospectsLast30d: prospects.filter(p => p.created_at >= thirtyAgo).length,
      enrichedCount:    prospects.filter(p => p.enriched).length,
      inPipelineCount:  prospects.filter(p => p.status === 'pipeline').length,
      recentSearches:   searches as Array<{ query: string; results_count: number; created_at: string }>,
      overdueCount,
      staleCount,
      avgResponseDays,
      leads,
    }
  } catch {
    return empty
  }
}
