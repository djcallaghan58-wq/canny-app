import { stripDashes } from './strip-dashes'

export interface ParsedDraft {
  subject:  string
  subjectB?: string
  body:     string
}

/**
 * Parse an AI-generated email draft that follows the Engine Agent format:
 *   SUBJECT A: [subject line]
 *   SUBJECT B: [alt subject line]
 *
 *   [body text]
 *
 * Falls back gracefully to SUBJECT: prefix and then first-line heuristic.
 */
export function parseDraft(raw: string): ParsedDraft {
  const aMatch = raw.match(/^SUBJECT[_ ]A:\s*(.+)$/im)
  const bMatch = raw.match(/^SUBJECT[_ ]B:\s*(.+)$/im)

  if (aMatch) {
    const body = raw.replace(/^SUBJECT[_ ][AB]:\s*.+\n*/gim, '').trim()
    return {
      subject:  stripDashes(aMatch[1].trim()),
      subjectB: bMatch ? stripDashes(bMatch[1].trim()) : undefined,
      body:     stripDashes(body),
    }
  }

  const sMatch = raw.match(/^SUBJECT:\s*(.+)$/im)
  if (sMatch) {
    return {
      subject: stripDashes(sMatch[1].trim()),
      body:    stripDashes(raw.replace(/^SUBJECT:\s*.+\n*/im, '').trim()),
    }
  }

  const lines = raw.trim().split('\n')
  return {
    subject: stripDashes(lines[0] ?? ''),
    body:    stripDashes(lines.slice(1).join('\n').trim()),
  }
}
