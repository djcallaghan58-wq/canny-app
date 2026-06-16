import { auth } from '@clerk/nextjs/server'
import { callAnthropic } from '@/lib/anthropic'
import { parseDraft } from '@/lib/parse-draft'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect, business } = await req.json()
  if (!prospect || !business) return Response.json({ error: 'Missing data' }, { status: 400 })

  const catalogText = business.catalog?.slice(0, 3)
    .map((c: { name: string; price: number; unit: string }) => `${c.name} ($${c.price} ${c.unit})`)
    .join(', ')

  const system = [
    `You write cold outreach emails for ${business.name}${business.industry ? `, a ${business.industry} company` : ''}.`,
    business.business_description       ? ` ${business.business_description}.`                           : '',
    catalogText                         ? ` What we sell: ${catalogText}.`                               : '',
    business.service_area               ? ` We serve: ${business.service_area}.`                        : '',
    ` Rules: short sentences, no em dashes or en dashes, no "leverage" "streamline" "seamlessly"`,
    ` "game-changer" "in today's world" "tailored" "cutting-edge" "robust".`,
    ` Write like a real person, direct and confident.`,
  ].join('')

  const contactLine = prospect.contact_name
    ? `${prospect.contact_name}${prospect.contact_title ? ` (${prospect.contact_title})` : ''} at ${prospect.company_name}`
    : prospect.company_name

  const prompt = [
    `Write a cold outreach email to ${contactLine}.`,
    ``,
    `Context:`,
    prospect.pain_points    ? `- Their pain point: ${prospect.pain_points}`        : '',
    prospect.pitch_angle    ? `- Pitch angle: ${prospect.pitch_angle}`             : '',
    prospect.talking_points ? `- Talking points: ${prospect.talking_points}`       : '',
    business.main_service   ? `- Our main service: ${business.main_service}`       : '',
    ``,
    `Rules:`,
    `- Subject: under 8 words, no punctuation, no dashes`,
    `- Body: 3-4 sentences max, one pain point, one pitch, one clear ask`,
    `- Blank line between paragraphs`,
    `- End with one question or call to action`,
    ``,
    `Return EXACTLY this format:`,
    `SUBJECT A: [subject line]`,
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
