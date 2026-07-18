/**
 * Resolve English-facing masterpiece titles for homepage and article display.
 * Original titles are preserved for the full article when they differ.
 */

export type MasterpieceDisplayTitle = {
  /** Primary English title for readers. */
  displayTitle: string;
  /** Original title in native script or alternate name — article only. */
  originalTitle: string | null;
};

/** Non-Latin scripts where an English catalog entry is preferred when available. */
const NON_LATIN_TITLE =
  /[\u3000-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0590-\u05ff]/;

function normalizeTitleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[''""`´]/g, "")
    .replace(/[・·]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Well-established English titles keyed by normalized original or alternate names.
 * When in doubt, omit — never guess an English title.
 */
const ENGLISH_TITLE_BY_KEY: Record<string, string> = {
  // Hokusai — The Great Wave
  "神奈川沖浪裏": "The Great Wave off Kanagawa",
  "神奈川冲浪里": "The Great Wave off Kanagawa",
  "under the wave off kanagawa": "The Great Wave off Kanagawa",
  "under the great wave off kanagawa": "The Great Wave off Kanagawa",
  "the great wave off kanagawa": "The Great Wave off Kanagawa",
  "great wave off kanagawa": "The Great Wave off Kanagawa",
  "kanagawa oki nami ura": "The Great Wave off Kanagawa",

  // Leonardo — Mona Lisa
  "モナ・リザ": "Mona Lisa",
  "モナリザ": "Mona Lisa",
  "la joconde": "Mona Lisa",
  "la gioconda": "Mona Lisa",
  "mona lisa": "Mona Lisa",

  // Velázquez — already common in English
  "las meninas": "Las Meninas",
  "las hilanderas": "The Spinners",
  "the spinners (las hilanderas)": "The Spinners",

  // Van Gogh — German title only; English forms pass through unchanged
  "die sternennacht": "The Starry Night",
  "sternennacht": "The Starry Night",
  "the starry night": "The Starry Night",
  "sternenklare nacht": "Starry Night Over the Rhône",

  // Monet — common French titles
  "impression, soleil levant": "Impression, Sunrise",
  "impression soleil levant": "Impression, Sunrise",
  "les nympheas": "Water Lilies",
  "les nymphes": "Water Lilies",
  "nympheas": "Water Lilies",
  "water lilies": "Water Lilies",
  "le dejeuner sur l'herbe": "Luncheon on the Grass",
  "dejeuner sur l'herbe": "Luncheon on the Grass",

  // Delacroix / French history painting
  "la liberte guidant le peuple": "Liberty Leading the People",

  // Vermeer
  "het meisje met de parel": "Girl with a Pearl Earring",
  "girl with a pearl earring": "Girl with a Pearl Earring",

  // Munch
  "der schrei der natur": "The Scream",
  "the scream": "The Scream",

  // Hiroshige / other ukiyo-e
  "東海道五十三次 蒲原 夜之雪": "Night Snow at Kambara",
  "蒲原 夜之雪": "Night Snow at Kambara",
  "night snow at kambara": "Night Snow at Kambara",
  "赤富士": "Fine Wind, Clear Morning",
  "fine wind, clear morning": "Fine Wind, Clear Morning",
  "south wind, clear sky": "Fine Wind, Clear Morning",

  // Raphael
  "scuola di atene": "The School of Athens",
  "the school of athens": "The School of Athens",

  // Botticelli
  "nascita di venere": "The Birth of Venus",
  "the birth of venus": "The Birth of Venus",
  "primavera": "Primavera",

  // Michelangelo
  "creazione di adamo": "The Creation of Adam",
  "the creation of adam": "The Creation of Adam",

  // Whistler
  "arrangement in grey and black no. 1": "Whistler's Mother",
  "whistlers mother": "Whistler's Mother",

  // Wood
  "american gothic": "American Gothic",
};

function titleBaseBeforeSeriesNote(title: string): string {
  return title
    .split(/\s*[,，]\s*|\s+from the series\b/i)[0]
    ?.trim() ?? title;
}

function lookupEnglishTitle(stored: string): string | null {
  const trimmed = stored.trim();
  if (!trimmed) return null;

  const direct = ENGLISH_TITLE_BY_KEY[normalizeTitleKey(trimmed)];
  if (direct) return direct;

  const base = titleBaseBeforeSeriesNote(trimmed);
  if (base !== trimmed) {
    const fromBase = ENGLISH_TITLE_BY_KEY[normalizeTitleKey(base)];
    if (fromBase) return fromBase;
  }

  return null;
}

function titlesAreEquivalent(a: string, b: string): boolean {
  return normalizeTitleKey(a) === normalizeTitleKey(b);
}

/** Resolve homepage/article display title and optional original for the reader. */
export function resolveMasterpieceDisplayTitle(
  storedTitle: string | null | undefined
): MasterpieceDisplayTitle {
  const stored = storedTitle?.trim() ?? "";
  if (!stored) {
    return { displayTitle: "Untitled artwork", originalTitle: null };
  }

  const english = lookupEnglishTitle(stored);
  const displayTitle = english ?? stored;

  const mappedFromNonLatin =
    Boolean(english) && NON_LATIN_TITLE.test(stored);
  const mappedFromAlternateName =
    Boolean(english) && !titlesAreEquivalent(stored, displayTitle);

  const originalTitle =
    mappedFromNonLatin || mappedFromAlternateName ? stored : null;

  return { displayTitle, originalTitle };
}
