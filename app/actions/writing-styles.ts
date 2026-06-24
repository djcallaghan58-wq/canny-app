'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import type { WritingStyleRow } from '@/lib/supabase'

export async function getWritingStyles(businessId: string): Promise<WritingStyleRow[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('writing_styles')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true })
      .limit(20)
    return (data as WritingStyleRow[]) ?? []
  } catch {
    return []
  }
}

export async function createWritingStyle(input: {
  business_id: string
  name: string
  tone?: string | null
  greeting?: string | null
  sign_off?: string | null
  key_phrases?: string[]
  sample_text?: string | null
  is_active?: boolean
}): Promise<{ success: boolean; style?: WritingStyleRow; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== input.business_id) return { success: false, error: 'Business not found' }

    if (input.is_active) {
      await supabase.from('writing_styles').update({ is_active: false }).eq('business_id', input.business_id)
    }

    const { data, error } = await supabase
      .from('writing_styles')
      .insert({ ...input, key_phrases: input.key_phrases ?? [], is_active: input.is_active ?? false })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/settings/style')
    return { success: true, style: data as WritingStyleRow }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function updateWritingStyle(
  id: string,
  input: Partial<{
    name: string
    tone: string | null
    greeting: string | null
    sign_off: string | null
    key_phrases: string[]
    sample_text: string | null
  }>,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz) return { success: false, error: 'Business not found' }

    const { error } = await supabase
      .from('writing_styles')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', biz.id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/settings/style')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function deleteWritingStyle(id: string): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz) return { success: false, error: 'Business not found' }

    const { error } = await supabase
      .from('writing_styles')
      .delete()
      .eq('id', id)
      .eq('business_id', biz.id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/settings/style')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function setActiveStyle(
  id: string,
  businessId: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    await supabase.from('writing_styles').update({ is_active: false }).eq('business_id', businessId)
    const { error } = await supabase
      .from('writing_styles')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', businessId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/settings/style')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
