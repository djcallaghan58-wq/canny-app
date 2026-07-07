import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@clerk/nextjs/server'
import { stripDashes } from '@/lib/strip-dashes'
import { frameworkRules, getActiveWritingStyle, voiceBlock } from '@/lib/email-framework'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { item, business, isReactivation, followUpNumber } = await req.json()
  if (!item || !business) return Response.json({ error: 'Missing data' }, { status: 400 })

  const style = await getActiveWritingStyle(business.id)

  // 3rd follow-up = detach/breakup framing, not a fifth nudge.
  const stage = isReactivation ? 'reactivation' as const
    : followUpNumber === 3 ? 'breakup' as const
    : 'follow_up' as const

  const bizContext = [
    `You are writing on behalf of ${business.name}${business.industry ? `, a ${business.industry} company` : ''}.`,
    business.main_service         ? ` Their main service: ${business.main_service}.`          : '',
    business.business_description ? ` About the business: ${business.business_description}.`  : '',
    `\n\n${frameworkRules(stage)}`,
    voiceBlock(style),
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
      `Reference the previous working relationship naturally - a specific detail, not a generic "it's been a while". Mention you'd love to work together again.`,
      ``,
      `Follow the structure and hard rules from your instructions exactly.`,
      ``,
      `Return ONLY valid JSON: { "subject": "...", "body": "..." }`,
    ].filter(Boolean).join('\n')
  } else {
    const ordinals = ['first', 'second', 'third']
    const ordinal  = ordinals[(followUpNumber ?? 1) - 1] ?? 'follow-up'
    prompt = [
      `Write the ${ordinal} follow-up email in this sequence.`,
      `Prospect/customer: ${item.company_name}`,
      item.contact_name    ? `Contact: ${item.contact_name}`                          : '',
      item.service_type    ? `Regarding: ${item.service_type}`                        : '',
      item.stage           ? `Current stage: ${item.stage}`                           : '',
      `Days overdue for follow-up: ${item.days_overdue}`,
      ``,
      followUpNumber === 3
        ? `This is the last follow-up in the sequence - write the breakup/detach email per your instructions, not another nudge.`
        : `Reference the previous conversation/quote briefly, then pivot to a new angle or problem - don't just restate the last email.`,
      ``,
      `Follow the structure and hard rules from your instructions exactly.`,
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
