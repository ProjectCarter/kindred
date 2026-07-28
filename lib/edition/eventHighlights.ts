import type { LocalEventCard, LocalEventCategory } from "./localEvents";
import type { EventInfoBadgeId } from "./eventBadges";

/**
 * "Why you'll love it" highlights for the event detail page.
 *
 * These are short, benefit-first lines that answer "why would I enjoy going?" —
 * NOT the venue, address, or date. Per the Kindred Editorial Constitution they
 * are never invented: each line is derived only from already-verified structured
 * signals frozen on the event at edition build time — the provider's utility
 * badges and the keyword-inferred category. When there is no verified signal to
 * stand behind, nothing is emitted and the screen falls back to the editorial
 * "why go" blurb.
 */

/** Positive, benefit-first line for each verified utility badge. */
const BADGE_HIGHLIGHT: Partial<Record<EventInfoBadgeId, string>> = {
  free: "Free to attend",
  live_music: "Live music sets the mood",
  food_drinks: "Food and drinks on site",
  dog_friendly: "Dog friendly — bring the pup",
  free_parking: "Free parking makes it easy",
  // tickets_required is a logistics note, not a reason to love it — omitted.
};

/** A single character-of-the-category line, used to round out the list. */
const CATEGORY_HIGHLIGHT: Record<LocalEventCategory, string> = {
  music: "Live entertainment and a lively atmosphere",
  comedy: "A night of laughs out",
  arts: "A dose of local arts and culture",
  family: "Great for the whole family",
  sports: "Cheer on the action in person",
  food: "Local flavors and vendors to explore",
  market: "Browse local makers and vendors",
  nightlife: "A relaxed night out with friends",
  community: "A chance to connect with your community",
};

/**
 * When a category line would just echo a badge line, prefer the concrete badge
 * and skip the category duplicate.
 */
const CATEGORY_COVERED_BY_BADGE: Partial<
  Record<LocalEventCategory, EventInfoBadgeId>
> = {
  music: "live_music",
  food: "food_drinks",
};

/**
 * Build up to `max` verified highlights for an event. Badges lead (most
 * concrete), then one category line rounds out the list. Returns an empty array
 * when there is nothing verified to say.
 */
export function buildEventHighlights(
  event: Pick<LocalEventCard, "badges" | "category">,
  max = 4
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (line: string | undefined | null) => {
    if (!line) return;
    if (out.length >= max) return;
    if (seen.has(line)) return;
    seen.add(line);
    out.push(line);
  };

  const badges = event.badges ?? [];
  for (const badge of badges) {
    push(BADGE_HIGHLIGHT[badge]);
  }

  const category = event.category;
  if (category) {
    const covering = CATEGORY_COVERED_BY_BADGE[category];
    const alreadyCovered = covering ? badges.includes(covering) : false;
    if (!alreadyCovered) {
      push(CATEGORY_HIGHLIGHT[category]);
    }
  }

  return out;
}
