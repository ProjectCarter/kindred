/**
 * The content-type discriminator for a Kindred article. Tagged at creation
 * time in `article.ts` and read on the detail pages to drive hero theming,
 * image policy, and the section-specific action button.
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
