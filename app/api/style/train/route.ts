import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase-server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { emails, businessId }: { emails: string; businessId: string } = await req.json()
  if (!emails?.trim()) return Response.json({ error: 'Emails required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .eq('id', businessId)
    .maybeSingle()
  if (!biz) return Response.json({ error: 'Business not found' }, { status: 403 })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [{ type: 'text', text: 'You are a writing style analyst. Extract the writing style from the provided email samples and call return_style.', cache_control: { type: 'ephemeral' } }],
    tools: [{
      name: 'return_style',
      description: 'Return the extracted writing style',
      input_schema: {
        type: 'object' as const,
        properties: {
          tone:            { type: 'string', description: 'e.g. friendly, professional, casual, direct' },
          sentence_length: { type: 'string', description: 'e.g. short, medium, long, mixed' },
          greeting_style:  { type: 'string', description: 'e.g. "Hi [name]", "Hey", "Hello"' },
          phrases:         { type: 'array', items: { type: 'string' }, description: 'Up to 5 characteristic phrases or words they use' },
          signature:       { type: 'string', description: 'How they sign off' },
          summary:         { type: 'string', description: '1-2 sentence summary of the writing style' },
        },
        required: ['tone', 'sentence_length', 'greeting_style', 'phrases', 'signature', 'summary'],
      },
    }],
    messages: [{ role: 'user', content: `Analyse these email samples and extract the writing style:\n\n${emails}` }],
  })

  const toolCall = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_style'
  )
  if (!toolCall) return Response.json({ error: 'Could not extract style' }, { status: 422 })

  const style = toolCall.input

  await supabase
    .from('businesses')
    .update({ writing_style: style })
    .eq('id', businessId)

  return Response.json({ style })
}
