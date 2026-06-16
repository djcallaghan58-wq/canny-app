import { after } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase-server'
import { scrapeCompanyContact } from '@/lib/research-scraper'
import { stripDashesFromObject } from '@/lib/strip-dashes'

export const maxDuration = 300

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Types ─────────────────────────────────────────────────────────────────────

interface Business {
  name:                       string
  industry:                   string | null
  ideal_customer:             string | null
  ideal_customer_description: string | null
  business_description:       string | null
  main_service:               string | null
  city:                       string | null
}

export interface BatchResult {
  company_name:  string
  website:       string
  location:      string
  overview:      string
  contact_name:  string
  contact_title: string
  email_format:  string
  pain_points:   string
  pitch_angle:   string
  email_subject: string
  email_body:    string
}

// ── Step 1: generate target company names ─────────────────────────────────────

async function generateTargets(
  query:            string,
  business:         Business,
  excludeCompanies: string[],
): Promise<string[]> {
  const excludeNote = excludeCompanies.length > 0
    ? ` Do NOT include any of these already-saved companies: ${excludeCompanies.slice(0, 30).join(', ')}.`
    : ''

  const system = [
    `You find B2B prospects for ${business.name}`,
    business.industry ? `, a ${business.industry} company` : '',
    business.city     ? ` based in ${business.city}`       : '',
    `.`,
    business.business_description ? ` About the business: ${business.business_description}.` : '',
    ` Use web search to find real, specific companies.`,
  ].join('')

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system,
    tools: [
      { type: 'web_search_20250305' as const, name: 'web_search' },
      {
        name:        'return_targets',
        description: 'Return exactly 10 specific real company names to research',
        input_schema: {
          type:       'object' as const,
          properties: {
            targets: {
              type:        'array',
              items:       { type: 'string' },
              description: 'Array of exactly 10 specific company or organization names',
            },
          },
          required: ['targets'],
        },
      },
    ],
    messages: [{
      role:    'user',
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
  return Array.from({ length: 10 }, (_, i) => `${query} company ${i + 1}`)
}

// ── Step 2: research one prospect ─────────────────────────────────────────────

async function researchOneProspect(
  target:   string,
  business: Business,
): Promise<BatchResult | null> {
  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [
        `You research B2B prospects for ${business.name}`,
        business.industry                   ? `, a ${business.industry} company`                         : '',
        `.`,
        business.business_description       ? ` About the business: ${business.business_description}.`   : '',
        business.ideal_customer_description ? ` Ideal customer: ${business.ideal_customer_description}.` : '',
        ` Be specific. Use web search, then call return_prospect.`,
        ` Writing rules: short sentences, no em dashes or en dashes, no words like "leverage" "streamline" "seamlessly" "game-changer" "tailored" "cutting-edge" "robust". Write like a real person who knows this business.`,
      ].join(''),
      tools: [
        { type: 'web_search_20250305' as const, name: 'web_search' },
        {
          name:        'return_prospect',
          description: 'Return structured prospect research',
          input_schema: {
            type:       'object' as const,
            properties: {
              company_name:  { type: 'string' },
              website:       { type: 'string' },
              location:      { type: 'string' },
              overview:      { type: 'string',  description: '1-2 short sentences about what they do. No em dashes.' },
              contact_name:  { type: 'string',  description: 'Key decision maker full name' },
              contact_title: { type: 'string' },
              email_format:  { type: 'string',  description: 'e.g. firstname@company.com' },
              pain_points:   { type: 'string',  description: 'One specific pain point relevant to our service. Plain English, one sentence.' },
              pitch_angle:   { type: 'string',  description: 'One sentence, plain English, no fluff. Sounds like a real person wrote it.' },
              email_subject: { type: 'string',  description: 'Under 8 words, no punctuation, no em dashes.' },
              email_body:    { type: 'string',  description: '3-4 sentences max. One specific pain point, one specific pitch, one CTA. No em dashes, no buzzwords.' },
            },
            required: ['company_name', 'overview', 'pain_points', 'pitch_angle', 'email_subject', 'email_body'],
          },
        },
      ],
      messages: [{
        role:    'user',
        content: `Research "${target}". Find contact info, identify a specific pain point relevant to ${business.main_service || 'our services'}, and draft a short cold email. No em dashes anywhere.`,
      }],
    })

    const toolCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_prospect'
    )
    if (!toolCall) return null
    return stripDashesFromObject(toolCall.input as Record<string, unknown>) as unknown as BatchResult
  } catch {
    return null
  }
}

// ── POST — kick off search, return runId immediately ──────────────────────────

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    query,
    business,
    existingCompanies = [],
    businessId,
  }: { query: string; business: Business; existingCompanies: string[]; businessId: string } = await req.json()

  if (!query)      return Response.json({ error: 'Query required' },      { status: 400 })
  if (!businessId) return Response.json({ error: 'businessId required' }, { status: 400 })

  const runId    = crypto.randomUUID()
  const supabase = createAdminClient()

  await supabase.from('agent_runs').insert({
    id:          runId,
    business_id: businessId,
    type:        'batch_search',
    status:      'running',
    total_tasks: 10,
    query,
  })

  after(async () => {
    const db = createAdminClient()
    try {
      // Step 1: identify real target companies
      const targets = await generateTargets(query, business, existingCompanies)

      await db.from('agent_runs').update({ total_tasks: targets.length }).eq('id', runId)

      const taskRows = targets.map(org => ({
        id:          crypto.randomUUID(),
        run_id:      runId,
        business_id: businessId,
        org_name:    org,
        status:      'pending' as const,
      }))
      await db.from('agent_tasks').insert(taskRows)

      // Step 2: researcher + scraper run in parallel per company
      let doneCount = 0
      await Promise.all(taskRows.map(async task => {
        await db.from('agent_tasks').update({ status: 'running' }).eq('id', task.id)

        const [researched, scraped] = await Promise.all([
          researchOneProspect(task.org_name, business),
          scrapeCompanyContact(task.org_name, null, business.main_service),
        ])

        if (researched) {
          // Merge scraper contact if researcher didn't find one
          if (!researched.contact_name && scraped.name) {
            researched.contact_name  = scraped.name
            researched.contact_title = scraped.title ?? researched.contact_title
          }
          if (!researched.email_format && scraped.email) {
            researched.email_format = scraped.email
          }
          await db.from('agent_tasks').update({ status: 'completed', result: researched }).eq('id', task.id)
        } else {
          await db.from('agent_tasks').update({ status: 'failed', error: 'Research failed' }).eq('id', task.id)
        }

        doneCount++
        if (doneCount >= targets.length) {
          await db.from('agent_runs').update({ status: 'done' }).eq('id', runId)
        }
      }))
    } catch {
      await db.from('agent_runs').update({ status: 'failed' }).eq('id', runId)
    }
  })

  return Response.json({ runId, total: 10 })
}

// ── GET — poll for status + completed results ─────────────────────────────────

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('runId')
  if (!runId) return Response.json({ error: 'runId required' }, { status: 400 })

  const supabase = createAdminClient()
  const [runRes, tasksRes] = await Promise.all([
    supabase.from('agent_runs').select('*').eq('id', runId).single(),
    supabase.from('agent_tasks').select('*').eq('run_id', runId).order('created_at'),
  ])

  const tasks     = tasksRes.data ?? []
  const run       = runRes.data
  const total     = run?.total_tasks ?? 10
  const completed = tasks.filter(t => t.status === 'completed').length
  const failed    = tasks.filter(t => t.status === 'failed').length
  const status    = run?.status ?? 'running'

  const results: BatchResult[] = tasks
    .filter(t => t.status === 'completed' && t.result)
    .map(t => t.result as BatchResult)

  return Response.json({ status, completed, failed, total, results })
}
