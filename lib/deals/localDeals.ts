/**
 * Deals — Version 1 editorial data model.
 *
 * This module is the single source of truth for the Deals desk. The placeholder
 * catalog that was used during UI development has been removed — the desk now
 * ships with zero deals until a verified affiliate feed lands. When that feed
 * arrives it should produce the same `LocalDeal` shape and populate `DEALS`
 * (and, optionally, `FEATURED_ORDER`); no UI changes are required.
 *
 * While `DEALS` is empty the homepage Deals section renders nothing (no header,
 * no empty state) and the See All screen reports an empty catalog.
 *
 * No network, no affiliate SDKs, no monetization logic — presentation data only.
 */

/** The eight browsable Deals categories (See All grouping order). */
export type DealCategoryId =
  | "things_to_do"
  | "restaurants"
  | "coffee_dessert"
  | "breweries_wine"
  | "shopping"
  | "entertainment"
  | "hotels_staycations"
  | "travel_transportation";

export type DealCategory = {
  id: DealCategoryId;
  /** Section title shown on the See All page. */
  title: string;
  /** One permanent category emoji (Kindred visual-language aligned). */
  emoji: string;
  /** Soft pastel used for image panels and category tinting. */
  accent: string;
};

/**
 * A single curated deal. `imageUrl` is null when no authorized merchant
 * photography is available — the UI renders an elegant branded panel instead of
 * a fabricated photo. When authorized photography is available it slots straight
 * in here.
 */
export type LocalDeal = {
  id: string;
  category: DealCategoryId;
  /** Most specific editorial emoji for this deal (homepage identifier). */
  emoji: string;
  /** Merchant / venue name. */
  merchant: string;
  /** Headline offer — the deal itself (e.g. "Buy One Get One Pizza"). */
  title: string;
  /** Short savings badge for cards (e.g. "BOGO", "20% off", "Free side"). */
  savingsLabel: string;
  /** Editorial description — why this is worth it (verified-safe, no invented claims). */
  description: string;
  /** Plain-language savings summary shown on the detail page. */
  savingsDetail: string;
  /**
   * Editorial "Known for" — the warm, local-friend reason to visit (roughly
   * 20–50 words). It answers "why would someone want to go here?", not what the
   * offer is.
   */
  knownFor: string;
  /**
   * "Offer Includes" highlight bullets for the detail overview — short factual
   * points drawn from this deal's own terms. Omit when there is nothing to list.
   */
  highlights?: string[];
  /** Human expiration line, when known. */
  expiration?: string | null;
  /** City used for the Google Maps search + card location line. */
  city: string;
  /** Official website — null when absent (button hidden when absent). */
  website?: string | null;
  /** Optional terms & conditions shown on the detail page. */
  terms?: string | null;
  /** Authorized photo, when available. Null renders a branded panel. */
  imageUrl?: string | null;
};

/** Homepage Deals accent — one soft-green square for every row. */
export const LOCAL_DEALS_HOMEPAGE_ACCENT = "#B7E4C7";

export const DEAL_CATEGORIES: readonly DealCategory[] = [
  { id: "things_to_do", title: "Things To Do", emoji: "🎟️", accent: "#B7E4C7" },
  { id: "restaurants", title: "Restaurants", emoji: "🍽️", accent: "#F6C6B8" },
  { id: "coffee_dessert", title: "Coffee & Dessert", emoji: "☕", accent: "#E8D3B0" },
  { id: "breweries_wine", title: "Breweries & Wine", emoji: "🍺", accent: "#E3C4DD" },
  { id: "shopping", title: "Shopping", emoji: "🛍️", accent: "#CFE0F0" },
  { id: "entertainment", title: "Entertainment", emoji: "🎭", accent: "#FFE0A3" },
  { id: "hotels_staycations", title: "Hotels & Staycations", emoji: "🏨", accent: "#C9E4E7" },
  { id: "travel_transportation", title: "Travel & Transportation", emoji: "✈️", accent: "#CDE7D8" },
] as const;

const CATEGORY_BY_ID: Record<DealCategoryId, DealCategory> = DEAL_CATEGORIES.reduce(
  (acc, category) => {
    acc[category.id] = category;
    return acc;
  },
  {} as Record<DealCategoryId, DealCategory>
);

export function dealCategory(id: DealCategoryId): DealCategory {
  return CATEGORY_BY_ID[id];
}

/**
 * Live deal catalog. Intentionally empty until a verified affiliate feed lands —
 * the placeholder development seeds have been removed. Populate this array (each
 * entry a `LocalDeal`) to bring the Deals desk back online.
 */
const DEALS: readonly LocalDeal[] = [] as const;

/**
 * A homepage-friendly, varied spread — never more than two from one category.
 * Empty while there are no deals; add featured deal ids here to pin ordering.
 */
const FEATURED_ORDER: readonly string[] = [];

/** All deals, in catalog order. */
export function allLocalDeals(): LocalDeal[] {
  return [...DEALS];
}

/** Featured deals for the homepage, capped and varied (default 8). */
export function featuredLocalDeals(limit = 8): LocalDeal[] {
  const byId = new Map(DEALS.map((deal) => [deal.id, deal]));
  const featured = FEATURED_ORDER.map((id) => byId.get(id)).filter(
    (deal): deal is LocalDeal => Boolean(deal)
  );
  const rest = DEALS.filter((deal) => !FEATURED_ORDER.includes(deal.id));
  return [...featured, ...rest].slice(0, limit);
}

export type DealCategoryGroup = {
  category: DealCategory;
  deals: LocalDeal[];
};

/** Deals grouped by category in the canonical See All order (empty groups dropped). */
export function localDealsByCategory(): DealCategoryGroup[] {
  return DEAL_CATEGORIES.map((category) => ({
    category,
    deals: DEALS.filter((deal) => deal.category === category.id),
  })).filter((group) => group.deals.length > 0);
}

export function getLocalDealById(id: string): LocalDeal | null {
  return DEALS.find((deal) => deal.id === id) ?? null;
}

/** Short card location + savings line, e.g. "La Milpa Taqueria · Save with BOGO". */
export function dealCardSubtitle(deal: LocalDeal): string {
  return `${deal.merchant} · ${deal.savingsLabel}`;
}

/** Google Maps search URL for a deal's merchant (works for any name). */
export function dealMapsUrl(deal: LocalDeal): string {
  const query = encodeURIComponent(`${deal.merchant}, ${deal.city}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
