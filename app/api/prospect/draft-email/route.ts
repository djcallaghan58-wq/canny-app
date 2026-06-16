import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { stripDashes } from '@/lib/strip-dashes'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { prospect, business } = await req.json()
  if (!prospect || !business) return Response.json({ error: 'Missing data' }, { status: 400 })

  const system = [
    `You write cold outreach emails for ${business.name}${business.industry ? `, a ${business.industry} company` : ''}.`,
    business.business_description       ? ` About the business: ${business.business_description}.`   : '',
    business.ideal_customer_description ? ` Ideal customer: ${business.ideal_customer_description}.` : '',
    ` Rules: short sentences, no em dashes or en dashes, no "leverage" "streamline" "seamlessly" "game-changer" "tailored" "cutting-edge" "robust".`,
    ` Subject: under 8 words, no punctuation, no dashes.`,
    ` Body: 3-4 sentences max. One specific pain point, one specific pitch, one CTA. Sound like a real person.`,
  ].join('')

  const context = [
    `Write a cold outreach email to:`,
    `Company: ${prospect.company_name}`,
    prospect.contact_name   ? `Contact: ${prospect.contact_name}, ${prospect.contact_title}` : '',
    prospect.pain_points    ? `Their pain points: ${prospect.pain_points}` : '',
    prospect.pitch_angle    ? `Pitch angle: ${prospect.pitch_angle}` : '',
    prospect.talking_points ? `Talking points: ${prospect.talking_points}` : '',
    business.main_service   ? `Our main service: ${business.main_service}` : '',
    ``,
    `Return ONLY valid JSON: { "subject": "...", "body": "..." }`,
  ].filter(Boolean).join('\n')

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages:   [{ role: 'user', content: context }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('')

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return Response.json({
        subject: stripDashes(parsed.subject ?? ''),
        body:    stripDashes(parsed.body    ?? ''),
      })
    }

    return Response.json({ error: 'Could not generate email' }, { status: 422 })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
