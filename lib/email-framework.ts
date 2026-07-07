import { createAdminClient } from './supabase-server'
import type { WritingStyleRow } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Shared cold-email framework — single source of truth for every AI endpoint
// that drafts an email (first-touch, on-demand redraft, follow-up, breakup,
// reactivation). Built from Jeremy Miner's NEPQ questioning framework and the
// working playbooks of top cold-email practitioners (Josh Braun, Alex Berman).
//
// The rule of thumb used throughout Salevo: STRUCTURE is fixed for every
// business. VOICE (greeting, sign-off, tone, phrasing) adapts per-business
// from that business's active writing style. Never let voice override
// structure — see `frameworkRules()` + `voiceBlock()` below.
// ─────────────────────────────────────────────────────────────────────────────

export const BANNED_PHRASES = [
  'leverage', 'streamline', 'seamlessly', 'seamless', 'synergy', 'game-changer',
  "in today's world", 'look no further', 'tailored', 'cutting-edge', 'robust',
  'best-in-class', 'industry-leading', 'world-class', 'state-of-the-art',
  'unlock', 'revolutionize', 'passionate', 'full-service', 'circle back',
  'touch base', 'just checking in', 'just following up', 'per my last email',
  'just wanted to', 'i wanted to reach out', "hope you're doing well",
  'hope this finds you well',
]

export type EmailStage = 'first_touch' | 'follow_up' | 'breakup' | 'reactivation'

/**
 * Core structural rules every drafted email must follow, regardless of whose
 * voice it's written in. This replaces the old "who we are -> what we offer ->
 * can we meet" pattern with: personalized hook -> problem-poke question ->
 * meaningfully-different line -> low-friction CTA -> short sign-off.
 */
export function frameworkRules(stage: EmailStage): string {
  const banned = BANNED_PHRASES.map(p => `"${p}"`).join(', ')

  const lines = [
    `Write the email using this structure, in this order:`,
    `1. A personalized hook (1 line) - a specific, checkable detail about them or their situation. Never generic ("I came across your business").`,
    `2. A problem-poke question - name ONE specific, recognizable problem in plain language, before any mention of what you sell. Ask, don't tell: people trust conclusions they reach themselves far more than ones you hand them. Surface the cost of doing nothing (time, money, a missed deadline, credibility) instead of listing benefits.`,
    `3. One sentence on what you do differently - framed as a before/after or "without X", never a features list. Never claim to be "the best" or "#1" or "leading" unless it's tied to one specific, named comparison - every competitor already makes that claim, so it reads as noise.`,
    `4. A low-friction call to action - a yes/no question ("worth a look?", "open to it?", "worth exploring?"). Never ask for a meeting or a block of time on a first touch.`,
    `5. A short, human sign-off. No long signature block, no title/company/phone/website stacked underneath.`,
    ``,
    `Hard rules:`,
    `- 50-125 words in the body.`,
    `- Never use these words or phrases: ${banned}.`,
    `- No em dashes or en dashes.`,
    `- Write for one specific person, not a persona. Use "you" far more than "I".`,
    `- Sound like a real person who understands the problem, not a marketing template.`,
  ]

  if (stage === 'follow_up') {
    lines.push(
      ``,
      `This is a follow-up email. It must introduce a NEW problem or angle the first email didn't cover - never restate the first email or say "just following up" or "wanted to bump this to the top of your inbox".`,
    )
  }

  if (stage === 'breakup') {
    lines.push(
      ``,
      `This is the final touch in the sequence. Keep it to 1-3 sentences total. Assume the timing is off or it's already handled - give a graceful, genuine exit (a "detach" / breakup email), not a fifth nudge. End on a short, warm, genuine note.`,
    )
  }

  if (stage === 'reactivation') {
    lines.push(
      ``,
      `This is a reactivation email to a past customer or contact. Warm, not salesy - reference the past relationship naturally. Under 120 words.`,
    )
  }

  return lines.join('\n')
}

/**
 * Fetches the business's active writing style (from the writing_styles table -
 * the one users train via "Analyze My Writing" / "Train My Style"). Returns
 * null if the business has no active style yet, in which case emails fall
 * back to framework defaults only.
 */
export async function getActiveWritingStyle(
  businessId: string | undefined | null,
): Promise<WritingStyleRow | null> {
  if (!businessId) return null
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('writing_styles')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle()
    return (data as WritingStyleRow) ?? null
  } catch {
    return null
  }
}

/**
 * Formats a business's active style as a "voice" instruction block. This is
 * additive on top of frameworkRules() - it should shape greeting, sign-off,
 * tone, and phrasing, but never override the structure or hard rules.
 */
export function voiceBlock(style: WritingStyleRow | null): string {
  if (!style) return ''
  const bits = [
    `\n\nMatch this person's own voice for tone, greeting, sign-off, and phrasing - but never let it override the structure or hard rules above:`,
    style.tone ? `- Tone: ${style.tone}` : '',
    style.greeting ? `- Greeting style: ${style.greeting}` : '',
    style.sign_off ? `- Sign-off: ${style.sign_off}` : '',
    style.key_phrases?.length ? `- Phrases they actually use: ${style.key_phrases.map(p => `"${p}"`).join(', ')}` : '',
    style.sample_text ? `- Style notes: ${style.sample_text}` : '',
  ].filter(Boolean)
  return bits.join('\n')
}
