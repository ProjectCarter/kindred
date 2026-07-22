/**
 * The four things a reader can save to their personal Clippings collection.
 * Shared between `article.ts` (tags content at creation time) and
 * Used by Save (likes) eligibility — see `saveTarget.ts`.
 */
export type ClippingContentType =
  | "article"
  | "event"
  | "activity"
  | "recommendation";

export const CLIPPING_CONTENT_TYPES: ClippingContentType[] = [
  "article",
  "event",
  "activity",
  "recommendation",
];

export const CLIPPING_TYPE_LABEL: Record<ClippingContentType, string> = {
  article: "Article",
  event: "Event",
  activity: "Activity",
  recommendation: "Food & Drink",
};
