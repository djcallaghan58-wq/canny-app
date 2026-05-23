'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import type { Business, TradeType, CatalogItem, WritingStyle } from '@/lib/supabase'

function industryToTradeType(industry: string): TradeType {
  if (industry === 'HVAC') return 'HVAC'
  if (industry === 'Plumbing') return 'Plumbing'
  if (industry === 'Electrical') return 'Electrical'
  if (industry === 'Roofing') return 'Roofing'
  return 'Other'
}

export async function getBusiness(): Promise<Business | null> {
  const { userId } = await auth()
  if (!userId) return null

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle()

    if (error) {
      console.error('getBusiness:', error.message)
      return null
    }

    return data
  } catch {
    return null
  }
}

// Full onboarding create
export async function createBusiness(input: {
  name: string
  industry: string
  city: string
  service_area?: string
  phone?: string
  catalog?: CatalogItem[]
  target_customer_type?: string
  customer_types?: string[]
  writing_style?: WritingStyle | null
  // Legacy fields
  ideal_customer?: string
  main_service?: string
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('businesses')
      .insert({
        name:                 input.name,
        industry:             input.industry,
        trade_type:           industryToTradeType(input.industry),
        city:                 input.city,
        service_area:         input.service_area ?? '',
        phone:                input.phone ?? '',
        catalog:              input.catalog ?? [],
        target_customer_type: input.target_customer_type ?? 'Both',
        customer_types:       input.customer_types ?? [],
        writing_style:        input.writing_style ?? null,
        ideal_customer:       input.ideal_customer ?? '',
        main_service:         input.main_service ?? '',
        owner_id:             userId,
        onboarding_complete:  true,
      })

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function updateBusiness(input: {
  name?: string
  industry?: string
  ideal_customer?: string
  main_service?: string
  city?: string
  service_area?: string
  phone?: string
  catalog?: CatalogItem[]
  target_customer_type?: string
  customer_types?: string[]
  writing_style?: object | null
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('businesses')
      .update(input)
      .eq('owner_id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
