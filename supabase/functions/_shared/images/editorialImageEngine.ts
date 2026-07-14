import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type {
  EditorialImageRecord,
  EditorialImageSelectionReport,
  ImageOrientation,
  StockSearchCandidate,
} from "./types.ts";
import type { ClassificationResult } from "./taxonomy.ts";
import type { ImageSearchProvider } from "./providers.ts";
import { getEditorialSearchProviders } from "./providers.ts";
import { getCachedSearch, setCachedSearch } from "./searchCache.ts";
import {
  buildEditorialImageSearchPlan,
  flattenSearchPlan,
  type SearchTierGroup,
} from "./searchPlan.ts";
import {
  isObviousScenicMismatch,
  rankScoredCandidates,
  scoreStockCandidateRelevance,
  type ScoredStockCandidate,
} from "./relevance.ts";
import { stockCandidateConflictsWithVenue } from "./quality.ts";
import { compositionSearchQuery } from "./variety.ts";
import { resolveVerifiedEditorialCategory, editorialImagePhrasesFor } from "../editorialCategory.ts";
import { extractCityState } from "../venueClassification.ts";
import type { EditionImageRegistry } from "./editionRegistry.ts";
import { ingestStockImage, markLibraryImageUsed } from "./library.ts";
import {
  inferCompositionTag,
  inferDominantColor,
  rankStockCandidates,
} from "./variety.ts";

export type EditorialStockSearchInput = {
  title?: string | null;
  dek?: string | null;
  address?: string | null;
  city?: string | null;
  venueCategories?: string[] | null;
  discoveryCategory?: string | null;
  classification: ClassificationResult;
  orientation: ImageOrientation;
  compositionSlot: string;
  venueTag: string | null;
  registry: EditionImageRegistry;
};

async function cachedProviderSearch(
  admin: SupabaseClient,
  providerId: string,
  query: string,
  orientation: ImageOrientation,
  searchFn: (
    query: string,
    options?: { orientation?: ImageOrientation; perPage?: number }
  ) => Promise<StockSearchCandidate[]>
): Promise<StockSearchCandidate[]> {
  const cached = await getCachedSearch<StockSearchCandidate>(
    admin,
    providerId,
    `${query}|${orientation}`
  );
  if (cached) return cached;

  const results = await searchFn(query, { orientation, perPage: 8 });
  if (results.length) {
    await setCachedSearch(admin, providerId, `${query}|${orientation}`, results);
  }
  return results;
}

async function searchProvidersParallel(
  admin: SupabaseClient,
  providers: ImageSearchProvider[],
  query: string,
  orientation: ImageOrientation
): Promise<Array<{ candidate: StockSearchCandidate; provider: string }>> {
  const batches = await Promise.all(
    providers.map(async (provider) => {
      const results = await cachedProviderSearch(
        admin,
        provider.id,
        query,
        orientation,
        provider.search.bind(provider)
      );
      return results.map((candidate) => ({
        candidate,
        provider: provider.id,
      }));
    })
  );
  return batches.flat();
}

function toSelectionReport(
  winner: ScoredStockCandidate,
  attemptedQueries: string[]
): EditorialImageSelectionReport {
  return {
    provider: winner.provider,
    searchTermsAttempted: attemptedQueries,
    selectedQuery: winner.searchQuery,
    searchTier: winner.searchTier,
    relevanceScore: winner.relevanceScore,
    winReason: winner.winReason,
    breakdown: winner.breakdown,
  };
}

function logSelectionReport(
  title: string,
  report: EditorialImageSelectionReport
): void {
  console.log(
    "[images:engine]",
    JSON.stringify({
      title,
      provider: report.provider,
      selectedQuery: report.selectedQuery,
      searchTier: report.searchTier,
      relevanceScore: report.relevanceScore,
      winReason: report.winReason,
      searchTermsAttempted: report.searchTermsAttempted,
    })
  );
}

async function scoreTierCandidates(
  input: EditorialStockSearchInput,
  tier: SearchTierGroup,
  providers: ImageSearchProvider[],
  admin: SupabaseClient
): Promise<ScoredStockCandidate[]> {
  const title = input.title?.trim() ?? "";
  const verified = resolveVerifiedEditorialCategory({
    title,
    dek: input.dek,
    venueCategories: input.venueCategories,
    discoveryCategory: input.discoveryCategory,
    address: input.address,
  });
  const categoryPhrases = editorialImagePhrasesFor(verified.categoryId);
  const scored: ScoredStockCandidate[] = [];

  for (const baseQuery of tier.queries) {
    const editorialQuery = compositionSearchQuery(baseQuery, input.compositionSlot);
    const parallel = await searchProvidersParallel(
      admin,
      providers,
      editorialQuery,
      input.orientation
    );

    for (const { candidate, provider } of parallel) {
      if (
        stockCandidateConflictsWithVenue(candidate, input.classification.primary) ||
        isObviousScenicMismatch(candidate, input.classification.primary)
      ) {
        continue;
      }

      const result = scoreStockCandidateRelevance(candidate, {
        venueTitle: title,
        venueDescription: input.dek,
        categoryLabel: verified.displayLabel,
        categoryTag: input.classification.primary,
        searchQuery: editorialQuery,
        searchTier: tier.tier,
        preferredOrientation: input.orientation,
        compositionTag: input.compositionSlot,
        categoryPhrases,
      });

      if (result) {
        scored.push({ ...result, provider });
      }
    }
  }

  return rankScoredCandidates(scored);
}

/**
 * Multi-provider editorial image engine — searches Unsplash, Pixabay, and
 * Pexels in parallel per tier, scores relevance, and returns the best match.
 */
export async function searchEditorialStockImage(
  admin: SupabaseClient,
  input: EditorialStockSearchInput
): Promise<{ record: EditorialImageRecord; report: EditorialImageSelectionReport } | null> {
  const title = input.title?.trim() ?? "";
  const { city: parsedCity, state } = extractCityState(input.address);
  const city = input.city?.trim() || parsedCity;

  const verified = resolveVerifiedEditorialCategory({
    title,
    dek: input.dek,
    venueCategories: input.venueCategories,
    discoveryCategory: input.discoveryCategory,
    address: input.address,
  });

  const plan = buildEditorialImageSearchPlan({
    title,
    city,
    state,
    category: verified,
  });
  const attemptedQueries = flattenSearchPlan(plan);
  const providers = getEditorialSearchProviders();
  if (!providers.length) return null;

  const variety = input.registry.varietyLedger();

  for (const tier of plan) {
    const scored = await scoreTierCandidates(input, tier, providers, admin);
    const acceptable = scored.filter((s) => s.relevanceScore >= tier.minAcceptScore);
    if (!acceptable.length) continue;

    const varietyRanked = rankStockCandidates(
      acceptable.map((s) => s.candidate),
      (candidate) => {
        const match = acceptable.find(
          (s) =>
            s.candidate.providerImageId === candidate.providerImageId &&
            s.candidate.provider === candidate.provider
        );
        return match?.relevanceScore ?? 0;
      },
      variety,
      input.compositionSlot,
      input.classification.primary
    );

    for (const candidate of varietyRanked) {
      const winner = acceptable.find(
        (s) =>
          s.candidate.providerImageId === candidate.providerImageId &&
          s.candidate.provider === candidate.provider
      );
      if (!winner) continue;

      if (input.registry.hasProviderId(winner.provider, candidate.providerImageId)) {
        continue;
      }
      if (input.registry.hasPhotographer(candidate.photographerName)) continue;

      const ingested = await ingestStockImage(
        admin,
        candidate,
        input.classification.primary,
        input.classification.secondary,
        input.classification.environmentTags,
        {
          compositionTag: input.compositionSlot,
          inferComposition: inferCompositionTag,
          inferDominantColor,
          venueTag: input.venueTag,
        }
      );
      if (!ingested) continue;

      const dominantColor = inferDominantColor(candidate.tags);
      if (
        input.registry.claim({
          libraryId: ingested.libraryId,
          url: ingested.url,
          source: ingested.source,
          providerImageId: candidate.providerImageId,
          photographerName: ingested.photographerName,
          compositionTag: input.compositionSlot,
          dominantSubject: input.compositionSlot,
          dominantColor,
        })
      ) {
        await markLibraryImageUsed(admin, ingested.libraryId);
        const report = toSelectionReport(winner, attemptedQueries);
        logSelectionReport(title, report);
        return {
          record: { ...ingested, selectionReport: report },
          report,
        };
      }
    }
  }

  return null;
}
