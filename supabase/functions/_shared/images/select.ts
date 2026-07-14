import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { EditorialImageRecord, ImageOrientation } from "./types.ts";
import { classifyImageSubject, type ClassificationInput } from "./taxonomy.ts";
import { EditionImageRegistry } from "./editionRegistry.ts";
import {
  findLibraryImageForVenue,
  findUnusedLibraryMatch,
  incrementLibrarySkipCount,
  rowToRecord,
  markLibraryImageUsed,
} from "./library.ts";
import {
  extractCityState,
  venueLibraryTag,
} from "../venueClassification.ts";
import { pickCompositionSlot } from "./variety.ts";
import { searchEditorialStockImage } from "./editorialImageEngine.ts";

export type ImageSelectionInput = ClassificationInput & {
  providerImageUrl?: string | null;
  orientation?: ImageOrientation;
};

function tryClaimLibraryRow(
  admin: SupabaseClient,
  row: Awaited<ReturnType<typeof findUnusedLibraryMatch>>,
  registry: EditionImageRegistry,
  compositionSlot: string,
  classificationPrimary: string
): EditorialImageRecord | null {
  if (!row) return null;

  const variety = registry.varietyLedger();
  const varietyConflict =
    registry.hasLibraryId(row.id) ||
    registry.hasUrl(row.hosted_url) ||
    registry.hasContentHash(row.content_hash) ||
    registry.hasPhotographer(row.photographer_name) ||
    registry.hasComposition(row.composition_tag) ||
    registry.hasDominantSubject(row.dominant_subject) ||
    registry.hasDominantColor(row.dominant_color);

  if (varietyConflict) {
    void incrementLibrarySkipCount(admin, row.id);
    return null;
  }

  const record = rowToRecord(row);
  if (
    registry.claim({
      libraryId: record.libraryId,
      url: record.url,
      source: record.source,
      providerImageId: row.original_source_image_id,
      contentHash: row.content_hash,
      photographerName: record.photographerName,
      compositionTag: row.composition_tag,
      dominantSubject: row.dominant_subject ?? classificationPrimary,
      dominantColor: row.dominant_color,
    })
  ) {
    void markLibraryImageUsed(admin, record.libraryId);
    return record;
  }

  void incrementLibrarySkipCount(admin, row.id);
  return null;
}

/**
 * Priority chain:
 * 1 provider URL (caller passes if present)
 * 2 curated library match for this exact venue (reuse)
 * 3 curated library unused match by category
 * 4 provider search — venue+place, venue+category, editorial substitute
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
  const variety = registry.varietyLedger();

  const title = input.title?.trim() ?? "";
  const { city: parsedCity } = extractCityState(input.address);
  const city = input.city?.trim() || parsedCity;
  const venueTag = title ? venueLibraryTag(title, city) : null;

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

  if (venueTag) {
    const venueMatch = await findLibraryImageForVenue(
      admin,
      venueTag,
      registry.usedLibraryIdSet()
    );
    const claimed = tryClaimLibraryRow(
      admin,
      venueMatch,
      registry,
      compositionSlot,
      classification.primary
    );
    if (claimed) return claimed;
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
  const categoryClaimed = tryClaimLibraryRow(
    admin,
    libraryMatch,
    registry,
    compositionSlot,
    classification.primary
  );
  if (categoryClaimed) return categoryClaimed;

  const stockResult = await searchEditorialStockImage(admin, {
    title: input.title,
    dek: input.dek,
    address: input.address,
    city,
    venueCategories: input.venueCategories,
    discoveryCategory: input.discoveryCategory,
    classification,
    orientation,
    compositionSlot,
    venueTag,
    registry,
  });
  if (stockResult) return stockResult.record;

  return null;
}
