import type { KindredArticle } from "./article";

/**
 * Version 1 — typography-first listings. No third-party listing photography on
 * Local Events, Activities, Recommendations, or Bandit's Pick.
 */
export function isV1TextOnlyListing(
  article: Pick<KindredArticle, "section" | "savedContentType">
): boolean {
  if (
    article.section === "local_events" ||
    article.section === "bandits_pick" ||
    article.section === "discovery"
  ) {
    return true;
  }
  const t = article.savedContentType;
  return t === "event" || t === "activity" || t === "recommendation";
}
