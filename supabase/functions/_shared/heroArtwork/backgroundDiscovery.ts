import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { HeroArtworkCollectionId, HeroArtworkRecord } from "./types.ts";
import { primaryCollection } from "./collections.ts";
import {
  getHeroArtworkById,
  listApprovedHeroArtwork,
  upsertVerifiedHeroArtwork,
} from "./library.ts";
import {
  pickDiscoveryCollection,
  searchQueriesForCollection,
} from "./discoveryQueries.ts";
import {
  searchWikimediaHeroCandidates,
  wikimediaCandidateToDraft,
} from "./wikimediaProvider.ts";
import { writeAboutArtworkBody } from "./writeAboutArtwork.ts";
import { groundHeroArtworkMetadata } from "./grounding.ts";
import { getCollection } from "./collections.ts";
import type { HeroArtworkSelectionContext } from "./types.ts";
import { getSeason, parseEditionDate } from "./select.ts";
import { hostHeroArtworkImage } from "./hosting.ts";

const MIN_LIBRARY_GROWTH_TARGET = 5;
const MAX_DISCOVERY_ATTEMPTS = 12;

export type GrowHeroArtworkLibraryInput = {
  /** ISO date used for seasonal discovery bias — defaults to today UTC. */
  editionDate?: string;
  context?: HeroArtworkSelectionContext;
  anthropicApiKey: string;
  /** Stop after successfully adding this many new artworks. */
  targetNewCount?: number;
};

export type GrowHeroArtworkLibraryResult = {
  catalogSize: number;
  added: number;
  attempts: number;
  collectionId: HeroArtworkCollectionId;
};

async function heroArtworkExistsByProviderId(
  admin: SupabaseClient,
  provider: string,
  providerArtworkId: string
): Promise<boolean> {
  const { data } = await admin
    .from("kindred_hero_artwork")
    .select("id")
    .eq("source_provider", provider)
    .eq("source_provider_artwork_id", providerArtworkId)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Background library growth — Wikimedia search, Claude editorial copy,
 * image hosting, and DB upsert. Never called during edition build.
 */
export async function growHeroArtworkLibrary(
  admin: SupabaseClient,
  input: GrowHeroArtworkLibraryInput
): Promise<GrowHeroArtworkLibraryResult> {
  const editionDate =
    input.editionDate ?? new Date().toISOString().slice(0, 10);
  const targetNewCount = input.targetNewCount ?? MIN_LIBRARY_GROWTH_TARGET;
  const date = parseEditionDate(editionDate);
  const season =
    input.context?.season ?? getSeason(date.getMonth() + 1);
  const collectionId = pickDiscoveryCollection(editionDate, season);
  const collection = getCollection(collectionId);
  const queries = searchQueriesForCollection(collectionId, editionDate);

  let catalog = await listApprovedHeroArtwork(admin);
  let added = 0;
  let attempts = 0;

  console.log("[heroArtwork:grow] background discovery starting", {
    editionDate,
    collectionId,
    catalogSize: catalog.length,
    targetNewCount,
  });

  for (const query of queries) {
    if (added >= targetNewCount) break;
    if (attempts >= MAX_DISCOVERY_ATTEMPTS) break;

    const candidates = await searchWikimediaHeroCandidates(query, 8);
    for (const candidate of candidates) {
      if (added >= targetNewCount) break;
      if (attempts >= MAX_DISCOVERY_ATTEMPTS) break;
      attempts += 1;

      const providerId = String(candidate.providerImageId);
      if (await heroArtworkExistsByProviderId(admin, "wikimedia", providerId)) {
        continue;
      }

      const artist = candidate.photographerName?.trim() || "Unknown artist";
      const title = candidate.altDescription?.trim() || "Untitled artwork";

      const grounding = await groundHeroArtworkMetadata(admin, {
        artist,
        artworkTitle: title,
      });

      const aboutBody = await writeAboutArtworkBody({
        artworkTitle: title,
        artist,
        year: null,
        sourceInstitution: "Wikimedia Commons",
        sourceUrl: candidate.sourcePageUrl,
        collectionTitle: collection.title,
        groundingText: grounding?.summary ?? grounding?.extract ?? null,
        imageDescription: candidate.altDescription,
        anthropicApiKey: input.anthropicApiKey,
      });

      if (!aboutBody) continue;

      const storagePath = `wikimedia/${providerId}.webp`;
      const hosted = await hostHeroArtworkImage(admin, {
        downloadUrl: candidate.downloadUrl,
        storagePath,
        sourceWidth: candidate.width,
        sourceHeight: candidate.height,
        preferWebp: true,
      });
      if (!hosted) continue;

      const draft = wikimediaCandidateToDraft(
        candidate,
        collectionId,
        aboutBody,
        editionDate
      );

      const record = await upsertVerifiedHeroArtwork(admin, {
        ...draft,
        hostedUrl: hosted.hostedUrl,
        storagePath: hosted.storagePath,
        imageUrl: hosted.hostedUrl,
        imageWidth: hosted.imageWidth,
        imageHeight: hosted.imageHeight,
        aspectRatio: hosted.aspectRatio,
      });

      if (record) {
        catalog = [...catalog, record];
        added += 1;
        console.log("[heroArtwork:grow] added artwork", {
          internalId: record.internalId,
          title: record.artworkTitle,
          hostedUrl: record.hostedUrl,
        });
      }
    }
  }

  console.log("[heroArtwork:grow] complete", {
    catalogSize: catalog.length,
    added,
    attempts,
    collectionId,
  });

  return {
    catalogSize: catalog.length,
    added,
    attempts,
    collectionId,
  };
}

/** Recent rotation for scoring — shared with edition selection. */
export async function listRecentHeroArtworkRotation(
  admin: SupabaseClient,
  limit = 14
): Promise<{
  recentArtworkIds: string[];
  recentCollectionIds: HeroArtworkCollectionId[];
}> {
  const { data, error } = await admin
    .from("kindred_hero_artwork_edition_selections")
    .select("artwork_id, edition_date")
    .order("edition_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[heroArtwork] recent rotation query failed", error.message);
    return { recentArtworkIds: [], recentCollectionIds: [] };
  }

  const artworkIds = (data ?? []).map((row) => row.artwork_id as string);
  const recentCollectionIds: HeroArtworkCollectionId[] = [];

  for (const artworkId of artworkIds) {
    const artwork = await getHeroArtworkById(admin, artworkId);
    const primary = artwork ? primaryCollection(artwork.collections) : null;
    if (primary) recentCollectionIds.push(primary);
  }

  return { recentArtworkIds: artworkIds, recentCollectionIds };
}
