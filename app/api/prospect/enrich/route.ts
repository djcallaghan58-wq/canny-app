import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect, business } = await req.json()
  if (!prospect?.company_name) return Response.json({ error: 'Prospect required' }, { status: 400 })

  const system = [
    `You are a B2B prospecting research agent for ${business.name}`,
    business.industry                   ? `, a ${business.industry} company`                               : '',
    business.city                       ? ` based in ${business.city}`                                     : '',
    `.`,
    business.business_description       ? ` About the business: ${business.business_description}.`         : '',
    business.ideal_customer             ? ` Target customer: ${business.ideal_customer}.`                   : '',
    business.ideal_customer_description ? ` Ideal customer detail: ${business.ideal_customer_description}.` : '',
    business.main_service               ? ` Main service/product: ${business.main_service}.`                : '',
    ` Research the given company and call return_enrichment with your findings.`,
  ].join('')

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: [
        { type: 'web_search_20250305' as const, name: 'web_search' },
        {
          name: 'return_enrichment',
          description: 'Return enrichment data for this prospect',
          input_schema: {
            type: 'object' as const,
            properties: {
              company_overview: { type: 'string' },
              email_format:     { type: 'string' },
              pain_points:      { type: 'string' },
              pitch_angle:      { type: 'string' },
              talking_points:   { type: 'array', items: { type: 'string' }, description: '3 talking points' },
            },
            required: ['company_overview', 'email_format', 'pain_points', 'pitch_angle', 'talking_points'],
          },
        },
      ],
      messages: [{
        role: 'user',
        content: `Enrich this prospect: ${prospect.company_name}${prospect.contact_name ? `, contact: ${prospect.contact_name} (${prospect.contact_title})` : ''}`,
      }],
    })

    const toolCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_enrichment'
    )
    if (toolCall) return Response.json({ result: toolCall.input })

    return Response.json({ error: 'Enrichment failed' }, { status: 422 })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
