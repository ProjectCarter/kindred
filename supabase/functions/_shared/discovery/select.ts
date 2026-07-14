import { isPlaceholderCopy } from "../contentQuality.ts";
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

const DEFAULT_MAX = 4;

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
        !isPlaceholderCopy(r.label) &&
        !/magazine desk|tend to care|algorithm|score/i.test(r.label)
    )
    .slice(0, 2)
    .map((r) => r.label);
  if (top.length) return top.join(" ");
  if (item.item.place?.city) {
    return `Nearby in ${item.item.place.city}.`;
  }
  return "From today’s paper.";
}

function isVerifiedPlaceItem(item: RankedDiscoveryItem): boolean {
  const cat = item.item.category;
  if (!PLACE_CATEGORIES.has(cat)) return true;
  // Local events / provider URLs count as verified
  if (item.item.id.startsWith("event_")) return true;
  if (item.item.source?.tier === "local" && item.item.url) return true;
  if (item.item.place?.city && item.item.source?.url) return true;
  // Seed Kindred Desk place templates are not verified recommendations
  if (item.item.source?.name === "Kindred Desk") return false;
  if (isPlaceholderCopy(item.item.title) || isPlaceholderCopy(item.item.dek)) {
    return false;
  }
  return true;
}

/**
 * Assemble one discovery surface — magazine desk curation, not a feed dump.
 * Recently shown picks stay off the desk until fresher options run out.
 */
export function selectDiscoverySurface(
  ranked: RankedDiscoveryItem[],
  surface: DiscoverySurface,
  ctx: DiscoveryRankingContext
): DiscoverySurfaceResult {
  const allowed = new Set(SURFACE_CATEGORIES[surface]);
  const max = ctx.maxPerSurface ?? DEFAULT_MAX;
  const recentKeys = ctx.recentKeys ?? [];
  const selected: RankedDiscoveryItem[] = [];
  const used = new Set<string>();
  const usedCategories = new Set<string>();

  const pool = ranked
    .filter((r) => allowed.has(r.item.category) && isVerifiedPlaceItem(r))
    .sort((a, b) => b.score - a.score);

  // Hidden gems: prefer uniqueness
  const ordered =
    surface === "hidden_gems"
      ? [...pool].sort(
          (a, b) =>
            b.item.uniqueness * 2 +
            b.score / 100 -
            (a.item.uniqueness * 2 + a.score / 100)
        )
      : pool;

  function consider(
    candidate: RankedDiscoveryItem,
    allowRecent: boolean
  ): boolean {
    if (selected.length >= max) return false;
    if (used.has(candidate.item.id)) return false;
    if (!allowRecent && isRecentlyRecommended(candidate.item, recentKeys)) {
      return false;
    }

    // Soft category diversity within a surface (except single-category surfaces)
    if (
      allowed.size > 1 &&
      usedCategories.has(candidate.item.category) &&
      selected.length < max - 1
    ) {
      // Prefer unused categories first; allow repeat later if needed.
      const hasUnused = ordered.some(
        (c) =>
          !used.has(c.item.id) &&
          !usedCategories.has(c.item.category) &&
          (allowRecent || !isRecentlyRecommended(c.item, recentKeys))
      );
      if (hasUnused) return false;
    }

    // Bandit's Picks: never overwhelm — keep calm mix
    if (surface === "bandits_picks" && selected.length >= 3) return false;

    selected.push({
      ...candidate,
      surfaces: [...new Set([...candidate.surfaces, surface])],
    });
    used.add(candidate.item.id);
    usedCategories.add(candidate.item.category);
    return true;
  }

  for (const candidate of ordered) {
    consider(candidate, false);
  }

  // Fill if variety pass left gaps — only then reuse recent recommendations.
  if (selected.length < Math.min(2, max)) {
    for (const candidate of ordered) {
      if (selected.length >= Math.min(3, max)) break;
      consider(candidate, true);
    }
  }

  return {
    surface,
    headline: SURFACE_HEADLINES[surface],
    editorNote: SURFACE_EDITOR_NOTES[surface],
    items: selected.map((s) => ({
      ...s,
      // Attach why for consumers
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
