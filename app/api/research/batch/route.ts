import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Business {
  name: string
  industry: string | null
  ideal_customer: string | null
  ideal_customer_description: string | null
  business_description: string | null
  main_service: string | null
  city: string | null
}

export interface BatchResult {
  company_name: string
  website: string
  location: string
  overview: string
  contact_name: string
  contact_title: string
  email_format: string
  pain_points: string
  pitch_angle: string
  email_subject: string
  email_body: string
}

async function generateTargets(
  query: string,
  business: Business,
  excludeCompanies: string[],
): Promise<string[]> {
  const excludeNote = excludeCompanies.length > 0
    ? ` Do NOT include any of these already-saved companies: ${excludeCompanies.slice(0, 30).join(', ')}.`
    : ''

  const targetingSystem = [
    `You find B2B prospects for ${business.name}`,
    business.industry             ? `, a ${business.industry} company`                              : '',
    business.city                 ? ` based in ${business.city}`                                    : '',
    `.`,
    business.business_description ? ` About the business: ${business.business_description}.`        : '',
    ` Use web search to find real, specific companies.`,
  ].join('')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: targetingSystem,
    tools: [
      { type: 'web_search_20250305' as const, name: 'web_search' },
      {
        name: 'return_targets',
        description: 'Return exactly 10 specific real company names to research',
        input_schema: {
          type: 'object' as const,
          properties: {
            targets: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of exactly 10 specific company or organization names',
            },
          },
          required: ['targets'],
        },
      },
    ],
    messages: [{
      role: 'user',
      content: `Find exactly 10 specific real companies matching: "${query}". Each should be a good prospect for a business selling ${business.main_service || 'services'} to ${business.ideal_customer_description || business.ideal_customer || 'businesses'}.${excludeNote} Return exactly 10 specific names.`,
    }],
  })

  const toolCall = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_targets'
  )
  if (toolCall) {
    const targets = ((toolCall.input as { targets?: string[] }).targets ?? []).slice(0, 10)
    if (targets.length >= 5) return targets
  }

  // Fallback: numbered searches
  return Array.from({ length: 10 }, (_, i) => `${query} company ${i + 1}`)
}

async function researchOneProspect(
  target: string,
  business: Business,
): Promise<BatchResult | null> {
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [
      `You research B2B prospects for ${business.name}`,
      business.industry                   ? `, a ${business.industry} company`                               : '',
      `.`,
      business.business_description       ? ` About the business: ${business.business_description}.`         : '',
      business.ideal_customer_description ? ` Ideal customer: ${business.ideal_customer_description}.`        : '',
      ` Be specific. Use web search, then call return_prospect.`,
    ].join(''),
      tools: [
        { type: 'web_search_20250305' as const, name: 'web_search' },
        {
          name: 'return_prospect',
          description: 'Return structured prospect research',
          input_schema: {
            type: 'object' as const,
            properties: {
              company_name:  { type: 'string' },
              website:       { type: 'string' },
              location:      { type: 'string' },
              overview:      { type: 'string', description: '1-2 sentence overview' },
              contact_name:  { type: 'string', description: 'Key decision maker' },
              contact_title: { type: 'string' },
              email_format:  { type: 'string', description: 'e.g. firstname@company.com' },
              pain_points:   { type: 'string', description: 'Pain points relevant to our service' },
              pitch_angle:   { type: 'string', description: '1-2 sentence personalized pitch' },
              email_subject: { type: 'string' },
              email_body:    { type: 'string', description: 'Cold email body, max 80 words, no buzzwords' },
            },
            required: ['company_name', 'overview', 'pain_points', 'pitch_angle', 'email_subject', 'email_body'],
          },
        },
      ],
      messages: [{
        role: 'user',
        content: `Research "${target}". Find contact info, identify pain points relevant to ${business.main_service || 'our services'}, and draft a brief cold email.`,
      }],
    })

    const toolCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_prospect'
    )
    return toolCall ? (toolCall.input as BatchResult) : null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    query,
    business,
    existingCompanies = [],
  }: { query: string; business: Business; existingCompanies: string[] } = await req.json()

  if (!query) return Response.json({ error: 'Query required' }, { status: 400 })

  // Step 1: find 10 real targets (~8s)
  const targets = await generateTargets(query, business, existingCompanies)

  // Step 2: research all in parallel (~15-20s with Haiku)
  const results = await Promise.all(targets.map(t => researchOneProspect(t, business)))

  const filtered = results
    .filter((r): r is BatchResult => r !== null && r.company_name?.length > 0)
    .filter(r => !existingCompanies.some(
      e => e.toLowerCase().trim() === r.company_name.toLowerCase().trim()
    ))

  return Response.json({ results: filtered })
}
