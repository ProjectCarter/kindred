/**
 * Shared newspaper style rules for every Kindred editorial AI prompt
 * (Morning Edition, Bandit, and the general section writer).
 *
 * One editor, one style guide: numbers and dates should read like a
 * professionally copy-edited paper, not a voice assistant transcript.
 * Fixing it here means every future edition benefits automatically —
 * no per-section hardcoded copy required.
 */
export const NEWSPAPER_STYLE_RULES =
  "Style guide — numbers and dates: write temperatures exactly as given, as numerals with the " +
  "degree mark (e.g. \"106°\", \"78°F\") — never spell them out (\"one-oh-six\", \"one hundred six " +
  "degrees\"). Write dates the way a masthead does (e.g. \"Monday, July 13\") — never spell out " +
  "ordinals (\"July thirteenth\"). " +
  "Style guide — prose: turn any numbers or grounding data into one flowing sentence, never a " +
  "data readout (avoid \"Current: X. High/low: Y/Z.\"). Cut every word that doesn't earn its place. " +
  "Write like an experienced print editor, not a voice assistant — calm, warm, economical, never robotic.";

/**
 * The edition is generated once, hours before a reader might open it at any
 * time of day — so no AI-written text can reliably know whether it's
 * actually morning, afternoon, evening, or night for that specific reader.
 * The app's own clock-driven salutation owns that job. This is a defensive
 * strip, not the primary fix: prompts already forbid time-of-day greetings,
 * but a model can still slip one in, and a stale/older greeting stored in
 * the database should also never show wrong-time copy.
 */
const LEADING_SALUTATION = /^(good\s+(morning|afternoon|evening|night)|hello|hi|hey)\b[,.!—-]*\s*/i;

export function stripLeadingSalutation(text: string): string {
  const stripped = text.replace(LEADING_SALUTATION, "").trimStart();
  if (stripped === text || !stripped) return stripped;
  // Re-capitalize what is now the first word of the sentence.
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
