'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import type { Prospect, ProspectStage } from '@/lib/supabase'

export async function getProspects(businessId: string): Promise<Prospect[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('prospects')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
    return (data as Prospect[]) ?? []
  } catch {
    return []
  }
}

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

    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .eq('id', input.business_id)
      .maybeSingle()
    if (!biz) return { success: false, error: 'Business not found' }

    const { data, error } = await supabase
      .from('prospects')
      .insert({ stage: 'New', ...input })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/prospects')
    return { success: true, prospect: data as Prospect }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function updateProspectStage(
  id: string,
  stage: ProspectStage,
): Promise<{ success: boolean }> {
  const { userId } = await auth()
  if (!userId) return { success: false }

  try {
    const supabase = createAdminClient()
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()
    if (!biz) return { success: false }

    const { error } = await supabase
      .from('prospects')
      .update({ stage })
      .eq('id', id)
      .eq('business_id', biz.id)

    return { success: !error }
  } catch {
    return { success: false }
  }
}

export async function updateProspect(
  id: string,
  updates: Partial<Pick<Prospect, 'notes' | 'stage' | 'pain_points' | 'pitch_angle' | 'talking_points' | 'company_overview' | 'email_format' | 'contact_name' | 'contact_title' | 'enriched' | 'last_outreach_at' | 'value'>>,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()
    if (!biz) return { success: false, error: 'Business not found' }

    const { error } = await supabase
      .from('prospects')
      .update(updates)
      .eq('id', id)
      .eq('business_id', biz.id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/prospects')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function importProspects(
  businessId: string,
  rows: {
    company_name: string
    contact_name: string
    contact_title: string
    email: string
    phone: string
    notes: string
  }[],
): Promise<{ success: boolean; count: number; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, count: 0, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', userId)
      .eq('id', businessId)
      .maybeSingle()
    if (!biz) return { success: false, count: 0, error: 'Business not found' }

    const inserts = rows.map(r => ({ ...r, business_id: businessId, stage: 'New' as ProspectStage }))
    const { data, error } = await supabase.from('prospects').insert(inserts).select()

    if (error) return { success: false, count: 0, error: error.message }
    revalidatePath('/dashboard/prospects')
    return { success: true, count: data?.length ?? 0 }
  } catch (e) {
    return { success: false, count: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
