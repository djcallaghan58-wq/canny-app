import { after } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase-server'
import { scrapeCompanyContact } from '@/lib/research-scraper'
import { callAnthropic } from '@/lib/anthropic'
import { parseDraft } from '@/lib/parse-draft'
import { stripDashesFromObject } from '@/lib/strip-dashes'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const maxDuration = 300

// ── Types ─────────────────────────────────────────────────────────────────────

interface Business {
  name:                       string
  industry:                   string | null
  ideal_customer:             string | null
  ideal_customer_description: string | null
  business_description:       string | null
  main_service:               string | null
  city:                       string | null
  service_area?:              string | null
  catalog?:                   Array<{ name: string; price: number; unit: string }> | null
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
  email_subject_b?: string
  email_body:    string
}

// ── Copywriter rules (shared) ─────────────────────────────────────────────────

const WRITING_RULES = [
  `Writing rules: short sentences. No em dashes or en dashes (— –).`,
  `No "leverage", "streamline", "seamlessly", "game-changer", "in today's world",`,
  ` "look no further", "tailored", "cutting-edge", "robust".`,
  ` Write like a real person who knows this business.`,
].join('')

function buildEmailPrompt(
  companyName:   string,
  contactName:   string | null,
  painPoints:    string,
  pitchAngle:    string,
  business:      Business,
): string {
  const catalogText = business.catalog?.slice(0, 3).map(
    c => `${c.name} ($${c.price} ${c.unit})`
  ).join(', ')

  return [
    `Write a cold outreach email to ${contactName ? `${contactName} at ` : ''}${companyName}.`,
    ``,
    `Context:`,
    `- Their pain point: ${painPoints}`,
    `- Pitch angle: ${pitchAngle}`,
    business.main_service    ? `- Our service: ${business.main_service}` : '',
    catalogText              ? `- What we sell: ${catalogText}`          : '',
    business.business_description ? `- About us: ${business.business_description}` : '',
    business.service_area    ? `- We serve: ${business.service_area}`   : '',
    ``,
    `Rules:`,
    `- Subject: under 8 words, no punctuation, no dashes`,
    `- Body: 3-4 sentences max, one specific pain point, one specific pitch, one clear CTA`,
    `- Sound like a real person, not a marketing bot`,
    `- Blank line between paragraphs`,
    ``,
    `Return EXACTLY this format (no other text):`,
    `SUBJECT A: [subject line]`,
    `SUBJECT B: [alternative subject line]`,
    ``,
    `[email body]`,
  ].filter(s => s !== undefined).join('\n')
}

// ── Step 1: generate target company names ─────────────────────────────────────

async function generateTargets(
  query:            string,
  business:         Business,
  excludeCompanies: string[],
  businessId:       string,
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

// ── Step 2a: research one prospect (company + contact data) ───────────────────

async function researchProspectData(
  target:     string,
  business:   Business,
  businessId: string,
): Promise<{
  company_name: string; website: string; location: string; overview: string
  contact_name: string; contact_title: string; email_format: string
  pain_points: string; pitch_angle: string
} | null> {
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
        ` ${WRITING_RULES}`,
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
              overview:      { type: 'string', description: '1-2 short sentences. No em dashes.' },
              contact_name:  { type: 'string', description: 'Key decision maker full name' },
              contact_title: { type: 'string' },
              email_format:  { type: 'string', description: 'e.g. firstname@company.com' },
              pain_points:   { type: 'string', description: 'One specific pain point, one sentence, plain English.' },
              pitch_angle:   { type: 'string', description: 'One sentence, plain English, no fluff, sounds human.' },
            },
            required: ['company_name', 'overview', 'pain_points', 'pitch_angle'],
          },
        },
      ],
      messages: [{
        role:    'user',
        content: `Research "${target}". Find contact info and identify a specific pain point relevant to ${business.main_service || 'our services'}.`,
      }],
    })

    const toolCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_prospect'
    )
    return toolCall ? (toolCall.input as ReturnType<Awaited<typeof researchProspectData>>) : null
  } catch {
    return null
  }
}

// ── Step 2b: generate email copy (plain text, parsed with parseDraft) ─────────

async function generateEmailCopy(
  companyName:  string,
  contactName:  string | null,
  painPoints:   string,
  pitchAngle:   string,
  business:     Business,
  businessId:   string,
): Promise<{ subject: string; subjectB?: string; body: string }> {
  const fallback = { subject: `Quick question for ${companyName}`, body: pitchAngle }
  try {
    const response = await callAnthropic({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: [
        `You are a B2B copywriter for ${business.name}.`,
        business.business_description ? ` ${business.business_description}.` : '',
        ` ${WRITING_RULES}`,
      ].join(''),
      messages: [{
        role:    'user',
        content: buildEmailPrompt(companyName, contactName, painPoints, pitchAngle, business),
      }],
      businessId,
      endpoint: 'email_copy',
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('')

    return raw.trim() ? parseDraft(raw) : fallback
  } catch {
    return fallback
  }
}

// ── Combined: research + email ────────────────────────────────────────────────

async function researchOneProspect(
  target:     string,
  business:   Business,
  businessId: string,
): Promise<BatchResult | null> {
  // Run researcher + scraper in parallel
  const [data, scraped] = await Promise.all([
    researchProspectData(target, business, businessId),
    scrapeCompanyContact(target, null, business.main_service),
  ])
  if (!data) return null

  // Merge scraper contact if researcher came up empty
  if (!data.contact_name && scraped.name) {
    data.contact_name  = scraped.name
    data.contact_title = scraped.title ?? data.contact_title
  }
  if (!data.email_format && scraped.email) {
    data.email_format = scraped.email
  }

  // Generate email copy separately for better quality
  const emailCopy = await generateEmailCopy(
    data.company_name,
    data.contact_name || null,
    data.pain_points,
    data.pitch_angle,
    business,
    businessId,
  )

  const result: BatchResult = {
    ...data,
    email_subject:   emailCopy.subject,
    email_subject_b: emailCopy.subjectB,
    email_body:      emailCopy.body,
  }

  return stripDashesFromObject(result as unknown as Record<string, unknown>) as unknown as BatchResult
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
    id: runId, business_id: businessId, type: 'batch_search',
    status: 'running', total_tasks: 10, query,
  })

  after(async () => {
    const db = createAdminClient()
    try {
      const targets = await generateTargets(query, business, existingCompanies, businessId)
      await db.from('agent_runs').update({ total_tasks: targets.length }).eq('id', runId)

      const taskRows = targets.map(org => ({
        id: crypto.randomUUID(), run_id: runId,
        business_id: businessId, org_name: org, status: 'pending' as const,
      }))
      await db.from('agent_tasks').insert(taskRows)

      let doneCount = 0
      await Promise.all(taskRows.map(async task => {
        await db.from('agent_tasks').update({ status: 'running' }).eq('id', task.id)
        const result = await researchOneProspect(task.org_name, business, businessId)

        if (result) {
          await db.from('agent_tasks').update({ status: 'completed', result }).eq('id', task.id)
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

// ── GET — poll for status ─────────────────────────────────────────────────────

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
  const results   = tasks
    .filter(t => t.status === 'completed' && t.result)
    .map(t => t.result as BatchResult)

  return Response.json({ status, completed, failed, total, results })
}
