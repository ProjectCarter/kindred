/**
 * Today in History card copy — intro paragraph for the homepage card.
 */

const INTRO_MIN_WORDS = 80;
const INTRO_MAX_WORDS = 140;

function words(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
}

/** First 80–140 words for the card intro; never cuts mid-sentence when possible. */
export function historyCardIntro(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const allWords = words(cleaned);
  if (allWords.length <= INTRO_MAX_WORDS) return cleaned;

  const slice = allWords.slice(0, INTRO_MAX_WORDS).join(" ");
  const lastStop = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );

  if (lastStop > 0 && words(slice.slice(0, lastStop + 1)).length >= INTRO_MIN_WORDS) {
    return slice.slice(0, lastStop + 1).trim();
  }

  return `${allWords.slice(0, INTRO_MAX_WORDS).join(" ")}…`;
}
