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
  event: "#81CDC6",
  activity: "#FFE791",
  recommendation: "#C2A9EF",
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
