'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import type { Business } from '@/lib/supabase'

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

export async function createBusiness(input: {
  name: string
  industry: string
  ideal_customer: string
  main_service: string
  city: string
  phone: string
}): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }

  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('businesses')
      .insert({ ...input, trade_type: 'Other', owner_id: userId })

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
  phone?: string
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
