import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { HeroArtworkCollectionId } from "./collections.ts";
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
import type { HeroArtworkRecord, HeroArtworkSelectionContext } from "./types.ts";
import { selectDailyHeroArtwork, getSeason, parseEditionDate } from "./select.ts";

const MIN_POOL_SIZE = 3;
const MAX_DISCOVERY_ATTEMPTS = 8;

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

function countAvailable(
  catalog: HeroArtworkRecord[],
  recentArtworkIds: string[]
): number {
  return catalog.filter((artwork) => !recentArtworkIds.includes(artwork.id))
    .length;
}

/**
 * Automatically discover and verify open-access hero artwork when the pool
 * is thin. No manual catalog maintenance — providers supply candidates.
 */
export async function ensureHeroArtworkPool(
  admin: SupabaseClient,
  editionDate: string,
  context: HeroArtworkSelectionContext,
  anthropicApiKey: string
): Promise<HeroArtworkRecord[]> {
  const rotation = await listRecentHeroArtworkRotation(admin);
  const recentArtworkIds = [
    ...(context.recentArtworkIds ?? []),
    ...rotation.recentArtworkIds,
  ];

  let catalog = await listApprovedHeroArtwork(admin);
  if (countAvailable(catalog, recentArtworkIds) >= MIN_POOL_SIZE) {
    return catalog;
  }

  const date = parseEditionDate(editionDate);
  const season = context.season ?? getSeason(date.getMonth() + 1);
  const collectionId = pickDiscoveryCollection(editionDate, season);
  const collection = getCollection(collectionId);
  const queries = searchQueriesForCollection(collectionId, editionDate);

  console.log("[heroArtwork] auto-discovery starting", {
    editionDate,
    collectionId,
    poolSize: catalog.length,
    available: countAvailable(catalog, recentArtworkIds),
  });

  let attempts = 0;
  for (const query of queries) {
    if (countAvailable(catalog, recentArtworkIds) >= MIN_POOL_SIZE) break;
    if (attempts >= MAX_DISCOVERY_ATTEMPTS) break;

    const candidates = await searchWikimediaHeroCandidates(query, 8);
    for (const candidate of candidates) {
      if (attempts >= MAX_DISCOVERY_ATTEMPTS) break;
      attempts += 1;

      const providerId = String(candidate.providerImageId);
      if (
        await heroArtworkExistsByProviderId(admin, "wikimedia", providerId)
      ) {
        continue;
      }

      const artist = candidate.photographerName?.trim() || "Unknown artist";
      const title =
        candidate.altDescription?.trim() || "Untitled artwork";

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
        anthropicApiKey,
      });

      if (!aboutBody) continue;

      const draft = wikimediaCandidateToDraft(
        candidate,
        collectionId,
        aboutBody,
        editionDate
      );

      const record = await upsertVerifiedHeroArtwork(admin, draft);
      if (record) {
        catalog = [...catalog, record];
        console.log("[heroArtwork] auto-discovered artwork", {
          internalId: record.internalId,
          title: record.artworkTitle,
        });
      }
    }
  }

  return catalog;
}

export async function selectDailyHeroFromPool(
  catalog: HeroArtworkRecord[],
  editionDate: string,
  context: HeroArtworkSelectionContext
): Promise<HeroArtworkRecord | null> {
  return selectDailyHeroArtwork(catalog, { ...context, date: editionDate });
}
