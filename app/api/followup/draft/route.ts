import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { item, business, isReactivation, followUpNumber } = await req.json()
  if (!item || !business) return Response.json({ error: 'Missing data' }, { status: 400 })

  const bizContext = [
    `You are writing on behalf of ${business.name}${business.industry ? `, a ${business.industry} company` : ''}.`,
    business.main_service        ? ` Their main service: ${business.main_service}.`               : '',
    business.business_description ? ` About the business: ${business.business_description}.`      : '',
  ].join('')

  let prompt: string

  if (isReactivation) {
    prompt = [
      `Write a warm, friendly reactivation email.`,
      `Previous customer/prospect: ${item.company_name}`,
      item.contact_name           ? `Contact: ${item.contact_name}`                               : '',
      item.service_type           ? `Previous service/job: ${item.service_type}`                  : '',
      `Days since last contact: ${item.days_since_contact}`,
      ``,
      `The email should:`,
      `- Reference the previous working relationship naturally`,
      `- Feel like a warm check-in, not a cold sales pitch`,
      `- Be short (under 120 words in body)`,
      `- Mention that you'd love to work together again`,
      ``,
      `Return ONLY valid JSON: { "subject": "...", "body": "..." }`,
    ].filter(Boolean).join('\n')
  } else {
    const ordinals = ['first', 'second', 'third']
    const ordinal  = ordinals[(followUpNumber ?? 1) - 1] ?? 'follow-up'
    prompt = [
      `Write a ${ordinal} follow-up email.`,
      `Prospect/customer: ${item.company_name}`,
      item.contact_name    ? `Contact: ${item.contact_name}`                          : '',
      item.service_type    ? `Regarding: ${item.service_type}`                        : '',
      item.stage           ? `Current stage: ${item.stage}`                           : '',
      `Days overdue for follow-up: ${item.days_overdue}`,
      ``,
      `The email should:`,
      `- Acknowledge the time since last contact naturally`,
      `- Reference the previous conversation/quote briefly`,
      `- Include a clear, low-pressure next step`,
      `- Be short (under 120 words in body)`,
      followUpNumber === 3 ? `- This is the third follow-up; keep it brief and give them an easy out` : '',
      ``,
      `Return ONLY valid JSON: { "subject": "...", "body": "..." }`,
    ].filter(Boolean).join('\n')
  }

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [{ type: 'text', text: bizContext, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text).join('')

    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return Response.json({ subject: parsed.subject, body: parsed.body })
    }
    return Response.json({ error: 'Could not generate email' }, { status: 422 })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
