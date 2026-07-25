/**
 * Restricted-business exclusion — Kindred Constitutional Amendment V3 (server).
 *
 * Server mirror of `lib/edition/restrictedBusinessFilter.ts` — keep in sync.
 *
 * Kindred is a family-friendly local discovery newspaper, not a directory. These
 * categories may never be recommended in ANY discovery surface (Local Events,
 * Activities, Food & Drinks, Local Deals, Recommendations, or any future desk):
 *
 *   • Firearms / weapons / tactical / ammunition / knife / survival businesses
 *   • Cannabis dispensaries (marijuana, CBD/THC retail)
 *   • Vape shops, smoke shops, tobacco / hookah / cigar retail
 *   • Gambling-focused businesses (casinos, sportsbooks, poker rooms) —
 *     unless explicitly enabled in a future version
 *
 * Matching is conservative. A RESTRICTED_SAFE_HARBOR rescues genuine food and
 * experiences first, so a real destination that merely contains a trigger word is
 * never removed — e.g. "The Smoke Shop BBQ" (a barbecue restaurant), a golf
 * "driving range", or "axe/knife throwing". Only businesses whose primary purpose
 * is a restricted category are excluded.
 */

export type RestrictedBusinessCategory =
  | "weapons"
  | "cannabis"
  | "vape_smoke"
  | "gambling"
  | "adult"
  | "permanently_closed";

export type RestrictedBusinessListingInput = {
  name: string;
  venueCategories?: string[] | null;
  category?: string | null;
  dek?: string | null;
  description?: string | null;
};

export type RestrictedBusinessAssessment = {
  excluded: boolean;
  /** Diagnostics only — never reader-facing. */
  signal?: string;
  category?: RestrictedBusinessCategory;
};

/**
 * Genuine food and experiences that may contain a trigger word. Checked first:
 * any match here keeps the listing, so real destinations are never removed by a
 * word that also appears in a restaurant name or an activity.
 */
const RESTRICTED_SAFE_HARBOR =
  /\b(restaurant|cafe|café|coffee|coffeehouse|bakery|patisserie|bistro|brasserie|diner|eatery|kitchen|grill|grille|steakhouse|smokehouse|smoke\s*house|bbq|barbecue|barbeque|smoked|smoky|smokin|pizzeria|taqueria|taco|cantina|deli|poutin|creamery|ice\s+cream|brunch|brewery|brewpub|taproom|winery|vineyard|distillery|cidery|meadery|axe\s+throwing|knife\s+throwing|driving\s+range|golf|top\s?golf|laser\s+tag|paintball|archery|escape\s+room|arcade|bowling|mini\s+golf|miniature\s+golf|museum|theat(er|re)|comedy|farmers?\s+market|festival)\b/i;

const RESTRICTED_BUSINESS_PATTERNS: Array<{
  re: RegExp;
  signal: string;
  category: RestrictedBusinessCategory;
}> = [
  {
    re: /\bgun\s+(shop|store|range|club|dealer|smith)\b|\bguns?\s+(&|and|n')\s+ammo\b|\bfirearms?\b|\bammunition\b|\bammo\s+(shop|store|depot)\b|\b(shooting|rifle|pistol|firing)\s+range\b|\bgun\s+range\b|\btactical\s+(training|gear|supply|supplies|store|shop|range|firearms?|solutions|outfitters?)\b|\bknife\s+(shop|store|outlet)\b|\bcutlery\s+(shop|store)\b|\bsurvival(ist)?\s+(store|shop|gear|supply|supplies|outfitters?|training)\b|\b(military|army)\s+surplus\b|\barmory\b|\bgun\s+club\b/i,
    signal: "firearms / weapons",
    category: "weapons",
  },
  {
    re: /\bdispensar(y|ies)\b|\bcannabis\b|\bmarijuana\b|\bganja\b|\bweed\s+(shop|store|dispensary)\b|\bcbd\s+(shop|store|dispensary|wellness|boutique|outlet)\b|\bthc\s+(shop|store|dispensary)\b/i,
    signal: "cannabis / dispensary",
    category: "cannabis",
  },
  {
    re: /\bvape\s+(shop|store|lounge|bar)\b|\bvape\b|\bvaping\b|\bvapor\s+(shop|store|lounge)\b|\be-?cig(arette)?s?\b|\bsmoke\s+shop(s|pe)?\b|\btobacco\s+(shop|store|outlet)\b|\bhookah\s+(lounge|bar|shop)\b|\bhookah\b|\bcigar\s+(shop|store|outlet)\b/i,
    signal: "vape / smoke shop",
    category: "vape_smoke",
  },
  {
    re: /\bcasino\b|\bgambling\b|\bsportsbook\b|\bsports\s+betting\b|\bbetting\s+(shop|parlor|parlour|lounge|hall)\b|\bbookmaker\b|\bslot\s+machines?\b|\bpoker\s+room\b|\bgaming\s+(hall|parlor|parlour)\b/i,
    signal: "gambling / casino",
    category: "gambling",
  },
  {
    re: /\bstrip\s*club\b|\bgentlemen'?s\s+club\b|\bsex\s+shop\b|\badult\s+(bookstore|video|store|novelt|boutique|superstore|entertainment|arcade|cabaret)\b|\bpornograph/i,
    signal: "adult-oriented business",
    category: "adult",
  },
];

/**
 * Permanent closure — checked before the safe harbor, since a closed restaurant
 * is still closed. Lifecycle gating upstream is the primary defense; this is a
 * belt-and-suspenders text guard for stray "permanently closed" markers.
 */
const PERMANENTLY_CLOSED =
  /\bpermanently\s+closed\b|\bclosed\s+permanently\b|\bnow\s+permanently\s+closed\b|\bclosed\s+for\s+good\b|\bout\s+of\s+business\b|\bno\s+longer\s+(in\s+business|operating|open|in\s+operation)\b|\bceased\s+operations?\b|\bpermanently\s+relocated\b|\brelocated\s+permanently\b|\bdefunct\b|\bdemolished\b/i;

function listingHay(input: RestrictedBusinessListingInput): string {
  return [
    input.name,
    ...(input.venueCategories ?? []),
    input.category,
    input.dek,
    input.description,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
}

export function assessRestrictedBusinessListing(
  input: RestrictedBusinessListingInput
): RestrictedBusinessAssessment {
  const hay = listingHay(input);
  if (!hay) return { excluded: false };

  // Permanent closure wins over the safe harbor — a closed grill is still closed.
  if (PERMANENTLY_CLOSED.test(hay)) {
    return {
      excluded: true,
      signal: "permanently closed",
      category: "permanently_closed",
    };
  }

  // A genuine restaurant or experience always wins, even with a trigger word.
  if (RESTRICTED_SAFE_HARBOR.test(hay)) return { excluded: false };

  for (const { re, signal, category } of RESTRICTED_BUSINESS_PATTERNS) {
    if (re.test(hay)) {
      return { excluded: true, signal, category };
    }
  }

  return { excluded: false };
}

/** True when a listing is a constitutionally restricted business. */
export function isRestrictedBusinessListing(
  input: RestrictedBusinessListingInput
): boolean {
  return assessRestrictedBusinessListing(input).excluded;
}
