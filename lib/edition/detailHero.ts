import type { KindredArticle } from "./article";

/**
 * Shared detail-page hero theme — the one place section accent colors, subtle
 * tints, category labels, and "About" labels are defined for the standardized
 * Kindred detail pages (Events, Activities, Food & Drinks, Local Deals).
 *
 * Section accent colors are fixed Kindred brand values and match the homepage.
 */
export type DetailHeroTheme = {
  /** Solid hero-card background. */
  accent: string;
  /** ~12% wash of the accent for the tinted "About" card. */
  tint: string;
  /** Small category pill text inside the hero. */
  categoryLabel: string;
  /** Heading for the tinted summary card, e.g. "About this activity". */
  aboutLabel: string;
  /** Fallback emoji when an item somehow lacks a category icon. */
  fallbackEmoji: string;
};

/** Fixed Kindred section accents (identical to the homepage). */
export const DETAIL_HERO_ACCENTS = {
  event: "#8EC5F5",
  activity: "#FFE791",
  recommendation: "#F4B6A6",
  deal: "#B7E4C7",
} as const;

/**
 * Single tunable knob for every detail "About" card tint — a soft, calm wash of
 * the hero accent. Not locked to an exact percentage: nudge this one value on a
 * real iPhone to taste ("1A" ≈ 10%, "1F" ≈ 12%, "24" ≈ 14%, "26" ≈ 15%).
 */
export const DETAIL_TINT_ALPHA = "1F";

/** Apply the shared detail tint to any accent color. */
export function detailTint(accent: string): string {
  return `${accent}${DETAIL_TINT_ALPHA}`;
}

/**
 * Trim a source summary to a quick overview — whole sentences only, ~60 words
 * max, up to four sentences. This shortens for readability without inventing,
 * exaggerating, or adding opinion: it only keeps the leading source sentences.
 */
export function toShortOverview(
  text: string | null | undefined,
  maxWords = 60
): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  const sentences =
    clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ??
    [clean];

  const picked: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    const count = sentence.split(/\s+/).filter(Boolean).length;
    if (picked.length >= 1 && words + count > maxWords) break;
    picked.push(sentence);
    words += count;
    if (picked.length >= 4) break;
  }

  return picked.join(" ").trim() || clean;
}

/**
 * Trim a source summary to ONE concise sentence for the Quick Overview card.
 * Keeps only the first source sentence (with a hard word cap as a safety net) —
 * it never invents, exaggerates, or stitches sentences together. This is a quick
 * factual introduction, not an article.
 */
export function toOneSentenceOverview(
  text: string | null | undefined,
  maxWords = 45
): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  const match = clean.match(/^[^.!?]+[.!?]/);
  let sentence = (match ? match[0] : clean).trim();

  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    sentence = `${words.slice(0, maxWords).join(" ")}…`;
  }
  return sentence || null;
}

/**
 * Trim a verified "why go" line for the "Known for" block — the warm, inviting
 * one-to-two sentences (roughly ≤50 words) that answer "why would someone want
 * to go?". Like the other trimmers, it ONLY shortens leading source sentences:
 * it never invents, exaggerates, or adds opinion. The source text must already
 * be verified editorial — Bandit's Note, a substantive listing summary, or
 * authored deal copy — so this function only makes it card-length.
 */
export function toKnownForBlurb(
  text: string | null | undefined,
  maxWords = 50
): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  const sentences =
    clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ??
    [clean];

  const picked: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    const count = sentence.split(/\s+/).filter(Boolean).length;
    if (picked.length >= 1 && (picked.length >= 2 || words + count > maxWords)) {
      break;
    }
    picked.push(sentence);
    words += count;
  }

  let result = picked.join(" ").trim() || clean;
  const resultWords = result.split(/\s+/).filter(Boolean);
  if (resultWords.length > maxWords) {
    result = `${resultWords.slice(0, maxWords).join(" ")}…`;
  }
  return result || null;
}

/**
 * Build the detail "About" section — one or two concise editorial paragraphs.
 *
 * Kindred Editorial Constitution V2: the About section explains the experience,
 * what makes it special, and who would enjoy it — in Kindred's own grounded
 * editorial voice, never verbatim provider text. This helper only SHORTENS and
 * selects from already-verified editorial paragraphs (a server-written `about`,
 * or Kindred's own composed body): it never invents, exaggerates, or stitches.
 *
 * Returns up to two trimmed paragraphs, skipping any that duplicate an `avoid`
 * line (e.g. the "Why you'll love it" blurb) so the card never repeats itself.
 */
export function toAboutParagraphs(
  source: string | string[] | null | undefined,
  options?: { maxParagraphs?: number; maxWordsEach?: number; avoid?: string | null }
): string[] {
  const maxParagraphs = options?.maxParagraphs ?? 2;
  const maxWordsEach = options?.maxWordsEach ?? 55;
  const avoidNorm = normalizeForCompare(options?.avoid ?? "");

  const raw = Array.isArray(source) ? source : source ? [source] : [];
  const out: string[] = [];
  for (const paragraph of raw) {
    if (out.length >= maxParagraphs) break;
    const trimmed = toShortOverview(paragraph, maxWordsEach);
    if (!trimmed) continue;
    const norm = normalizeForCompare(trimmed);
    if (norm.length < 12) continue;
    if (avoidNorm && overlapsNormalized(norm, avoidNorm)) continue;
    if (out.some((existing) => overlapsNormalized(normalizeForCompare(existing), norm))) {
      continue;
    }
    out.push(trimmed);
  }
  return out;
}

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** True when either normalized string contains the other (near-duplicate copy). */
function overlapsNormalized(a: string, b: string): boolean {
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 16) return false;
  return longer.includes(shorter);
}

/**
 * Resolve the hero theme for a discovery/event detail article. Returns null for
 * every other section (Story of, Today in History, News, Lead, Knowledge, …) so
 * those readers render exactly as before.
 */
export function detailHeroThemeForArticle(
  article: Pick<KindredArticle, "savedContentType" | "section">
): DetailHeroTheme | null {
  const type = article.savedContentType;

  if (type === "activity") {
    return {
      accent: DETAIL_HERO_ACCENTS.activity,
      tint: detailTint(DETAIL_HERO_ACCENTS.activity),
      categoryLabel: "Activity",
      aboutLabel: "About this activity",
      fallbackEmoji: "🎟️",
    };
  }

  if (type === "recommendation") {
    return {
      accent: DETAIL_HERO_ACCENTS.recommendation,
      tint: detailTint(DETAIL_HERO_ACCENTS.recommendation),
      categoryLabel: "Food & Drinks",
      aboutLabel: "About this place",
      fallbackEmoji: "🍽️",
    };
  }

  if (type === "event" || article.section === "local_events") {
    return {
      accent: DETAIL_HERO_ACCENTS.event,
      tint: detailTint(DETAIL_HERO_ACCENTS.event),
      categoryLabel: "Event",
      aboutLabel: "About this event",
      fallbackEmoji: "🎉",
    };
  }

  return null;
}
