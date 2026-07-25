import {
  DISCOVERY_SEED_CATALOG,
  localEventsAsDiscoveryItems,
  localPlacesAsDiscoveryItems,
} from "./catalog.ts";
import { npsParksAsDiscoveryItems } from "../nps/catalog.ts";
import { scoreDiscoveryItem } from "./score.ts";
import { formatDiscoveryBrief, selectDiscoverySurface, whyLine } from "./select.ts";
import { seasonForDate } from "./taxonomy.ts";
import { discoveryItemsForEnrichment } from "../editorial/confidencePayload.ts";
import { isDiscoveryQualityExcluded } from "../editorial/discoveryQualityFilter.ts";
import type {
  DiscoveryItem,
  DiscoveryPayload,
  DiscoveryRankingContext,
  DiscoverySurface,
  DiscoverySurfaceResult,
} from "./types.ts";

function parseEditionDate(editionDate: string, fallback: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
    const [y, m, d] = editionDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return fallback;
}

function defaultSurfaces(ctx: DiscoveryRankingContext): DiscoverySurface[] {
  if (ctx.surfaces?.length) return ctx.surfaces;
  const out: DiscoverySurface[] = ["hidden_gems"];
  if (ctx.isSunday) out.unshift("bandits_picks");
  if (ctx.isWeekend) out.push("weekend_ideas");
  // Every single-category desk, every day — Weekend Escapes, Bandit's
  // Notebook, and Recommendations each depend on this full roster to stay
  // abundant and non-repetitive. Narrowing this list starves those
  // sections even when the seed catalog has content to give them.
  out.push(
    "coffee",
    "restaurants",
    "beaches",
    "hiking",
    "museums",
    "parks",
    "scenic_drives",
    "books",
    "movies",
    "podcasts",
    "recipes",
    "activities",
    "bakeries",
    "gardens"
  );
  return Array.from(new Set(out));
}

/**
 * Discovery Engine entry point — reusable for every recommendation surface.
 * Returns a DiscoveryPayload to store on editions.discovery (no UI required).
 */
export function runDiscoveryDecisions(
  input: DiscoveryRankingContext
): DiscoveryPayload {
  const now = input.now ?? new Date();
  const date = parseEditionDate(input.editionDate, now);
  const ctx: DiscoveryRankingContext = {
    ...input,
    now,
    season: input.season ?? seasonForDate(date),
    isWeekend:
      input.isWeekend ?? (date.getDay() === 0 || date.getDay() === 6),
    isSunday: input.isSunday ?? date.getDay() === 0,
  };

  const catalog = [
    ...DISCOVERY_SEED_CATALOG,
    ...localEventsAsDiscoveryItems(ctx.localEvents ?? []),
    ...localPlacesAsDiscoveryItems(ctx.localPlaces ?? []),
    ...npsParksAsDiscoveryItems(ctx.npsParks ?? []),
  ]
    // Discovery Quality Filter (Constitutional Amendment V3): the single
    // eligibility gate every surface shares, applied before any scoring so a
    // restricted / service / editorially-excluded listing can never be
    // recommended in Activities, Food & Drinks, Recommendations, or any desk.
    .filter(
      (item) =>
        !isDiscoveryQualityExcluded({
          name: item.title,
          venueCategories: item.venueCategories,
          category: item.category,
          dek: item.dek,
          description: item.about,
          tags: item.tags,
        })
    );

  const ranked = catalog
    .map((item) => scoreDiscoveryItem(item, ctx))
    .sort((a, b) => b.score - a.score);

  const surfacesWanted = defaultSurfaces(ctx);
  const surfaces: Partial<Record<DiscoverySurface, DiscoverySurfaceResult>> =
    {};

  for (const surface of surfacesWanted) {
    const result = selectDiscoverySurface(ranked, surface, ctx);
    if (result.items.length) surfaces[surface] = result;
  }

  const picks: DiscoveryPayload["picks"] = [];
  const seen = new Set<string>();
  const publishedIds = new Set<string>();
  for (const result of Object.values(surfaces)) {
    if (!result) continue;
    for (const item of result.items) {
      if (seen.has(item.item.id)) continue;
      seen.add(item.item.id);
      publishedIds.add(item.item.id);
      picks.push({
        id: item.item.id,
        title: item.item.title,
        category: item.item.category,
        surface: result.surface,
        why: whyLine(item),
      });
    }
  }

  const enrichQueue: DiscoveryItem[] = discoveryItemsForEnrichment(
    catalog.filter((item) => !publishedIds.has(item.id))
  );

  const editorNotes = [
    "Recommendations curated like a magazine desk — not a social feed.",
    ctx.isSunday ? "Sunday What's Special Right Now assembled." : "",
    ctx.isWeekend ? "Weekend Ideas weather- and season-aware." : "",
    (ctx.localEvents?.length ?? 0) > 0
      ? "Local events folded into discovery candidates."
      : "",
    (ctx.localPlaces?.length ?? 0) > 0
      ? "Verified local places (Foursquare) folded into discovery candidates."
      : "",
  ].filter(Boolean);

  const payload: DiscoveryPayload = {
    version: 1,
    generatedAt: now.toISOString(),
    editionDate: ctx.editionDate,
    location: {
      city: ctx.city,
      region: ctx.region,
      state: ctx.state,
      lat: ctx.readerLat ?? null,
      lon: ctx.readerLon ?? null,
    },
    surfaces,
    picks,
    editorBrief: formatDiscoveryBrief(surfaces),
    selectionMeta: {
      candidateCount: catalog.length,
      selectedCount: picks.length,
      editorNotes,
      enrichQueue,
    },
  };

  console.log("[discovery] decisions", {
    candidateCount: catalog.length,
    surfaces: Object.keys(surfaces),
    pickCount: picks.length,
    city: ctx.city,
    season: ctx.season,
    weekend: ctx.isWeekend,
  });

  return payload;
}
