import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { DiscoveryItem } from "../discovery/types.ts";
import type { DiscoveryPayload } from "../discovery/types.ts";
import type { EditorialImageRecord } from "./types.ts";
import { EditionImageRegistry } from "./editionRegistry.ts";
import { selectEditorialImage } from "./select.ts";
import { MAX_IMAGES_PER_CATEGORY_SEED } from "./types.ts";
import { searchQueryForTag, type ImageCategoryTag } from "./taxonomy.ts";
import { searchPexels } from "./pexels.ts";
import { ingestStockImage } from "./library.ts";

const GILBERT_SEED_CATEGORIES: ImageCategoryTag[] = [
  "coffee_shop",
  "park",
  "museum",
  "country_club",
  "lake",
  "scenic_drive",
  "bowling",
  "escape_room",
  "library",
  "storytime",
  "painting_class",
  "cooking_class",
  "theater",
  "networking_event",
  "family_event",
];

export async function seedImageLibraryForMetro(
  admin: SupabaseClient,
  options?: { categories?: ImageCategoryTag[]; environmentTags?: string[] }
): Promise<{ seeded: number; skipped: number }> {
  const categories = options?.categories ?? GILBERT_SEED_CATEGORIES;
  const environmentTags = options?.environmentTags ?? ["arizona"];
  let seeded = 0;
  let skipped = 0;

  for (const category of categories) {
    const { count } = await admin
      .from("kindred_image_library")
      .select("id", { count: "exact", head: true })
      .eq("primary_category", category)
      .eq("approval_status", "approved");

    const have = count ?? 0;
    if (have >= MAX_IMAGES_PER_CATEGORY_SEED) {
      skipped += 1;
      continue;
    }

    const query = searchQueryForTag(category, environmentTags);
    const results = await searchPexels(query, {
      orientation: "portrait",
      perPage: MAX_IMAGES_PER_CATEGORY_SEED,
    });

    for (const candidate of results.slice(0, MAX_IMAGES_PER_CATEGORY_SEED - have)) {
      const ingested = await ingestStockImage(
        admin,
        candidate,
        category,
        [],
        environmentTags
      );
      if (ingested) seeded += 1;
    }
  }

  return { seeded, skipped };
}

function attachEditorialImage(
  item: DiscoveryItem,
  image: EditorialImageRecord | null
): void {
  if (!image) return;
  item.editorialImage = image;
}

export async function enrichDiscoveryImages(
  admin: SupabaseClient,
  discovery: DiscoveryPayload,
  options?: {
    banditPickItemId?: string | null;
    seedIfSparse?: boolean;
  }
): Promise<DiscoveryPayload> {
  if (options?.seedIfSparse !== false) {
    try {
      const seed = await seedImageLibraryForMetro(admin, {
        environmentTags: discovery.location.state
          ? [discovery.location.state.toLowerCase()]
          : [],
      });
      console.log("[images:enrich] library seed", seed);
    } catch (err) {
      console.warn("[images:enrich] seed failed", err);
    }
  }

  const registry = new EditionImageRegistry();
  const enriched: DiscoveryPayload = structuredClone(discovery);

  for (const surface of Object.values(enriched.surfaces)) {
    if (!surface?.items?.length) continue;
    for (const ranked of surface.items) {
      const item = ranked.item;
      const isBanditPick = options?.banditPickItemId === item.id;
      const image = await selectEditorialImage(
        admin,
        {
          title: item.title,
          dek: item.dek,
          venueCategories: item.venueCategories,
          discoveryCategory: item.category,
          address: item.address,
          city: item.place?.city ?? null,
          environment: discovery.location.state,
          orientation: isBanditPick ? "landscape" : "portrait",
        },
        registry
      );
      attachEditorialImage(item, image);
    }
  }

  return enriched;
}

export function findDiscoveryItemById(
  discovery: DiscoveryPayload,
  itemId: string
): DiscoveryItem | null {
  for (const surface of Object.values(discovery.surfaces)) {
    if (!surface?.items?.length) continue;
    for (const ranked of surface.items) {
      if (ranked.item.id === itemId) return ranked.item;
    }
  }
  return null;
}
