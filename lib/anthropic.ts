import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from './supabase-server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Approximate cost per million tokens in USD
const TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-opus-4-8':           { input: 15.00, output: 75.00 },
}

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = TOKEN_PRICES[model] ?? TOKEN_PRICES['claude-haiku-4-5-20251001']
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

async function checkSpendCap(businessId?: string): Promise<void> {
  const capUsd = parseFloat(process.env.SCOUT_DAILY_SPEND_CAP_USD ?? '0')
  if (!capUsd || !businessId) return

  const db      = createAdminClient()
  const today   = new Date().toISOString().split('T')[0]
  const { data } = await db
    .from('agent_logs')
    .select('cost_usd')
    .eq('business_id', businessId)
    .gte('created_at', `${today}T00:00:00Z`)

  const total = (data ?? []).reduce((sum, r) => sum + (parseFloat(String(r.cost_usd)) || 0), 0)
  if (total >= capUsd) {
    throw new Error(`Daily AI spend cap of $${capUsd} reached. Try again tomorrow.`)
  }
}

async function logUsage(
  businessId: string | undefined,
  model: string,
  endpoint: string | undefined,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  try {
    const db     = createAdminClient()
    const costUsd = estimateCostUsd(model, inputTokens, outputTokens)
    await db.from('agent_logs').insert({
      business_id:   businessId ?? null,
      model,
      endpoint:      endpoint ?? null,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      cost_usd:      costUsd,
    })
  } catch { /* non-critical */ }
}

type SystemParam = string | Anthropic.TextBlockParam[]

export interface CallAnthropicOptions {
  model:        string
  max_tokens:   number
  system?:      SystemParam
  tools?:       Anthropic.Tool[]
  messages:     Anthropic.MessageParam[]
  businessId?:  string
  endpoint?:    string
  timeoutMs?:   number
}

/**
 * Wrapper around client.messages.create with:
 * - Per-attempt abort timeout
 * - Automatic retry with exponential backoff on 429
 * - Usage logging to agent_logs table
 * - Optional daily spend cap via SCOUT_DAILY_SPEND_CAP_USD
 */
export async function callAnthropic(opts: CallAnthropicOptions): Promise<Anthropic.Message> {
  await checkSpendCap(opts.businessId)

  const MAX_RETRIES = 3
  let lastErr: unknown

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 45_000)

    try {
      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model:      opts.model,
        max_tokens: opts.max_tokens,
        messages:   opts.messages,
      }
      if (opts.system) params.system = opts.system as string
      if (opts.tools)  params.tools  = opts.tools

      const response = await client.messages.create(
        params,
        { signal: controller.signal } as Parameters<typeof client.messages.create>[1],
      )

      clearTimeout(timer)
      logUsage(
        opts.businessId,
        opts.model,
        opts.endpoint,
        response.usage.input_tokens,
        response.usage.output_tokens,
      )
      return response
    } catch (err) {
      clearTimeout(timer)
      lastErr = err

      const isRateLimit = err instanceof Anthropic.APIError && err.status === 429
      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 1_000 * 2 ** attempt))
        continue
      }
      throw err
    }
  }
  throw lastErr
}
