import type { ImageOrientation, StockSearchCandidate } from "./types.ts";
import type { ImageCategoryTag } from "./taxonomy.ts";
import type { SearchTierId } from "./searchPlan.ts";
import { computeBaselineQualityScore } from "./quality.ts";
import { stockCandidateConflictsWithVenue } from "./quality.ts";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "at",
  "in",
  "of",
  "for",
  "on",
  "to",
  "llc",
  "inc",
  "restaurant",
  "shop",
  "cafe",
  "bar",
]);

export type RelevanceBreakdown = {
  exactNameMatch: number;
  categoryMatch: number;
  tagMatch: number;
  titleMatch: number;
  descriptionMatch: number;
  visualConfidence: number;
  resolution: number;
  editorialQuality: number;
  tierBonus: number;
};

export type ScoredStockCandidate = {
  candidate: StockSearchCandidate;
  provider: string;
  searchQuery: string;
  searchTier: SearchTierId;
  relevanceScore: number;
  breakdown: RelevanceBreakdown;
  winReason: string;
};

export type RelevanceContext = {
  venueTitle: string;
  venueDescription?: string | null;
  categoryLabel: string;
  categoryTag: ImageCategoryTag;
  searchQuery: string;
  searchTier: SearchTierId;
  preferredOrientation: ImageOrientation;
  compositionTag: string;
  categoryPhrases: string[];
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function haystack(candidate: StockSearchCandidate): string {
  return [
    ...candidate.tags,
    candidate.altDescription ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function overlapScore(tokens: string[], hay: string): number {
  if (!tokens.length) return 0;
  const hits = tokens.filter((t) => hay.includes(t));
  return Math.round((hits.length / tokens.length) * 100);
}

function tierBonus(tier: SearchTierId): number {
  if (tier === "venue") return 15;
  if (tier === "category") return 8;
  return 0;
}

function buildWinReason(breakdown: RelevanceBreakdown, tier: SearchTierId): string {
  const parts: string[] = [];
  if (breakdown.exactNameMatch >= 60) {
    parts.push("strong business name match in photo metadata");
  } else if (breakdown.categoryMatch >= 55) {
    parts.push("category-aligned tags and description");
  } else if (tier === "broader") {
    parts.push("best available broader category match after venue and category searches");
  } else {
    parts.push("combined relevance, quality, and editorial fit");
  }
  if (breakdown.resolution >= 80) parts.push("high resolution");
  if (breakdown.visualConfidence >= 70) parts.push("strong visual confidence");
  return parts.join("; ");
}

export function scoreStockCandidateRelevance(
  candidate: StockSearchCandidate,
  ctx: RelevanceContext
): ScoredStockCandidate | null {
  if (stockCandidateConflictsWithVenue(candidate, ctx.categoryTag)) {
    return null;
  }

  const hay = haystack(candidate);
  const titleTokens = tokenize(ctx.venueTitle);
  const categoryTokens = tokenize(ctx.categoryLabel);
  const queryTokens = tokenize(ctx.searchQuery);
  const phraseTokens = [
    ...new Set(ctx.categoryPhrases.flatMap((p) => tokenize(p))),
  ];

  const baseline = computeBaselineQualityScore({
    width: candidate.width,
    height: candidate.height,
    orientation: candidate.orientation,
    preferredOrientation: ctx.preferredOrientation,
    compositionTag: ctx.compositionTag,
    tags: candidate.tags,
  });

  const breakdown: RelevanceBreakdown = {
    exactNameMatch: overlapScore(titleTokens, hay),
    categoryMatch: Math.max(
      overlapScore(categoryTokens, hay),
      overlapScore(phraseTokens, hay)
    ),
    tagMatch: overlapScore(queryTokens, hay),
    titleMatch: overlapScore(titleTokens, (candidate.altDescription ?? "").toLowerCase()),
    descriptionMatch: ctx.venueDescription
      ? overlapScore(tokenize(ctx.venueDescription), hay)
      : 0,
    visualConfidence: baseline.score,
    resolution: baseline.signals.resolution ?? 50,
    editorialQuality: baseline.signals.editorialAppeal ?? 50,
    tierBonus: tierBonus(ctx.searchTier),
  };

  const relevanceScore = Math.round(
    breakdown.exactNameMatch * 0.22 +
      breakdown.categoryMatch * 0.2 +
      breakdown.tagMatch * 0.12 +
      breakdown.titleMatch * 0.1 +
      breakdown.descriptionMatch * 0.04 +
      breakdown.visualConfidence * 0.14 +
      breakdown.resolution * 0.1 +
      breakdown.editorialQuality * 0.08 +
      breakdown.tierBonus
  );

  return {
    candidate,
    provider: candidate.provider,
    searchQuery: ctx.searchQuery,
    searchTier: ctx.searchTier,
    relevanceScore: Math.max(0, Math.min(100, relevanceScore)),
    breakdown,
    winReason: buildWinReason(breakdown, ctx.searchTier),
  };
}

export function rankScoredCandidates(
  scored: ScoredStockCandidate[]
): ScoredStockCandidate[] {
  return [...scored].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/** Reject scenic-only imagery when category expects an indoor/venue subject. */
export function isObviousScenicMismatch(
  candidate: StockSearchCandidate,
  categoryTag: ImageCategoryTag
): boolean {
  const hay = haystack(candidate);
  const scenicOnly =
    /\b(mountain|mountains|landscape|scenic|ocean waves|desert highway|forest panorama|sunset vista)\b/i.test(
      hay
    );
  if (!scenicOnly) return false;

  const venueCategories = new Set<ImageCategoryTag>([
    "restaurant",
    "coffee_shop",
    "bakery",
    "bowling",
    "escape_room",
    "museum",
    "history_museum",
    "dog_park",
    "arcade",
    "specialty_museum",
  ]);
  return venueCategories.has(categoryTag);
}
