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
