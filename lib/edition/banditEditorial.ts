/**
 * Client fallback when an edition was built before full Bandit's Pick features
 * were persisted on the pick story.
 */

import type { BanditsPick } from "./bandit";

function momentIdFromPickId(id: string): string | null {
  const match = id.match(/^bandit_seasonal_(.+)$/);
  return match?.[1] ?? null;
}

export function enrichBanditsPickStory(
  story: BanditsPick["story"]
): BanditsPick["story"] {
  if (story.body?.length) return story;

  const momentId = momentIdFromPickId(story.id);
  const headline = story.headline?.trim() || "What's Special Right Now";
  const summary =
    story.summary?.trim() ||
    `${headline} arrives for a short window — easy to postpone, harder to catch once it passes.`;

  return {
    ...story,
    summary,
    body: [
      summary,
      `${headline} is one of those seasonal rhythms that does not announce itself loudly. It appears, peaks, and leaves while everyone is still meaning to get around to it.`,
      "Locals often learn the timing by repetition — a field that fills, a stand that opens, a neighborhood that quietly does something beautiful for two weeks and then stops.",
      "The practical advice is simple: go sooner than feels necessary. These moments rarely improve with delay.",
    ],
    modules: story.modules?.length
      ? story.modules
      : [
          {
            id: "best_time",
            label: "Best Time",
            body: "This week, before the season turns or the crowds arrive.",
          },
          {
            id: "why_now",
            label: "Why Now",
            body: "Seasonal windows open, peak, and close on their own calendar.",
          },
        ],
    closingNote:
      story.closingNote?.trim() ||
      "I have a feeling you'll be glad you didn't miss this one.",
    heroMomentId: story.heroMomentId ?? momentIdFromPickId(story.id),
    imageCaption: story.imageCaption,
    mapsQuery: story.mapsQuery?.trim() || momentId?.replace(/_/g, " ") || headline,
    actionLabel: story.actionLabel?.trim() || "Explore Nearby",
    nearby: story.nearby?.length ? story.nearby : undefined,
  };
}
