import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface Business {
  name: string
  industry: string | null
  ideal_customer: string | null
  main_service: string | null
  city: string | null
  writing_style?: {
    tone?: string
    sentence_length?: string
    greeting_style?: string
    phrases?: string[]
    signature?: string
    summary?: string
  } | null
}

async function runAgent(
  systemPrompt: string,
  userMessage: string,
  tools: Anthropic.Tool[],
  withWebSearch = false,
): Promise<string> {
  const allTools: (Anthropic.Tool | { type: 'web_search_20250305'; name: string })[] = withWebSearch
    ? [{ type: 'web_search_20250305' as const, name: 'web_search' }, ...tools]
    : tools

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    tools: allTools as Anthropic.Tool[],
    messages: [{ role: 'user', content: userMessage }],
  })

  const toolCall = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name !== 'web_search'
  )
  if (toolCall) return JSON.stringify(toolCall.input)

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text).join('')
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { query, business }: { query: string; business: Business } = await req.json()
  if (!query) return Response.json({ error: 'Query required' }, { status: 400 })

  const bizContext = [
    `Business: ${business.name}`,
    business.industry       ? `Industry: ${business.industry}`               : '',
    business.ideal_customer ? `Ideal customer: ${business.ideal_customer}`   : '',
    business.main_service   ? `Service/product: ${business.main_service}`    : '',
    business.city           ? `Location: ${business.city}`                   : '',
  ].filter(Boolean).join('\n')

  // ── Run all 4 agents in parallel ──────────────────────────────────────────

  const returnTool = (name: string, description: string, schema: Record<string, unknown>): Anthropic.Tool => ({
    name,
    description,
    input_schema: { type: 'object' as const, ...schema },
  })

  const [researcherRaw, contactRaw, painRaw] = await Promise.all([

    // Agent 1 — Researcher
    runAgent(
      `You are a B2B researcher. Find factual information about the target company using web search. Return results by calling return_company_facts.`,
      `Research this company/prospect: ${query}`,
      [returnTool('return_company_facts', 'Return company research', {
        properties: {
          company_name:  { type: 'string' },
          website:       { type: 'string' },
          location:      { type: 'string' },
          company_size:  { type: 'string' },
          overview:      { type: 'string', description: '2-3 sentence overview' },
          recent_news:   { type: 'string' },
        },
        required: ['company_name', 'website', 'overview'],
      })],
      true,
    ),

    // Agent 2 — Contact Finder
    runAgent(
      `You are a B2B contact researcher. Find the key decision maker at the target company using web search. Return by calling return_contact.`,
      `Find the owner, manager, or director at: ${query}. Search for "[company] [city] owner OR manager OR director".`,
      [returnTool('return_contact', 'Return contact info', {
        properties: {
          name:        { type: 'string' },
          title:       { type: 'string' },
          email_guess: { type: 'string', description: 'Best-guess email format e.g. john@company.com' },
          linkedin:    { type: 'string' },
        },
        required: ['name', 'title', 'email_guess'],
      })],
      true,
    ),

    // Agent 3 — Pain Point Analyser (no web search needed)
    runAgent(
      `You are a B2B sales strategist. Given a company description and a seller's profile, identify specific pain points and craft a personalized pitch. Call return_pitch with your analysis.`,
      `Company/prospect: ${query}\n\n${bizContext}`,
      [returnTool('return_pitch', 'Return pain points and pitch', {
        properties: {
          pain_points: { type: 'string', description: 'Specific pain points relevant to our service' },
          pitch_angle: { type: 'string', description: '2-3 sentence personalized pitch' },
          best_hook:   { type: 'string', description: 'One-line attention grabber' },
          talking_points: { type: 'array', items: { type: 'string' }, description: '3 talking points' },
        },
        required: ['pain_points', 'pitch_angle', 'best_hook', 'talking_points'],
      })],
      false,
    ),
  ])

  // Parse agent outputs
  const parseJSON = (raw: string, fallback: Record<string, unknown> = {}) => {
    try { return JSON.parse(raw) } catch { return fallback }
  }

  const company  = parseJSON(researcherRaw)
  const contact  = parseJSON(contactRaw)
  const pitch    = parseJSON(painRaw)

  // Agent 4 — Copywriter (depends on 1-3)
  const styleContext = business.writing_style?.summary
    ? `\n\nWriting style to match: ${business.writing_style.summary}. Tone: ${business.writing_style.tone ?? 'professional'}. Keep sentences ${business.writing_style.sentence_length ?? 'concise'}.`
    : ''

  const copyRaw = await runAgent(
    `You are a cold email copywriter. Write short, non-pushy, highly personalized cold emails that get replies. Max 120 words in body. No buzzwords.${styleContext}`,
    `Write a cold email to ${contact.name ?? 'the decision maker'} at ${company.company_name ?? query}.
Pain points: ${pitch.pain_points ?? ''}
Pitch: ${pitch.pitch_angle ?? ''}
Hook: ${pitch.best_hook ?? ''}
Our service: ${business.main_service ?? ''}
Call return_email with two subject line options and a body.`,
    [returnTool('return_email', 'Return drafted email', {
      properties: {
        subject_a: { type: 'string' },
        subject_b: { type: 'string' },
        body:      { type: 'string' },
      },
      required: ['subject_a', 'subject_b', 'body'],
    })],
    false,
  )

  const copy = parseJSON(copyRaw)

  return Response.json({
    result: {
      company_name:    company.company_name  ?? query,
      website:         company.website       ?? '',
      location:        company.location      ?? '',
      company_overview: company.overview     ?? '',
      recent_news:     company.recent_news   ?? '',
      decision_maker_name:  contact.name     ?? '',
      decision_maker_title: contact.title    ?? '',
      email_format:    contact.email_guess   ?? '',
      linkedin:        contact.linkedin      ?? '',
      pain_points:     pitch.pain_points     ?? '',
      pitch_angle:     pitch.pitch_angle     ?? '',
      best_hook:       pitch.best_hook       ?? '',
      talking_points:  pitch.talking_points  ?? [],
      subject_a:       copy.subject_a        ?? '',
      subject_b:       copy.subject_b        ?? '',
      email_body:      copy.body             ?? '',
    },
  })
}
