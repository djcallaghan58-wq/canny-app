import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Salevo mode: business object provided
  // Legacy mode: niche + description provided
  const { messages, business, niche, description } = body

  if (!messages?.length) return Response.json({ error: 'Messages required' }, { status: 400 })

  const systemPrompt = business
    ? [
        `You are the AI assistant for ${business.name}, based in ${business.city}.`,
        business.industry       ? `Industry: ${business.industry}.`        : '',
        business.ideal_customer ? `Ideal customer: ${business.ideal_customer}.` : '',
        business.main_service   ? `Main service/product: ${business.main_service}.` : '',
        `Help the owner capture leads, draft follow-up messages, research prospects, and coach them on closing deals. Be direct and practical. Use → for actions, ⚠ for risks, ✦ for opportunities.`,
      ].filter(Boolean).join(' ')
    : `You are Salevo's AI assistant specializing in ${niche} businesses (${description}). Your role is to help users with pipeline management, prospect research, sales strategy, and outreach copy. Use web search to provide current, accurate information when asked about market data, companies, or recent developments. Be concise and actionable. Use → for key points and ✦ for tips.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [
      {
        type: 'web_search_20250305' as const,
        name: 'web_search',
      },
    ],
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('')

  return Response.json({ reply: text || 'Try again.' })
}
