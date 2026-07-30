/**
 * Offer classification engine — the single, UI-free source of truth for how
 * every D.R.O.P. offer is organized into the three-layer system:
 *
 *   • Local   → relevant to the reader's metro only
 *   • Travel  → nationwide; destinations / experiences worth traveling for
 *   • Online  → nationwide; redeemable from anywhere
 *
 * Design law (do not break):
 *   1. Rendering components NEVER decide scope, subcategory, or eligibility.
 *      They render exactly what this module returns.
 *   2. Merchant-specific exceptions live ONLY in `OFFER_OVERRIDES` below — never
 *      hardcoded in components or scattered across the codebase. Adding or
 *      adjusting a merchant is a one-line edit here.
 *   3. Pure and import-light (types only) so it is trivially unit-testable and
 *      has zero React / Supabase coupling.
 *
 * Precedence for every offer: override → raw DB scope → deterministic keyword
 * rules → safe fallback ("Other" within the resolved scope). An offer that
 * cannot be placed (unknown scope, or a Local offer with no metro) is excluded
 * rather than guessed — trust over volume.
 */

import type { DealScope, LocalDeal } from "./localDeals";

/** The three presentation layers. Distinct from the raw DB `DealScope`. */
export type OfferScope = "local" | "travel" | "online";

/** A single browsable subcategory within a scope. */
export type OfferSubcategory = {
  id: string;
  label: string;
  emoji: string;
};

/** Header metadata + ordered subcategory taxonomy for one scope. */
export type OfferScopeMeta = {
  scope: OfferScope;
  label: string;
  emoji: string;
  /** One calm sentence describing the scope (shown under the See All header). */
  tagline: string;
  subcategories: OfferSubcategory[];
};

// ---------------------------------------------------------------------------
// Taxonomy — one permanent list per scope, in display order. The last entry of
// each scope is the safe "Other" bucket used when no specific rule matches.
// ---------------------------------------------------------------------------

export const OFFER_TAXONOMY: Record<OfferScope, OfferScopeMeta> = {
  local: {
    scope: "local",
    label: "Local Offers",
    emoji: "🏠",
    tagline: "Ways to save close to home, chosen for your area.",
    subcategories: [
      { id: "food_drink", label: "Food & Drink", emoji: "🍽️" },
      { id: "entertainment", label: "Entertainment", emoji: "🎭" },
      { id: "activities", label: "Activities", emoji: "🎟️" },
      { id: "arts_culture", label: "Arts & Culture", emoji: "🎨" },
      { id: "shopping", label: "Shopping", emoji: "🛍️" },
      { id: "health_beauty", label: "Health & Beauty", emoji: "💆" },
      { id: "pets", label: "Pets", emoji: "🐾" },
      { id: "services", label: "Services", emoji: "🧰" },
      { id: "automotive", label: "Automotive", emoji: "🚗" },
      { id: "other_local", label: "More Local", emoji: "📍" },
    ],
  },
  travel: {
    scope: "travel",
    label: "Travel Offers",
    emoji: "✈️",
    tagline: "Destinations and experiences worth traveling for.",
    subcategories: [
      { id: "hotels_resorts", label: "Hotels & Resorts", emoji: "🏨" },
      { id: "tours", label: "Tours", emoji: "🧭" },
      { id: "attractions", label: "Attractions", emoji: "🎡" },
      { id: "theme_parks", label: "Theme Parks", emoji: "🎢" },
      { id: "cruises", label: "Cruises", emoji: "🛳️" },
      { id: "transportation", label: "Transportation", emoji: "🚆" },
      { id: "vacation_packages", label: "Vacation Packages", emoji: "🧳" },
      { id: "outdoor_adventure", label: "Outdoor & Adventure", emoji: "⛰️" },
      { id: "other_travel", label: "More Travel", emoji: "✈️" },
    ],
  },
  online: {
    scope: "online",
    label: "Online Offers",
    emoji: "💻",
    tagline: "Deals you can redeem from anywhere.",
    subcategories: [
      { id: "clothing_accessories", label: "Clothing & Accessories", emoji: "👕" },
      { id: "electronics", label: "Electronics", emoji: "🔌" },
      { id: "home", label: "Home", emoji: "🏡" },
      { id: "pets", label: "Pets", emoji: "🐾" },
      { id: "beauty", label: "Beauty", emoji: "💄" },
      { id: "fitness", label: "Fitness", emoji: "🏋️" },
      { id: "books_education", label: "Books & Learning", emoji: "📚" },
      { id: "food_grocery", label: "Food & Grocery", emoji: "🛒" },
      { id: "gifts", label: "Gifts", emoji: "🎁" },
      { id: "gaming", label: "Gaming", emoji: "🎮" },
      { id: "other_online", label: "More Online", emoji: "💻" },
    ],
  },
};

/** Scope render order — Local first, then nationwide Travel, then Online. */
export const OFFER_SCOPE_ORDER: readonly OfferScope[] = [
  "local",
  "travel",
  "online",
] as const;

// ---------------------------------------------------------------------------
// Centralized override map — merchant-specific exceptions ONLY live here.
//
// Keyed by either the offer's `deal_key` (most specific) or a normalized
// merchant name (applies to every offer from that merchant). `category` accepts
// a subcategory id OR its human label; it is resolved to a real subcategory and
// falls back to the scope's "Other" bucket if it is not recognized.
//
// To onboard a new affiliate: add one line here. No component changes required.
// ---------------------------------------------------------------------------

export type OfferOverride = {
  scope: OfferScope;
  category: string;
};

// Keys MUST be pre-normalized (lowercase, alphanumerics separated by single
// spaces) because lookups run through `normalizeKey` — see `findOverride`. The
// normalized form of the deal_key "extranomical-alcatraz-sf-city-tour" is
// "extranomical alcatraz sf city tour".
export const OFFER_OVERRIDES: Record<string, OfferOverride> = {
  // First live D.R.O.P. affiliate — Extranomical Tours (AWIN). Alcatraz + city
  // tour is a San Francisco destination experience, surfaced nationwide.
  "extranomical tours": { scope: "travel", category: "attractions" },
  "extranomical alcatraz sf city tour": { scope: "travel", category: "attractions" },
};

// ---------------------------------------------------------------------------
// Deterministic keyword rules — most specific subcategory first within a scope.
// These are editorial grouping hints, not safety filters; the restricted /
// family-friendly gates run separately in the repository and pipeline.
// ---------------------------------------------------------------------------

type KeywordRule = { subcategory: string; keywords: readonly string[] };

const TRAVEL_RULES: readonly KeywordRule[] = [
  { subcategory: "theme_parks", keywords: ["theme park", "amusement park", "water park", "roller coaster", "six flags", "disney", "universal studios"] },
  { subcategory: "cruises", keywords: ["cruise", "dinner cruise", "harbor cruise", "bay cruise", "sailing", "boat tour", "ferry"] },
  { subcategory: "hotels_resorts", keywords: ["hotel", "resort", "lodge", "inn", "motel", "staycation", "spa resort"] },
  { subcategory: "transportation", keywords: ["car rental", "rent a car", "rental car", "amtrak", "rail pass", "train ticket", "airport shuttle", "airfare", "flight deal", "transfer service"] },
  { subcategory: "vacation_packages", keywords: ["vacation package", "getaway package", "all-inclusive", "travel package", "holiday package"] },
  { subcategory: "outdoor_adventure", keywords: ["zipline", "zip line", "white water", "whitewater", "rafting", "kayak", "snorkel", "scuba", "dive tour", "atv", "off-road", "ski pass", "hiking tour", "climbing"] },
  { subcategory: "tours", keywords: ["tour", "sightseeing", "excursion", "guided", "wine tour", "brewery tour", "walking tour", "food tour"] },
  { subcategory: "attractions", keywords: ["attraction", "admission", "day pass", "city pass", "museum", "aquarium", "zoo", "observation deck", "landmark", "alcatraz", "sightsee", "ticket to"] },
];

const ONLINE_RULES: readonly KeywordRule[] = [
  { subcategory: "electronics", keywords: ["electronics", "laptop", "smartphone", "headphone", "earbud", "camera", "tablet", "computer", "monitor", "gadget", "smart home device"] },
  { subcategory: "gaming", keywords: ["gaming", "video game", "console", "playstation", "xbox", "nintendo", "pc game", "gamer"] },
  { subcategory: "beauty", keywords: ["beauty", "skincare", "makeup", "cosmetic", "fragrance", "perfume", "haircare", "hair care"] },
  { subcategory: "fitness", keywords: ["fitness", "workout", "activewear", "supplement", "protein", "yoga gear", "home gym", "exercise equipment"] },
  { subcategory: "books_education", keywords: ["book", "ebook", "audiobook", "online course", "learning", "language app", "tutoring", "study"] },
  { subcategory: "food_grocery", keywords: ["grocery", "meal kit", "meal delivery", "snack box", "coffee beans", "wine club", "gourmet", "subscription box food"] },
  { subcategory: "gifts", keywords: ["gift", "flowers", "greeting card", "personalized gift", "flower delivery"] },
  { subcategory: "home", keywords: ["furniture", "mattress", "bedding", "home decor", "kitchenware", "cookware", "appliance", "garden supply", "home goods"] },
  { subcategory: "pets", keywords: ["pet supply", "dog food", "cat food", "pet toy", "pet subscription"] },
  { subcategory: "clothing_accessories", keywords: ["clothing", "apparel", "fashion", "shoes", "sneaker", "jacket", "dress", "jewelry", "watch", "handbag", "sunglasses", "accessories"] },
];

const LOCAL_RULES: readonly KeywordRule[] = [
  { subcategory: "food_drink", keywords: ["restaurant", "taco", "pizza", "bbq", "barbecue", "coffee", "cafe", "café", "bakery", "brewery", "winery", "wine bar", "cocktail", "bar & grill", "diner", "dining", "eatery", "grill", "brunch", "dessert", "ice cream", "food"] },
  { subcategory: "arts_culture", keywords: ["museum", "gallery", "art walk", "cultural", "exhibit", "historic site", "theatre exhibit"] },
  { subcategory: "entertainment", keywords: ["theater", "theatre", "cinema", "movie", "concert", "comedy", "live music", "bowling", "arcade", "karaoke", "nightlife", "show ticket"] },
  { subcategory: "activities", keywords: ["escape room", "axe throwing", "go-kart", "go kart", "mini golf", "paddleboard", "kayak", "rock climbing", "trampoline", "skating", "class", "workshop", "experience", "things to do", "tour"] },
  { subcategory: "health_beauty", keywords: ["spa", "salon", "massage", "nail", "barber", "wellness", "gym", "fitness studio", "yoga studio", "skincare", "med spa"] },
  { subcategory: "pets", keywords: ["pet", "dog groom", "grooming", "veterinary", "vet clinic", "doggy daycare"] },
  { subcategory: "automotive", keywords: ["car wash", "oil change", "auto repair", "tire", "mechanic", "auto detail", "car detail"] },
  { subcategory: "services", keywords: ["cleaning service", "house cleaning", "repair", "laundry", "dry clean", "moving service", "plumbing", "handyman"] },
  { subcategory: "shopping", keywords: ["boutique", "shop", "store", "market", "retail", "antique", "gift shop"] },
];

/** Legacy `deals_published.category` values → best subcategory, per scope. */
const LEGACY_CATEGORY_MAP: Record<OfferScope, Record<string, string>> = {
  local: {
    restaurants: "food_drink",
    coffee_dessert: "food_drink",
    breweries_wine: "food_drink",
    things_to_do: "activities",
    entertainment: "entertainment",
    shopping: "shopping",
    hotels_staycations: "other_local",
    travel_transportation: "other_local",
  },
  travel: {
    hotels_staycations: "hotels_resorts",
    travel_transportation: "transportation",
    things_to_do: "attractions",
    entertainment: "attractions",
  },
  online: {
    shopping: "clothing_accessories",
    entertainment: "gaming",
  },
};

/** Signals that a nationwide offer is a travel/destination experience. */
const TRAVEL_SIGNAL_KEYWORDS: readonly string[] = [
  "tour",
  "hotel",
  "resort",
  "cruise",
  "flight",
  "airfare",
  "vacation",
  "getaway",
  "theme park",
  "amusement park",
  "attraction",
  "admission",
  "sightseeing",
  "excursion",
  "national park",
  "aquarium",
  "zoo",
  "city pass",
  "day pass",
  "zipline",
  "rafting",
  "safari",
  "alcatraz",
  "staycation",
  "lodge",
  "car rental",
  "rental car",
  "amtrak",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lowercase, collapse whitespace/punctuation to single spaces, trim. */
export function normalizeKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The scope's safe "Other" bucket (always the final taxonomy entry). */
function otherSubcategory(scope: OfferScope): OfferSubcategory {
  const list = OFFER_TAXONOMY[scope].subcategories;
  return list[list.length - 1];
}

/**
 * Resolve a subcategory id/label hint to a real subcategory within a scope.
 *
 * Keyword rules pass exact ids (which may contain underscores, e.g.
 * "books_education"), while the override map may pass a human label
 * ("Attractions"). Match the raw id exactly first — normalizing here would turn
 * "books_education" into "books education" and miss the id — then fall back to a
 * normalized id/label comparison for label-style hints.
 */
function resolveSubcategory(scope: OfferScope, hint: string): OfferSubcategory {
  const list = OFFER_TAXONOMY[scope].subcategories;
  const raw = (hint ?? "").trim();

  const byExactId = list.find((sub) => sub.id === raw);
  if (byExactId) return byExactId;

  const norm = normalizeKey(hint);
  if (!norm) return otherSubcategory(scope);
  const found = list.find(
    (sub) => normalizeKey(sub.id) === norm || normalizeKey(sub.label) === norm
  );
  return found ?? otherSubcategory(scope);
}

/** The minimal shape the engine needs — `LocalDeal` satisfies it structurally. */
export type ClassifiableOffer = {
  id: string;
  merchant: string;
  title?: string | null;
  description?: string | null;
  /** Raw DB scope (local / online / nationwide). */
  scope?: DealScope | null;
  /** Raw DB category string. */
  sourceCategory?: string | null;
  /** Raw metro key (region_key). */
  metroSlug?: string | null;
};

function haystack(offer: ClassifiableOffer): string {
  return normalizeKey(
    [offer.sourceCategory, offer.title, offer.merchant, offer.description]
      .filter(Boolean)
      .join(" ")
  );
}

function matchRules(
  hay: string,
  rules: readonly KeywordRule[]
): string | null {
  for (const rule of rules) {
    if (rule.keywords.some((kw) => hay.includes(kw))) return rule.subcategory;
  }
  return null;
}

/** Look an offer up in the override map (deal_key wins over merchant name). */
function findOverride(offer: ClassifiableOffer): OfferOverride | null {
  return (
    OFFER_OVERRIDES[normalizeKey(offer.id)] ??
    OFFER_OVERRIDES[normalizeKey(offer.merchant)] ??
    null
  );
}

/** Infer the presentation scope from raw DB scope + text signals. */
function inferScope(offer: ClassifiableOffer): OfferScope | null {
  const raw = offer.scope ?? null;
  if (raw === "online") return "online";
  if (raw === "local") return "local";
  if (raw === "nationwide") {
    const hay = haystack(offer);
    return TRAVEL_SIGNAL_KEYWORDS.some((kw) => hay.includes(kw))
      ? "travel"
      : "online";
  }
  return null;
}

function inferSubcategory(
  scope: OfferScope,
  offer: ClassifiableOffer
): OfferSubcategory {
  const hay = haystack(offer);
  const rules =
    scope === "travel"
      ? TRAVEL_RULES
      : scope === "online"
        ? ONLINE_RULES
        : LOCAL_RULES;
  const byKeyword = matchRules(hay, rules);
  if (byKeyword) return resolveSubcategory(scope, byKeyword);

  const legacy = LEGACY_CATEGORY_MAP[scope][normalizeKey(offer.sourceCategory)];
  if (legacy) return resolveSubcategory(scope, legacy);

  return otherSubcategory(scope);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type OfferClassification = {
  scope: OfferScope;
  subcategory: OfferSubcategory;
  /** True for Travel + Online (surfaced everywhere); false for Local. */
  isNationwide: boolean;
  /** Metro key a Local offer belongs to; null for nationwide offers. */
  metroSlug: string | null;
};

export type ClassificationResult =
  | { ok: true; classification: OfferClassification }
  | { ok: false; reason: "unknown_scope" | "local_without_metro" };

/**
 * Classify a single offer. Precedence: override → raw scope → keyword rules →
 * scope "Other" bucket. Returns `ok: false` (with a reason) when the offer must
 * be excluded rather than guessed.
 */
export function classifyOffer(offer: ClassifiableOffer): ClassificationResult {
  const override = findOverride(offer);

  const scope = override ? override.scope : inferScope(offer);
  if (!scope) return { ok: false, reason: "unknown_scope" };

  const subcategory = override
    ? resolveSubcategory(scope, override.category)
    : inferSubcategory(scope, offer);

  const isNationwide = scope === "travel" || scope === "online";
  const metroSlug = offer.metroSlug?.trim() || null;

  if (scope === "local" && !metroSlug) {
    return { ok: false, reason: "local_without_metro" };
  }

  return {
    ok: true,
    classification: { scope, subcategory, isNationwide, metroSlug },
  };
}

/**
 * Metro eligibility. Nationwide offers (Travel + Online) are always eligible.
 * A Local offer is eligible only when the reader's metro is known and matches
 * the offer's metro exactly. No radius math — metro-key equality only.
 */
export function isEligibleForReaderMetro(
  classification: OfferClassification,
  readerMetroSlug: string | null | undefined
): boolean {
  if (classification.isNationwide) return true;
  const reader = readerMetroSlug?.trim() || null;
  return Boolean(
    reader && classification.metroSlug && classification.metroSlug === reader
  );
}

export type OfferSubcategoryGroup = {
  subcategory: OfferSubcategory;
  deals: LocalDeal[];
};

export type OfferScopeSection = {
  scope: OfferScope;
  label: string;
  emoji: string;
  tagline: string;
  /** Non-empty subcategory groups, in taxonomy order. */
  groups: OfferSubcategoryGroup[];
  /** Total eligible deals in this scope. */
  total: number;
};

/**
 * Build the full three-scope section model from a flat list of offers and the
 * reader's metro. This is the one function the UI calls: it classifies, applies
 * metro eligibility, de-duplicates, and groups — so components never touch any
 * classification logic. Always returns all three scopes (Local, Travel, Online)
 * in order; each may have zero groups (the UI decides how to present empties).
 */
export function buildOfferSections(
  deals: LocalDeal[],
  readerMetroSlug: string | null | undefined
): OfferScopeSection[] {
  const seen = new Set<string>();
  // scope → subcategoryId → deals (insertion order preserved).
  const buckets: Record<OfferScope, Map<string, LocalDeal[]>> = {
    local: new Map(),
    travel: new Map(),
    online: new Map(),
  };

  for (const deal of deals) {
    if (!deal?.id || seen.has(deal.id)) continue;
    seen.add(deal.id);

    const result = classifyOffer(deal);
    if (!result.ok) continue;
    const { classification } = result;
    if (!isEligibleForReaderMetro(classification, readerMetroSlug)) continue;

    const map = buckets[classification.scope];
    const key = classification.subcategory.id;
    const list = map.get(key);
    if (list) list.push(deal);
    else map.set(key, [deal]);
  }

  return OFFER_SCOPE_ORDER.map((scope) => {
    const meta = OFFER_TAXONOMY[scope];
    const groups: OfferSubcategoryGroup[] = meta.subcategories
      .map((subcategory) => ({
        subcategory,
        deals: buckets[scope].get(subcategory.id) ?? [],
      }))
      .filter((group) => group.deals.length > 0);
    const total = groups.reduce((sum, group) => sum + group.deals.length, 0);
    return {
      scope,
      label: meta.label,
      emoji: meta.emoji,
      tagline: meta.tagline,
      groups,
      total,
    };
  });
}

/** Flatten a scope section to a single ordered deal list (optionally capped). */
export function scopeSectionDeals(
  section: OfferScopeSection,
  cap?: number
): LocalDeal[] {
  const all = section.groups.flatMap((group) => group.deals);
  return typeof cap === "number" ? all.slice(0, Math.max(cap, 0)) : all;
}
