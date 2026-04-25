/**
 * Split long text into TTS-safe chunks.
 *
 * Prefers sentence boundaries (. ! ?), falls back to comma, then
 * word-boundary hard split. Output chunks each respect `maxChars`
 * where possible.
 *
 * Pattern adapted from AB project `src/lib/audio-generator.ts:139-168`.
 */
export function chunkText(text: string, maxChars = 400): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let remaining = trimmed;

  while (remaining.length > maxChars) {
    // Try to split at last sentence-ending punctuation inside [0, maxChars]
    const slice = remaining.slice(0, maxChars);
    let cut = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
    if (cut > 0) {
      cut += 1; // keep the punctuation
    } else {
      // Fall back to comma
      cut = slice.lastIndexOf(", ");
      if (cut > 0) cut += 1;
    }
    if (cut < 0) {
      // Fall back to word boundary
      cut = slice.lastIndexOf(" ");
      if (cut < 0) cut = maxChars;
    }
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);

  return chunks;
}
