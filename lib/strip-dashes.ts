/**
 * Replace em dashes and en dashes in AI-generated text.
 * Order matters — most specific patterns first.
 */
export function stripDashes(text: string): string {
  if (!text) return text
  return text
    .replace(/ — /g, ', ')   // inline em dash → comma
    .replace(/— /g, '')       // leading em dash → nothing
    .replace(/ —/g, '')       // trailing em dash → nothing
    .replace(/—/g, ', ')      // remaining em dash → comma
    .replace(/ – /g, ', ')    // inline en dash → comma
    .replace(/– /g, '')       // leading en dash → nothing
    .replace(/ –/g, '')       // trailing en dash → nothing
    .replace(/–/g, ', ')      // remaining en dash → comma
    .replace(/ ,/g, ',')      // tidy up stray space before comma
    .replace(/,,/g, ',')      // tidy up double comma
    .replace(/  +/g, ' ')     // collapse double spaces
}

/** Apply stripDashes to every string field of an object (one level deep). */
export function stripDashesFromObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj }
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      result[key] = stripDashes(result[key] as string)
    }
  }
  return result
}
