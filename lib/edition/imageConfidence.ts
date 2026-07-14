/**
 * Guards against the category-photo mismatches that hurt trust the most —
 * a single wrong-but-specific stock photo (a beach for a country club, a
 * skyline for a rock shop) reads as more broken than a tasteful, honest
 * placeholder would. When a venue's own text doesn't corroborate the
 * category it landed in, callers should fall back to a neutral photo
 * rather than force a scene-specific image that may not apply.
 */

const CATEGORY_TEXT_HINTS: Partial<Record<string, RegExp>> = {
  beaches: /beach|shore|coast|bay\b|lakefront|waterfront/i,
  museums: /museum|gallery|exhibit|history center|science center|planetarium|aquarium|heritage/i,
  gardens: /garden|arboretum|conservatory|botanical/i,
  parks: /\bpark\b|preserve|trail|green ?space|nature area|refuge|forest/i,
  scenic_drives: /overlook|viewpoint|scenic|lookout|vista|byway/i,
  coffee: /coffee|café|cafe|espresso|roaster|tea ?house/i,
  restaurants: /restaurant|kitchen|grill|bistro|eatery|diner|tavern|steakhouse|pizzeria|cantina|brasserie/i,
  bakeries: /bak(e|ing|ery)|patisserie|pastry|bread/i,
  hiking: /trail|hike|hiking|summit|ridge|peak/i,
};

/** When category text actively contradicts the bucket, reject scene-specific art. */
const CATEGORY_CONTRADICTIONS: Partial<Record<string, RegExp>> = {
  beaches: /country club|golf club|rock shop|gem shop|mineral|jewelry|antique|hardware|pharmacy|bank\b|insurance/i,
  museums: /rock shop|gem shop|mineral|jewelry|antique mall|hardware|pharmacy|coffee|café|cafe/i,
  restaurants: /coffee|café|cafe|espresso|roaster|bakery|bake shop/i,
  coffee: /restaurant|steakhouse|grill|pizzeria|diner|tavern/i,
  scenic_drives: /rock shop|gem shop|indoor|mall\b|plaza\b|retail|dog park|observatory|planetarium|restaurant|neighborhood/i,
  parks: /restaurant|coffee|bowling|escape room|country club|observatory/i,
  hiking: /restaurant|coffee shop|bowling|country club|indoor mall/i,
};

/**
 * True when the item's own copy (title/dek/venue category text) either
 * corroborates the assigned category or gives us nothing to contradict it
 * with. False only when the text actively points somewhere else — e.g. a
 * "Rock & Gem Shop" bucketed under `museums` — so a wrong specific photo
 * never gets forced onto content that doesn't actually match it.
 */
export function categoryImageIsConfident(
  category: string,
  item: {
    title?: string | null;
    dek?: string | null;
    venueCategories?: string[] | null;
  }
): boolean {
  const hint = CATEGORY_TEXT_HINTS[category];
  if (!hint) return true;

  const hay = [item.title, item.dek, ...(item.venueCategories ?? [])]
    .filter(Boolean)
    .join(" ");
  if (!hay.trim()) return true;

  const contradiction = CATEGORY_CONTRADICTIONS[category];
  if (contradiction?.test(hay)) return false;

  return hint.test(hay);
}
