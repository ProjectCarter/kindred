import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { EditorialImageRecord, ImageOrientation } from "./types.ts";
import { classifyImageSubject, type ClassificationInput } from "./taxonomy.ts";
import { EditionImageRegistry } from "./editionRegistry.ts";
import { getEditorialSearchProviders } from "./providers.ts";
import { getCachedSearch, setCachedSearch } from "./searchCache.ts";
import {
  findUnusedLibraryMatch,
  incrementLibrarySkipCount,
  ingestStockImage,
  markLibraryImageUsed,
  rowToRecord,
} from "./library.ts";
import type { StockSearchCandidate } from "./types.ts";
import { computeBaselineQualityScore } from "./quality.ts";
import {
  compositionSearchQuery,
  inferCompositionTag,
  inferDominantColor,
  pickCompositionSlot,
  rankStockCandidates,
} from "./variety.ts";

export type ImageSelectionInput = ClassificationInput & {
  providerImageUrl?: string | null;
  orientation?: ImageOrientation;
};

async function cachedProviderSearch(
  admin: SupabaseClient,
  providerId: string,
  query: string,
  orientation: ImageOrientation,
  searchFn: (query: string, options?: { orientation?: ImageOrientation; perPage?: number }) => Promise<StockSearchCandidate[]>
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

function stockCandidateQuality(
  candidate: StockSearchCandidate,
  preferredOrientation: ImageOrientation,
  compositionTag: string
): number {
  return computeBaselineQualityScore({
    width: candidate.width,
    height: candidate.height,
    orientation: candidate.orientation,
    preferredOrientation,
    compositionTag,
    tags: candidate.tags,
  }).score;
}

/**
 * Priority chain:
 * 1 provider URL (caller passes if present)
 * 2 curated library unused match (ranked by quality_score)
 * 3 provider search ingest (Pexels → Pixabay → future museum sources)
 * null when confidence is low or no acceptable unique image exists
 */
export async function selectEditorialImage(
  admin: SupabaseClient,
  input: ImageSelectionInput,
  registry: EditionImageRegistry
): Promise<EditorialImageRecord | null> {
  const classification = classifyImageSubject(input);
  if (classification.confidence === "low") {
    return null;
  }

  const orientation = input.orientation ?? "portrait";
  const compositionSlot = pickCompositionSlot(
    classification.primary,
    registry.nextCompositionSlotIndex(classification.primary)
  );
  const editorialQuery = compositionSearchQuery(
    classification.searchQuery,
    compositionSlot
  );
  const variety = registry.varietyLedger();

  if (input.providerImageUrl?.trim()) {
    const url = input.providerImageUrl.trim();
    const libraryId = `provider:${url}`;
    if (
      registry.claim({
        libraryId,
        url,
        source: "provider",
        providerImageId: url,
        dominantSubject: classification.primary,
        compositionTag: compositionSlot,
      })
    ) {
      return {
        url,
        libraryId,
        source: "provider",
        orientation,
      };
    }
  }

  const libraryMatch = await findUnusedLibraryMatch(
    admin,
    classification.primary,
    registry.usedLibraryIdSet(),
    {
      compositionTag: compositionSlot,
      avoidCompositions: variety.compositions,
      avoidSubjects: variety.subjects,
      avoidColors: variety.colors,
    }
  );
  if (libraryMatch) {
    const varietyConflict =
      registry.hasLibraryId(libraryMatch.id) ||
      registry.hasUrl(libraryMatch.hosted_url) ||
      registry.hasContentHash(libraryMatch.content_hash) ||
      registry.hasPhotographer(libraryMatch.photographer_name) ||
      registry.hasComposition(libraryMatch.composition_tag) ||
      registry.hasDominantSubject(libraryMatch.dominant_subject) ||
      registry.hasDominantColor(libraryMatch.dominant_color);

    if (varietyConflict) {
      await incrementLibrarySkipCount(admin, libraryMatch.id);
    } else {
      const record = rowToRecord(libraryMatch);
      if (
        registry.claim({
          libraryId: record.libraryId,
          url: record.url,
          source: record.source,
          providerImageId: libraryMatch.original_source_image_id,
          contentHash: libraryMatch.content_hash,
          photographerName: record.photographerName,
          compositionTag: libraryMatch.composition_tag,
          dominantSubject: libraryMatch.dominant_subject,
          dominantColor: libraryMatch.dominant_color,
        })
      ) {
        await markLibraryImageUsed(admin, record.libraryId);
        return record;
      }
      await incrementLibrarySkipCount(admin, libraryMatch.id);
    }
  }

  for (const provider of getEditorialSearchProviders()) {
    const results = await cachedProviderSearch(
      admin,
      provider.id,
      editorialQuery,
      orientation,
      provider.search.bind(provider)
    );

    const ranked = rankStockCandidates(
      results,
      (candidate) => stockCandidateQuality(candidate, orientation, compositionSlot),
      variety,
      compositionSlot,
      classification.primary
    );

    for (const candidate of ranked) {
      if (registry.hasProviderId(provider.id, candidate.providerImageId)) continue;
      if (registry.hasPhotographer(candidate.photographerName)) continue;

      const ingested = await ingestStockImage(
        admin,
        candidate,
        classification.primary,
        classification.secondary,
        classification.environmentTags,
        {
          compositionTag: compositionSlot,
          inferComposition: inferCompositionTag,
          inferDominantColor,
        }
      );
      if (!ingested) continue;

      const dominantColor = inferDominantColor(candidate.tags);
      if (
        registry.claim({
          libraryId: ingested.libraryId,
          url: ingested.url,
          source: ingested.source,
          providerImageId: candidate.providerImageId,
          photographerName: ingested.photographerName,
          compositionTag: compositionSlot,
          dominantSubject: compositionSlot,
          dominantColor,
        })
      ) {
        await markLibraryImageUsed(admin, ingested.libraryId);
        return ingested;
      }
    }
  }

  return null;
}
