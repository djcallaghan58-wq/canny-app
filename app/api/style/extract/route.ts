import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { emails }: { emails: string } = await req.json()
  if (!emails?.trim()) return Response.json({ error: 'Emails required' }, { status: 400 })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: [{ type: 'text', text: 'You are a writing style analyst. Extract writing style from the provided samples and call return_style.', cache_control: { type: 'ephemeral' } }],
    tools: [{
      name: 'return_style',
      description: 'Return the extracted writing style',
      input_schema: {
        type: 'object' as const,
        properties: {
          tone:            { type: 'string', description: 'e.g. friendly, professional, casual, direct' },
          sentence_length: { type: 'string', description: 'e.g. short, medium, long' },
          greeting_style:  { type: 'string', description: 'e.g. "Hi [name]", "Hey", "Hello"' },
          phrases:         { type: 'array', items: { type: 'string' }, description: 'Up to 5 characteristic phrases' },
          signature:       { type: 'string', description: 'How they sign off' },
          summary:         { type: 'string', description: '1 sentence summary of the style' },
        },
        required: ['tone', 'sentence_length', 'greeting_style', 'phrases', 'signature', 'summary'],
      },
    }],
    messages: [{ role: 'user', content: `Analyse these writing samples:\n\n${emails}` }],
  })

  const toolCall = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_style'
  )
  if (!toolCall) return Response.json({ error: 'Could not extract style' }, { status: 422 })

  return Response.json({ style: toolCall.input })
}
