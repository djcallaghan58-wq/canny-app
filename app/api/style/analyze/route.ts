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
          tone:        { type: 'string', description: 'e.g. "warm and direct" or "professional but approachable"' },
          greeting:    { type: 'string', description: 'How they open emails, e.g. "Hi [name]," or "Hey,"' },
          sign_off:    { type: 'string', description: 'How they sign off, e.g. "Best," or "Thanks,"' },
          key_phrases: { type: 'array', items: { type: 'string' }, description: 'Up to 5 characteristic phrases or expressions they use' },
          sample_text: { type: 'string', description: '1-2 sentence summary of this writing style' },
        },
        required: ['tone', 'greeting', 'sign_off', 'key_phrases', 'sample_text'],
      },
    }],
    messages: [{ role: 'user', content: `Analyse these email samples and extract the writing style:\n\n${emails}` }],
  })

  const toolCall = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_style'
  )
  if (!toolCall) return Response.json({ error: 'Could not extract style' }, { status: 422 })

  return Response.json(toolCall.input)
}
