import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase-server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { original, edited, businessId } = await req.json()
  if (!original || !edited || !businessId) return Response.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: biz } = await supabase
    .from('businesses')
    .select('id, writing_style')
    .eq('owner_id', userId)
    .eq('id', businessId)
    .maybeSingle()
  if (!biz) return Response.json({ error: 'Business not found' }, { status: 403 })

  const existing = (biz.writing_style as Record<string, unknown>) ?? {}

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [{ type: 'text', text: 'You are a writing style analyst. Compare the original AI draft to the human-edited version and extract what changed. Update the writing style accordingly. Call return_updated_style.', cache_control: { type: 'ephemeral' } }],
    tools: [{
      name: 'return_updated_style',
      description: 'Return merged updated writing style',
      input_schema: {
        type: 'object' as const,
        properties: {
          tone:            { type: 'string' },
          sentence_length: { type: 'string' },
          greeting_style:  { type: 'string' },
          phrases:         { type: 'array', items: { type: 'string' } },
          signature:       { type: 'string' },
          summary:         { type: 'string' },
        },
        required: ['tone', 'sentence_length', 'greeting_style', 'phrases', 'signature', 'summary'],
      },
    }],
    messages: [{
      role: 'user',
      content: `Current style: ${JSON.stringify(existing)}\n\nOriginal AI draft:\n${original}\n\nEdited by human:\n${edited}\n\nWhat changed? Merge learnings into the updated style.`,
    }],
  })

  const toolCall = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_updated_style'
  )
  if (!toolCall) return Response.json({ error: 'Could not update style' }, { status: 422 })

  await supabase
    .from('businesses')
    .update({ writing_style: toolCall.input })
    .eq('id', businessId)

  return Response.json({ style: toolCall.input })
}
