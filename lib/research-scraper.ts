import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ScraperResult {
  name:   string | null
  title:  string | null
  email:  string | null
  source: 'website_scrape'
}

export async function scrapeCompanyContact(
  companyName: string,
  website:     string | null,
  mainService: string | null,
): Promise<ScraperResult> {
  const empty: ScraperResult = { name: null, title: null, email: null, source: 'website_scrape' }
  try {
    const siteHint = website ? ` Their website is ${website}.` : ''
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     `You find B2B contact information by searching company websites. Look for staff pages, team pages, leadership pages, and contact pages.`,
      tools: [
        { type: 'web_search_20250305' as const, name: 'web_search' },
        {
          name:        'return_contact',
          description: 'Return the key decision-maker found on the company website',
          input_schema: {
            type:       'object' as const,
            properties: {
              name:  { type: 'string', description: 'Full name of the decision-maker' },
              title: { type: 'string', description: 'Job title' },
              email: { type: 'string', description: 'Email address if found, otherwise null' },
            },
            required: ['name'],
          },
        },
      ],
      messages: [{
        role:    'user',
        content: `Find the key decision-maker at ${companyName}.${siteHint} Search their website's staff, team, leadership, or contact pages. Return the most relevant contact for selling ${mainService || 'B2B services'}.`,
      }],
    })

    const toolCall = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'return_contact'
    )
    if (!toolCall) return empty
    const input = toolCall.input as { name?: string; title?: string; email?: string }
    return {
      name:   input.name   ?? null,
      title:  input.title  ?? null,
      email:  input.email  ?? null,
      source: 'website_scrape',
    }
  } catch {
    return empty
  }
}
