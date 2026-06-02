import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { query, business } = await req.json()
  if (!query) return Response.json({ error: 'Query required' }, { status: 400 })

  const system = [
    `You are a B2B prospecting research agent for ${business.name}`,
    business.industry                   ? `, a ${business.industry} company`                              : '',
    business.city                       ? ` based in ${business.city}`                                    : '',
    `.`,
    business.business_description       ? ` About the business: ${business.business_description}.`        : '',
    business.ideal_customer             ? ` Target customer: ${business.ideal_customer}.`                  : '',
    business.ideal_customer_description ? ` Ideal customer detail: ${business.ideal_customer_description}.` : '',
    business.main_service               ? ` Main service/product: ${business.main_service}.`               : '',
    ` Use web search to research the prospect. Then call return_research with all findings.`,
  ].join('')

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: [
        { type: 'web_search_20250305' as const, name: 'web_search' },
        {
          name: 'return_research',
          description: 'Return structured prospect research findings after completing web research',
          input_schema: {
            type: 'object' as const,
            properties: {
              company_name:         { type: 'string', description: 'Full legal company name' },
              company_overview:     { type: 'string', description: '2-3 sentence company overview' },
              decision_maker_name:  { type: 'string', description: 'Key decision maker full name' },
              decision_maker_title: { type: 'string', description: 'Decision maker job title' },
              email_format:         { type: 'string', description: 'Best-guess email format, e.g. firstname@company.com' },
              pain_points:          { type: 'string', description: 'Specific pain points relevant to our service' },
              pitch_angle:          { type: 'string', description: '2-3 sentence personalized pitch angle' },
              talking_points:       { type: 'array', items: { type: 'string' }, description: 'Exactly 3 specific, actionable talking points' },
            },
            required: ['company_name', 'company_overview', 'decision_maker_name', 'decision_maker_title', 'email_format', 'pain_points', 'pitch_angle', 'talking_points'],
          },
        },
      ],
      messages: [{ role: 'user', content: `Research this prospect: ${query}` }],
    })

    const toolCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_research'
    )
    if (toolCall) return Response.json({ result: toolCall.input })

    const fallback = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('')
    return Response.json({ error: 'Could not structure results', fallback }, { status: 422 })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
