import { isPlaceholderCopy } from "../contentQuality.ts";
import {
  containsEngineLanguage,
  INTERNAL_REASON_CODES,
} from "../editorial/readerVoice.ts";
import {
  DISCOVERY_PUBLISH_MIN_SCORE,
  publishDiscoveryItems,
} from "../editorial/publishing.ts";
import {
  SURFACE_CATEGORIES,
  SURFACE_EDITOR_NOTES,
  SURFACE_HEADLINES,
} from "./taxonomy.ts";
import type {
  DiscoveryRankingContext,
  DiscoverySurface,
  DiscoverySurfaceResult,
  RankedDiscoveryItem,
} from "./types.ts";
import {
  passesLocalDiscoveryRadius,
  surfaceUsesLocalDiscoveryRadius,
} from "./localDiscoveryScope.ts";

/** Place-like categories must come from verified local data, not seed templates. */
const PLACE_CATEGORIES = new Set([
  "coffee",
  "restaurants",
  "hiking",
  "beaches",
  "parks",
  "museums",
  "scenic_drives",
  "experiences",
  "activities",
  "bakeries",
  "gardens",
]);

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when this desk pick already appeared in a recent edition. */
function isRecentlyRecommended(
  item: RankedDiscoveryItem["item"],
  recentKeys: string[]
): boolean {
  if (!recentKeys.length) return false;
  const titleKey = normalizeKey(item.title).slice(0, 60);
  const idKey = normalizeKey(item.id);
  return recentKeys.some((raw) => {
    const key = normalizeKey(raw);
    if (!key) return false;
    return key.slice(0, 60) === titleKey || key === idKey;
  });
}

export function whyLine(item: RankedDiscoveryItem): string {
  const top = item.reasons
    .filter(
      (r) =>
        r.weight > 0 &&
        !INTERNAL_REASON_CODES.has(String(r.code)) &&
        !isPlaceholderCopy(r.label) &&
        !containsEngineLanguage(r.label) &&
        !/magazine desk|tend to care|algorithm|score|held back|trusted source/i.test(
          r.label
        )
    )
    .slice(0, 2)
    .map((r) => r.label);
  if (top.length) return top.join(" ");
  return "";
}

/**
 * @param allowSeedFallback When false (the default pass), Kindred Desk seed
 *   templates never count as a "verified" place — real, named venues should
 *   always win when they exist. `selectDiscoverySurface` only flips this to
 *   true for a surface where the strict pass came back completely empty,
 *   so a generic desk pick can act as a safety net (e.g. Activities on a
 *   city+day where Foursquare's niche categories all came back empty)
 *   without ever crowding out real local data.
 */
function isVerifiedPlaceItem(
  item: RankedDiscoveryItem,
  allowSeedFallback = false
): boolean {
  const cat = item.item.category;
  if (item.item.tags.includes("nps_park")) {
    const confidence = item.item.providerConfidence ?? 0.75;
    if (confidence < 0.6) return false;
    const npsCategories = new Set([
      "hiking",
      "parks",
      "scenic_drives",
      "museums",
      "experiences",
    ]);
    if (!npsCategories.has(cat)) return false;
  }
  if (!PLACE_CATEGORIES.has(cat)) return true;
  if (item.item.id.startsWith("event_")) return true;
  if (item.item.source?.tier === "local" && item.item.url) return true;
  if (item.item.place?.city && item.item.source?.url) return true;
  if (item.item.source?.name === "Kindred Desk") return allowSeedFallback;
  if (isPlaceholderCopy(item.item.title) || isPlaceholderCopy(item.item.dek)) {
    return false;
  }
  return true;
}

/**
 * Assemble one discovery surface — publish every candidate above the
 * editorial quality threshold, ranked highest to lowest. No arbitrary caps.
 */
export function selectDiscoverySurface(
  ranked: RankedDiscoveryItem[],
  surface: DiscoverySurface,
  ctx: DiscoveryRankingContext
): DiscoverySurfaceResult {
  const allowed = new Set(SURFACE_CATEGORIES[surface]);
  const minScore = ctx.publishMinScore ?? DISCOVERY_PUBLISH_MIN_SCORE;
  const recentKeys = ctx.recentKeys ?? [];

  const strictPool = ranked.filter(
    (r) =>
      allowed.has(r.item.category) &&
      isVerifiedPlaceItem(r, false) &&
      (!surfaceUsesLocalDiscoveryRadius(surface) ||
        passesLocalDiscoveryRadius(r, ctx))
  );
  const pool = (
    strictPool.length > 0
      ? strictPool
      : ranked.filter(
          (r) =>
            allowed.has(r.item.category) &&
            isVerifiedPlaceItem(r, true) &&
            (!surfaceUsesLocalDiscoveryRadius(surface) ||
              passesLocalDiscoveryRadius(r, ctx))
        )
  ).sort((a, b) => b.score - a.score);

  const ordered =
    surface === "hidden_gems"
      ? [...pool].sort(
          (a, b) =>
            b.item.uniqueness * 2 +
            b.score / 100 -
            (a.item.uniqueness * 2 + a.score / 100)
        )
      : pool;

  const fresh = ordered.filter(
    (candidate) => !isRecentlyRecommended(candidate.item, recentKeys)
  );
  let selected = publishDiscoveryItems(fresh, minScore);

  if (!selected.length) {
    selected = publishDiscoveryItems(ordered, minScore);
  }

  if (!selected.length && ordered.length > 0) {
    selected = ordered
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }

  return {
    surface,
    headline: SURFACE_HEADLINES[surface],
    editorNote: SURFACE_EDITOR_NOTES[surface],
    items: selected.map((s) => ({
      ...s,
      surfaces: [...new Set([...s.surfaces, surface])],
      reasons: [
        {
          code: `surface_${surface}`,
          label: SURFACE_EDITOR_NOTES[surface],
          weight: 12,
        },
        ...s.reasons,
      ],
    })),
  };
}

export function formatDiscoveryBrief(
  surfaces: Partial<Record<DiscoverySurface, DiscoverySurfaceResult>>
): string {
  const lines: string[] = ["Discovery brief (editorial, internal)."];
  for (const result of Object.values(surfaces)) {
    if (!result?.items.length) continue;
    lines.push(`${result.headline}: ${result.editorNote}`);
    for (const item of result.items) {
      lines.push(`  - ${item.item.title} (${item.item.category}) — ${whyLine(item)}`);
    }
  }
  return lines.join("\n");
}
