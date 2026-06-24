'use server'

import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-server'
import { resolveBusinessForUser } from '@/lib/resolve-business'
import type { WritingStyleRow } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

export async function saveEmailAsStyle(
  businessId: string,
  emailText: string,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Not authenticated' }
  try {
    const supabase = createAdminClient()
    const biz = await resolveBusinessForUser(userId)
    if (!biz || biz.id !== businessId) return { success: false, error: 'Business not found' }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [{ type: 'text', text: 'You are a writing style analyst. Extract the writing style from the provided email and call return_style.', cache_control: { type: 'ephemeral' } }],
      tools: [{
        name: 'return_style',
        description: 'Return the extracted writing style',
        input_schema: {
          type: 'object' as const,
          properties: {
            tone:        { type: 'string', description: 'e.g. "warm and direct"' },
            greeting:    { type: 'string', description: 'How they open emails' },
            sign_off:    { type: 'string', description: 'How they sign off' },
            key_phrases: { type: 'array', items: { type: 'string' }, description: 'Up to 5 characteristic phrases' },
            sample_text: { type: 'string', description: '1-2 sentence style summary' },
          },
          required: ['tone', 'greeting', 'sign_off', 'key_phrases', 'sample_text'],
        },
      }],
      messages: [{ role: 'user', content: `Extract the writing style from this email:\n\n${emailText}` }],
    })

    const toolCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_style'
    )
    if (!toolCall) return { success: false, error: 'Could not extract style' }

    const extracted = toolCall.input as {
      tone: string; greeting: string; sign_off: string; key_phrases: string[]; sample_text: string
    }

    // Update active style if one exists, otherwise create one
    const { data: active } = await supabase
      .from('writing_styles')
      .select('id')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle()

    if (active) {
      await supabase.from('writing_styles').update({
        tone:        extracted.tone,
        greeting:    extracted.greeting,
        sign_off:    extracted.sign_off,
        key_phrases: extracted.key_phrases,
        sample_text: extracted.sample_text,
        updated_at:  new Date().toISOString(),
      }).eq('id', active.id)
    } else {
      await supabase.from('writing_styles').insert({
        business_id: businessId,
        name:        'My Writing Style',
        is_active:   true,
        tone:        extracted.tone,
        greeting:    extracted.greeting,
        sign_off:    extracted.sign_off,
        key_phrases: extracted.key_phrases,
        sample_text: extracted.sample_text,
      })
    }

    revalidatePath('/dashboard/settings')
    revalidatePath('/dashboard/settings/style')
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
