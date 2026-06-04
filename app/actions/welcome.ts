'use server'

import { createAdminClient } from '@/lib/supabase-server'

export interface WelcomeData {
  activeLeads:        number
  prospectsThisWeek:  number
  enrichedProspects:  number
  recentProspects: Array<{
    id:           string
    company_name: string
    contact_name: string | null
    stage:        string
    created_at:   string
    source:       string | null
  }>
}

export async function getWelcomeData(businessId: string): Promise<WelcomeData> {
  const empty: WelcomeData = {
    activeLeads: 0, prospectsThisWeek: 0, enrichedProspects: 0, recentProspects: [],
  }
  try {
    const supabase = createAdminClient()
    const weekAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [leadsRes, prospectsRes] = await Promise.all([
      supabase.from('leads').select('stage').eq('business_id', businessId),
      supabase.from('prospects').select('id, company_name, contact_name, stage, created_at, source, enriched')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const leads     = leadsRes.data    ?? []
    const prospects = prospectsRes.data ?? []

    return {
      activeLeads:       leads.filter(l => l.stage !== 'Complete').length,
      prospectsThisWeek: prospects.filter(p => p.created_at >= weekAgo).length,
      enrichedProspects: prospects.filter(p => p.enriched).length,
      recentProspects:   prospects.slice(0, 5).map(p => ({
        id:           p.id,
        company_name: p.company_name,
        contact_name: p.contact_name ?? null,
        stage:        p.stage,
        created_at:   p.created_at,
        source:       p.source ?? null,
      })),
    }
  } catch {
    return empty
  }
}
