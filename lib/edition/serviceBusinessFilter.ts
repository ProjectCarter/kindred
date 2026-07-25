/**
 * Service / professional-business exclusion — Activities discovery only (client).
 *
 * Client-side safety net mirroring
 * `supabase/functions/_shared/editorial/serviceBusinessFilter.ts`. Kindred's
 * Activities desk is for real experiences (escape rooms, museums, parks, mini
 * golf, kayaking…), never everyday service or professional businesses. This
 * removes pool/HVAC/roofing/plumbing/pest-control contractors, attorneys,
 * dentists, insurance/banks, churches, real-estate/auto-repair/storage,
 * warehouses, office parks, manufacturing, government offices, and business
 * services — even from an already-cached edition, before the homepage or See All.
 *
 * Matching is conservative: an EXPERIENCE_SAFE_HARBOR rescues any genuine
 * destination first (a "pool hall" is billiards; "The Warehouse" can be a music
 * venue; a "historic church tour" is an experience), so a trigger word inside a
 * real attraction never removes it. Applied only to Activities candidates — it
 * never touches Local Events, Food & Drinks, Recommendations, or Local Deals.
 */

export type ServiceBusinessListingInput = {
  name: string;
  venueCategories?: string[] | null;
  category?: string | null;
  dek?: string | null;
};

export type ServiceBusinessAssessment = {
  excluded: boolean;
  /** Diagnostics only — never reader-facing. */
  signal?: string;
};

/**
 * Genuine experiences that may contain a trigger word. Checked first: any match
 * here keeps the listing, so real destinations are never removed by accident.
 */
const EXPERIENCE_SAFE_HARBOR =
  /\b(museum|historic|heritage|landmark|guided\s+tour|walking\s+tour|ghost\s+tour|gallery|botanical|arboretum|garden|state\s+park|national\s+park|city\s+park|regional\s+park|preserve|trailhead|\btrail\b|hiking|nature\s+center|scenic|overlook|vista|observation\s+deck|brewery|brewpub|taproom|winery|vineyard|distillery|cidery|meadery|arcade|bowling|billiards|pool\s+hall|escape\s+room|mini\s+golf|miniature\s+golf|go[\s-]?kart|paintball|laser\s+tag|axe\s+throwing|climbing\s+gym|bouldering|kayak|canoe|paddle|rafting|\bzoo\b|wildlife|aquarium|sea\s+life|observatory|planetarium|theat(er|re)|playhouse|comedy|improv|music\s+venue|live\s+music|concert\s+hall|amphitheat(er|re)|festival|farmers?\s+market|food\s+hall|skating|ice\s+rink|trampoline|water\s+park|amusement|carousel|pickleball|tennis\s+court|disc\s+golf|driving\s+range|golf\s+course|fishing|boat\s+tour|cruise|petting\s+zoo|orchard|u-?pick|restaurant|cafe|café|coffee|coffeehouse|bakery|patisserie|bistro|brasserie|gastropub|\bpub\b|diner|eatery|kitchen|steakhouse|smokehouse|pizzeria|taqueria|cantina|creamery|ice\s+cream|gelato|donut|doughnut|dessert|chocolate|tea\s+house|\bgrill\b|\bgrille\b|\bdeli\b)\b/i;

const SERVICE_BUSINESS_PATTERNS: Array<{ re: RegExp; signal: string }> = [
  { re: /\bpool\s+(service|cleaning|company|repair|contractor|supply|supplies|maintenance)\b|\bpool\s+&?\s*spa\s+(service|repair|maintenance)\b/i, signal: "pool company" },
  { re: /\bhvac\b|\bheating\s+(&|and)\s+(air|cooling)\b|\bair\s+conditioning\s+(repair|service|contractor|company)\b|\bfurnace\s+repair\b|\bhvac\s+contractor\b/i, signal: "HVAC" },
  { re: /\broofing\b|\broofer\b|\broof\s+(repair|replacement|contractor|company)\b/i, signal: "roofing" },
  { re: /\bplumb(ing|er)\b|\bplumbing\s+(company|service|contractor)\b/i, signal: "plumbing" },
  { re: /\bpest\s+control\b|\bexterminator\b|\btermite\b|\bpest\s+management\b/i, signal: "pest control" },
  { re: /\battorney(s)?\b|\blaw\s+(firm|office|offices|group|center)\b|\blawyer(s)?\b|\blegal\s+(services|aid|group)\b|\bp\.?c\.?\s+law\b/i, signal: "attorney / law office" },
  { re: /\bdentist(ry)?\b|\bdental\s+(office|care|group|clinic|associates)\b|\borthodont(ist|ics)\b|\bendodont/i, signal: "dentist" },
  { re: /\binsurance\s+(agency|agent|group|services|company)\b|\ballstate\b|\bstate\s+farm\b|\bgeico\b/i, signal: "insurance" },
  { re: /\b(bank|banking)\b|\bcredit\s+union\b|\bmortgage\s+(company|lender|broker)\b|\bfinancial\s+(services|advisors?|planning|group)\b|\bwells\s+fargo\b|\bchase\s+bank\b/i, signal: "bank / financial services" },
  { re: /\bchurch\b|\bchapel\b|\bcathedral\b|\bmosque\b|\bsynagogue\b|\bworship\b|\bcongregation\b|\bministr(y|ies)\b|\bparish\b|\bdiocese\b|\bfellowship\s+hall\b|\bbaptist\b|\bmethodist\b|\blutheran\b/i, signal: "place of worship" },
  { re: /\breal\s+estate\b|\brealtor(s)?\b|\brealty\b|\bproperty\s+management\b|\bproperties\s+llc\b|\bhomes\s+for\s+sale\b|\bre\/max\b|\bkeller\s+williams\b/i, signal: "real estate office" },
  { re: /\bauto\s+(repair|body|shop|service|care|center)\b|\bcar\s+repair\b|\bmechanic\b|\boil\s+change\b|\btire\s+(shop|center|pros)\b|\bcollision\s+(center|repair)\b|\bsmog\s+(check|station)\b|\btransmission\s+(repair|shop)\b|\bmuffler\b/i, signal: "auto repair" },
  { re: /\bself[\s-]?storage\b|\bstorage\s+(unit|units|facility|center)\b|\bmini\s+storage\b/i, signal: "storage" },
  { re: /\bwarehouse\s+(district|store|club|distribution)\b|\bdistribution\s+center\b|\bfulfillment\s+center\b/i, signal: "warehouse / distribution" },
  { re: /\boffice\s+park\b|\bexecutive\s+suites\b|\bco[\s-]?working\s+space\b|\bbusiness\s+(park|center|centre|suites)\b/i, signal: "office park" },
  { re: /\bmanufactur(ing|er|ers)\b|\bfabrication\s+(shop|company)\b|\bindustrial\s+(park|supply)\b|\bmachine\s+shop\b/i, signal: "manufacturing / industrial" },
  { re: /\bcity\s+hall\b|\bcourthouse\b|\bcounty\s+(clerk|office|offices|department)\b|\bdmv\b|\bmotor\s+vehicle\s+division\b|\bpost\s+office\b|\bmunicipal\s+(court|office|building)\b|\bgovernment\s+(office|offices|center)\b|\bsocial\s+security\s+(office|administration)\b|\bunemployment\s+office\b|\btax\s+(office|assessor|collector)\b/i, signal: "government office" },
  { re: /\bbusiness\s+(services|solutions|consulting)\b|\bconsulting\s+(firm|group|services)\b|\bnotary\s+(public|service)\b|\btax\s+(preparation|service|services)\b|\bstaffing\s+(agency|services)\b|\bemployment\s+agency\b|\btitle\s+(company|agency)\b|\bmarketing\s+agency\b|\badvertising\s+agency\b|\bit\s+services\b|\btemp\s+agency\b/i, signal: "business services" },
];

function listingHay(input: ServiceBusinessListingInput): string {
  return [input.name, ...(input.venueCategories ?? []), input.category, input.dek]
    .filter((part) => typeof part === "string" && part.trim())
    .join(" ")
    .toLowerCase();
}

export function assessServiceBusinessListing(
  input: ServiceBusinessListingInput
): ServiceBusinessAssessment {
  const hay = listingHay(input);
  if (!hay) return { excluded: false };

  // A genuine experience always wins, even if it contains a trigger word.
  if (EXPERIENCE_SAFE_HARBOR.test(hay)) return { excluded: false };

  for (const { re, signal } of SERVICE_BUSINESS_PATTERNS) {
    if (re.test(hay)) {
      return { excluded: true, signal };
    }
  }

  return { excluded: false };
}

/** True when a listing is an everyday service/professional business, not an experience. */
export function isServiceBusinessListing(
  input: ServiceBusinessListingInput
): boolean {
  return assessServiceBusinessListing(input).excluded;
}
