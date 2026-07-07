import { auth } from '@clerk/nextjs/server'
import { callAnthropic } from '@/lib/anthropic'
import { parseDraft } from '@/lib/parse-draft'
import { frameworkRules, getActiveWritingStyle, voiceBlock } from '@/lib/email-framework'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect, business } = await req.json()
  if (!prospect || !business) return Response.json({ error: 'Missing data' }, { status: 400 })

  const catalogText = business.catalog?.slice(0, 3)
    .map((c: { name: string; price: number; unit: string }) => `${c.name} ($${c.price} ${c.unit})`)
    .join(', ')

  const style = await getActiveWritingStyle(business.id)

  // A prospect that's already been contacted (Contacted/Replied/Meeting Set/
  // Proposal) is getting a follow-up, not a cold open - use the follow-up
  // angle rules so the app doesn't just resend the same pitch.
  const stage = prospect.stage && prospect.stage !== 'New'
    ? 'follow_up' as const
    : 'first_touch' as const

  const system = [
    `You write cold outreach emails for ${business.name}${business.industry ? `, a ${business.industry} company` : ''}.`,
    business.business_description       ? ` ${business.business_description}.`                           : '',
    catalogText                         ? ` What we sell: ${catalogText}.`                               : '',
    business.service_area               ? ` We serve: ${business.service_area}.`                        : '',
    `\n\n${frameworkRules(stage)}`,
    voiceBlock(style),
  ].join('')

  const contactLine = prospect.contact_name
    ? `${prospect.contact_name}${prospect.contact_title ? ` (${prospect.contact_title})` : ''} at ${prospect.company_name}`
    : prospect.company_name

  const prompt = [
    stage === 'follow_up' ? `Write a follow-up email to ${contactLine}.` : `Write a cold outreach email to ${contactLine}.`,
    ``,
    `Context:`,
    prospect.pain_points     ? `- Their pain point: ${prospect.pain_points}`               : '',
    prospect.pitch_angle     ? `- Pitch angle: ${prospect.pitch_angle}`                    : '',
    prospect.talking_points  ? `- Talking points: ${prospect.talking_points}`              : '',
    prospect.company_overview ? `- What we know about them: ${prospect.company_overview}` : '',
    business.main_service    ? `- Our main service: ${business.main_service}`              : '',
    ``,
    `Follow the structure and hard rules from your instructions exactly.`,
    ``,
    `Return EXACTLY this format:`,
    `SUBJECT A: [subject line, under 8 words, no punctuation, no dashes]`,
    `SUBJECT B: [alternative subject line]`,
    ``,
    `[email body]`,
  ].filter(Boolean).join('\n')

  try {
    const response = await callAnthropic({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system:     [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: prompt }],
      businessId: business.id,
      endpoint:   'draft_email',
    })

    const raw = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { text: string }).text).join('')

    const parsed = parseDraft(raw)
    return Response.json({
      subject:  parsed.subject,
      subjectB: parsed.subjectB,
      body:     parsed.body,
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
