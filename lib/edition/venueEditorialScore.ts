/**
 * Kindred Venue Editorial Score — separate from provider ratings, review counts,
 * verification confidence, data completeness, and popularity.
 *
 * Answers: "Would the Kindred editorial desk genuinely recommend this place?"
 *
 * Keep in sync with supabase/functions/_shared/editorial/venueEditorialScore.ts
 */

import type { VenueLifecycle } from "./venueLifecycle";
import { isGuideEligibleLifecycle } from "./venueLifecycle";
import { venueHayFromParts, isScenicOrHiddenGem } from "./venueQuality";

/** Structured editorial labels — stored as ids, displayed with labels. */
export const VENUE_EDITORIAL_LABEL_IDS = [
  "editors_pick",
  "local_favorite",
  "hidden_gem",
  "worth_the_drive",
  "worth_the_wait",
  "best_patio",
  "best_breakfast",
  "best_brunch",
  "best_coffee",
  "best_bakery",
  "best_date_night",
  "best_family_meal",
  "best_late_night",
  "best_dessert",
  "best_outdoor_dining",
  "best_dog_friendly",
  "historic_favorite",
  "neighborhood_institution",
  "regional_specialty",
  "new_discovery",
] as const;

export type VenueEditorialLabelId = (typeof VENUE_EDITORIAL_LABEL_IDS)[number];

export const VENUE_EDITORIAL_LABEL_DISPLAY: Record<VenueEditorialLabelId, string> = {
  editors_pick: "Editor's Pick",
  local_favorite: "Local Favorite",
  hidden_gem: "Hidden Gem",
  worth_the_drive: "Worth the Drive",
  worth_the_wait: "Worth the Wait",
  best_patio: "Best Patio",
  best_breakfast: "Best Breakfast",
  best_brunch: "Best Brunch",
  best_coffee: "Best Coffee",
  best_bakery: "Best Bakery",
  best_date_night: "Best Date Night",
  best_family_meal: "Best Family Meal",
  best_late_night: "Best Late Night",
  best_dessert: "Best Dessert",
  best_outdoor_dining: "Best Outdoor Dining",
  best_dog_friendly: "Best Dog-Friendly Stop",
  historic_favorite: "Historic Favorite",
  neighborhood_institution: "Neighborhood Institution",
  regional_specialty: "Regional Specialty",
  new_discovery: "New Discovery",
};

export type VenueEditorialScoreReason = {
  code: string;
  label: string;
  weight: number;
};

export type VenueEditorialScoreEvidence = {
  reasons: VenueEditorialScoreReason[];
  version: number;
};

export type KindredVenueEditorialScore = {
  score: number;
  labels: VenueEditorialLabelId[];
  /** Internal — not for reader display unless rewritten editorially. */
  editorialReason: string;
  evidence: VenueEditorialScoreEvidence;
};

/** Current scoring algorithm version — bump when weights change. */
export const VENUE_EDITORIAL_SCORE_VERSION = 1;

/** Tiers */
export const VENUE_EDITORIAL_TIER_SIGNATURE = 90;
export const VENUE_EDITORIAL_TIER_STRONG = 80;
export const VENUE_EDITORIAL_TIER_USEFUL = 70;
export const VENUE_EDITORIAL_TIER_GUIDE_MIN = 60;

/** Unverified venues cannot score above this. */
export const VENUE_EDITORIAL_UNVERIFIED_CAP = 59;

/** Max score without verified lifecycle + verification status. */
export const VENUE_EDITORIAL_PUBLISH_CAP_WITHOUT_VERIFY = 69;

const KNOWN_FOOD_CHAINS: readonly string[] = [
  "starbucks", "dunkin", "peet's coffee", "panera", "mcdonald", "burger king",
  "wendy", "taco bell", "chipotle", "subway", "chili", "olive garden",
  "domino", "pizza hut", "kfc", "chick-fil-a", "five guys", "in-n-out",
];

export type VenueEditorialScoreInput = {
  kindredVenueId: string;
  name: string;
  providerCategories: string[];
  editorialCategories?: string[];
  editorialTeaser?: string | null;
  cuisine?: string | null;
  lifecycle: VenueLifecycle;
  verificationStatus: string;
  /** Verification confidence — separate from editorial score. */
  confidenceScore: number;
  isChain?: boolean;
  /** Provider rating — recorded but NOT used in editorial score. */
  providerRating?: number | null;
  providerReviewCount?: number | null;
  discoveredAt?: string | null;
  /** True when lifecycle is new and recently discovered. */
  isNewDiscovery?: boolean;
};

function isLikelyChain(name: string): boolean {
  const hay = name.toLowerCase();
  return KNOWN_FOOD_CHAINS.some((c) => hay.includes(c));
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pushReason(
  reasons: VenueEditorialScoreReason[],
  code: string,
  label: string,
  weight: number
): number {
  reasons.push({ code, label, weight });
  return weight;
}

function isVerifiedForEditorial(input: VenueEditorialScoreInput): boolean {
  return (
    isGuideEligibleLifecycle(input.lifecycle) &&
    input.verificationStatus === "verified" &&
    input.confidenceScore >= 70
  );
}

function buildEditorialReason(
  input: VenueEditorialScoreInput,
  reasons: VenueEditorialScoreReason[],
  labels: VenueEditorialLabelId[]
): string {
  const parts: string[] = [];
  if (!input.isChain && !isLikelyChain(input.name)) {
    parts.push("Independent local venue");
  }
  if (input.cuisine?.trim()) {
    parts.push(`${input.cuisine.trim()} focus`);
  }
  const topReasons = reasons
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((r) => r.label.toLowerCase());
  if (topReasons.length) parts.push(topReasons.join(", "));
  if (labels.includes("hidden_gem")) parts.push("under-the-radar character");
  if (labels.includes("neighborhood_institution")) {
    parts.push("neighborhood institution signals");
  }
  const city = input.name.trim();
  return parts.length
    ? `${city}: ${parts.join("; ")}.`
    : `Verified ${input.providerCategories[0] ?? "dining"} listing with limited editorial evidence.`;
}

function assignLabels(
  input: VenueEditorialScoreInput,
  score: number,
  hay: string,
  reasons: VenueEditorialScoreReason[]
): VenueEditorialLabelId[] {
  const labels: VenueEditorialLabelId[] = [];
  const add = (id: VenueEditorialLabelId) => {
    if (!labels.includes(id)) labels.push(id);
  };

  if (score >= VENUE_EDITORIAL_TIER_SIGNATURE && isVerifiedForEditorial(input)) {
    add("editors_pick");
  }

  if (
    !input.isChain &&
    !isLikelyChain(input.name) &&
    score >= VENUE_EDITORIAL_TIER_USEFUL
  ) {
    add("local_favorite");
  }

  if (
    isScenicOrHiddenGem(hay) ||
    reasons.some((r) => r.code === "hidden_gem_quality")
  ) {
    add("hidden_gem");
  }

  if (input.isNewDiscovery || input.lifecycle === "new") {
    add("new_discovery");
  }

  if (/\bbreakfast\b|\bbreakfast spot\b/i.test(hay)) add("best_breakfast");
  if (/\bbrunch\b/i.test(hay)) add("best_brunch");
  if (/\bcoffee shop|coffee house|espresso\b/i.test(hay)) add("best_coffee");
  if (/\bbakery|patisserie\b/i.test(hay)) add("best_bakery");
  if (/\bdessert|ice cream|gelato|cupcake\b/i.test(hay)) add("best_dessert");
  if (/\blate night|open late|midnight\b/i.test(hay)) add("best_late_night");
  if (/\bpatio|outdoor dining|rooftop|beer garden\b/i.test(hay)) {
    add("best_patio");
    add("best_outdoor_dining");
  }
  if (/\bdog friendly|dog-friendly|pets welcome\b/i.test(hay)) {
    add("best_dog_friendly");
  }
  if (/\bfamily|kids menu|high chair\b/i.test(hay)) add("best_family_meal");
  if (/\bdate night|romantic|wine bar|cocktail bar\b/i.test(hay)) {
    add("best_date_night");
  }
  if (/\bhistoric|established|since 19|heritage\b/i.test(hay)) {
    add("historic_favorite");
  }
  if (/\bneighborhood|corner spot|local staple\b/i.test(hay)) {
    add("neighborhood_institution");
  }
  if (input.cuisine?.trim()) add("regional_specialty");

  if (
    reasons.some((r) => r.code === "worth_the_drive") &&
    score >= VENUE_EDITORIAL_TIER_USEFUL
  ) {
    add("worth_the_drive");
  }

  return labels;
}

/**
 * Compute Kindred Venue Editorial Score from verified evidence only.
 * Provider ratings and review counts are intentionally ignored.
 */
export function computeVenueEditorialScore(
  input: VenueEditorialScoreInput
): KindredVenueEditorialScore {
  const reasons: VenueEditorialScoreReason[] = [];
  let score = 0;

  const hay = venueHayFromParts([
    input.name,
    input.editorialTeaser,
    ...(input.providerCategories ?? []),
    ...(input.editorialCategories ?? []),
    input.cuisine,
  ]);

  const chain = input.isChain ?? isLikelyChain(input.name);
  const verified = isVerifiedForEditorial(input);

  // Base editorial desk interest — verified food/drink venue with identity.
  score += pushReason(reasons, "verified_listing", "Verified food or drink listing", 42);

  if (!chain) {
    score += pushReason(
      reasons,
      "local_independent",
      "Independent or family-owned priority",
      14
    );
  } else {
    score += pushReason(reasons, "chain_listing", "National chain listing", -16);
    if (/\b(local|flagship|original location|only location in)\b/i.test(hay)) {
      score += pushReason(reasons, "distinctive_chain", "Distinctive chain location", 8);
    }
  }

  if (input.cuisine?.trim()) {
    score += pushReason(
      reasons,
      "cuisine_identity",
      "Clear cuisine or specialty identity",
      8
    );
  }

  if (/\bbreakfast|brunch|coffee|bakery|brewery|steakhouse|sushi|pizza|bbq\b/i.test(hay)) {
    score += pushReason(reasons, "distinctive_menu", "Distinctive menu or specialty category", 6);
  }

  if (/\bpatio|outdoor|garden|view|scenic|waterfront\b/i.test(hay)) {
    score += pushReason(reasons, "atmosphere_setting", "Patio or scenic setting", 5);
  }

  if (isScenicOrHiddenGem(hay)) {
    score += pushReason(reasons, "hidden_gem_quality", "Hidden-gem character", 7);
  }

  if (/\bfamily|kids|all ages\b/i.test(hay)) {
    score += pushReason(reasons, "family_friendly", "Family-friendly value", 4);
  }

  if (/\bdog friendly|dog-friendly\b/i.test(hay)) {
    score += pushReason(reasons, "dog_friendly", "Dog-friendly value", 3);
  }

  if (/\bdate night|romantic|intimate\b/i.test(hay)) {
    score += pushReason(reasons, "date_night", "Date-night value", 3);
  }

  if (/\bmorning|early|opens early\b/i.test(hay)) {
    score += pushReason(reasons, "morning_coffee", "Morning coffee value", 3);
  }

  if (/\bneighborhood|local favorite|institution\b/i.test(hay)) {
    score += pushReason(reasons, "neighborhood_character", "Neighborhood character", 5);
  }

  if (/\bhistoric|heritage|since 19|landmark\b/i.test(hay)) {
    score += pushReason(reasons, "historical_significance", "Historical significance", 4);
  }

  if (input.editorialTeaser?.trim() && input.editorialTeaser.length >= 40) {
    score += pushReason(
      reasons,
      "editorial_evidence",
      "Verified Kindred editorial teaser present",
      6
    );
  }

  if (input.lifecycle === "featured" || input.lifecycle === "evergreen") {
    score += pushReason(reasons, "editorial_promotion", "Editorial desk promotion", 8);
  }

  // Worth-the-drive — distinctive enough to travel for (verified category depth).
  if (
    !chain &&
    (input.lifecycle === "evergreen" ||
      /\bdestination|worth the drive|regional|award|James Beard|Michelin\b/i.test(hay))
  ) {
    score += pushReason(reasons, "worth_the_drive", "Worth-the-drive quality", 5);
  }

  // Explicitly do NOT score provider rating or review volume.
  if (input.providerRating != null && input.providerRating >= 4.5) {
    pushReason(
      reasons,
      "provider_rating_ignored",
      "Provider rating excluded from editorial score",
      0
    );
  }

  score = clampScore(score);

  if (!verified) {
    score = Math.min(score, VENUE_EDITORIAL_UNVERIFIED_CAP);
    pushReason(
      reasons,
      "unverified_cap",
      "Unverified venue capped below publish threshold",
      0
    );
  }

  if (input.lifecycle === "needs_review" || input.lifecycle === "closed") {
    score = Math.min(score, VENUE_EDITORIAL_TIER_GUIDE_MIN - 1);
  }

  const labels = assignLabels(input, score, hay, reasons);

  // Editor's Pick requires verified + signature tier
  if (score < VENUE_EDITORIAL_TIER_SIGNATURE || !verified) {
    const idx = labels.indexOf("editors_pick");
    if (idx >= 0) labels.splice(idx, 1);
  }

  return {
    score,
    labels,
    editorialReason: buildEditorialReason(input, reasons, labels),
    evidence: {
      reasons,
      version: VENUE_EDITORIAL_SCORE_VERSION,
    },
  };
}

export type VenueEditorialOverrideFields = {
  editorial_lock?: boolean;
  editorial_score_override?: number | null;
  editorial_labels_override?: VenueEditorialLabelId[] | null;
  editorial_reason_override?: string | null;
};

/** Apply manual editorial lock — automated scoring must not overwrite. */
export function resolveVenueEditorialWithOverrides(
  computed: KindredVenueEditorialScore,
  overrides: VenueEditorialOverrideFields
): KindredVenueEditorialScore {
  if (!overrides.editorial_lock) return computed;
  return {
    score: overrides.editorial_score_override ?? computed.score,
    labels: overrides.editorial_labels_override ?? computed.labels,
    editorialReason: overrides.editorial_reason_override ?? computed.editorialReason,
    evidence: computed.evidence,
  };
}

export function venueEditorialTierLabel(score: number): string {
  if (score >= VENUE_EDITORIAL_TIER_SIGNATURE) return "Signature Kindred recommendation";
  if (score >= VENUE_EDITORIAL_TIER_STRONG) return "Strong recommendation";
  if (score >= VENUE_EDITORIAL_TIER_USEFUL) return "Useful local option";
  if (score >= VENUE_EDITORIAL_TIER_GUIDE_MIN) return "Guide eligible";
  return "Needs editorial review";
}

/** Homepage sort — editorial score with daily rotation so top 8 varies. */
export function homepageVenueEditorialSortScore(
  editorialScore: number,
  kindredVenueId: string,
  editionDate: string
): number {
  let hash = 0;
  const key = `${editionDate}:${kindredVenueId}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const slot = Math.abs(hash) % 8;
  const daySlot =
    parseInt(editionDate.replace(/-/g, "").slice(-4), 10) % 8 || 0;
  const rotationBoost = slot === daySlot ? 5 : slot === (daySlot + 1) % 8 ? 2 : 0;
  return editorialScore + rotationBoost;
}

export function compareVenueEditorialRank(
  a: { editorialScore: number; confidenceScore?: number; distanceKm?: number },
  b: { editorialScore: number; confidenceScore?: number; distanceKm?: number }
): number {
  if (b.editorialScore !== a.editorialScore) return b.editorialScore - a.editorialScore;
  const confA = a.confidenceScore ?? 0;
  const confB = b.confidenceScore ?? 0;
  if (confB !== confA) return confB - confA;
  const distA = a.distanceKm ?? Number.POSITIVE_INFINITY;
  const distB = b.distanceKm ?? Number.POSITIVE_INFINITY;
  return distA - distB;
}

/** Whether material catalog fields should trigger score recalculation. */
export function venueEditorialScoreMaterialFingerprint(parts: {
  name: string;
  providerCategories: string[];
  editorialTeaser?: string | null;
  cuisine?: string | null;
  lifecycle: VenueLifecycle;
  confidenceScore: number;
}): string {
  return [
    parts.name.trim().toLowerCase(),
    parts.providerCategories.join("|"),
    parts.editorialTeaser?.trim() ?? "",
    parts.cuisine?.trim() ?? "",
    parts.lifecycle,
    String(parts.confidenceScore),
  ].join("::");
}
