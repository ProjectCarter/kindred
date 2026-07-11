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

function whyLine(item: RankedDiscoveryItem): string {
  const top = item.reasons
    .filter((r) => r.weight > 0)
    .slice(0, 2)
    .map((r) => r.label);
  return top.join(" ") || "Hand-selected for today’s paper.";
}

/**
 * Assemble one discovery surface — magazine desk curation, not a feed dump.
 */
export function selectDiscoverySurface(
  ranked: RankedDiscoveryItem[],
  surface: DiscoverySurface,
  ctx: DiscoveryRankingContext
): DiscoverySurfaceResult {
  const allowed = new Set(SURFACE_CATEGORIES[surface]);
  const max = ctx.maxPerSurface ?? DEFAULT_MAX;
  const selected: RankedDiscoveryItem[] = [];
  const used = new Set<string>();
  const usedCategories = new Set<string>();

  const pool = ranked
    .filter((r) => allowed.has(r.item.category))
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

  for (const candidate of ordered) {
    if (selected.length >= max) break;
    if (used.has(candidate.item.id)) continue;

    // Soft category diversity within a surface (except single-category surfaces)
    if (
      allowed.size > 1 &&
      usedCategories.has(candidate.item.category) &&
      selected.length < max - 1
    ) {
      // Prefer unused categories first; allow repeat later if needed.
      const hasUnused = ordered.some(
        (c) =>
          !used.has(c.item.id) && !usedCategories.has(c.item.category)
      );
      if (hasUnused) continue;
    }

    // Bandit's Picks: never overwhelm — keep calm mix
    if (surface === "bandits_picks" && selected.length >= 3) break;

    selected.push({
      ...candidate,
      surfaces: [...new Set([...candidate.surfaces, surface])],
    });
    used.add(candidate.item.id);
    usedCategories.add(candidate.item.category);
  }

  // Fill if diversity pass left gaps
  if (selected.length < Math.min(2, max)) {
    for (const candidate of ordered) {
      if (selected.length >= Math.min(3, max)) break;
      if (used.has(candidate.item.id)) continue;
      selected.push({
        ...candidate,
        surfaces: [...new Set([...candidate.surfaces, surface])],
      });
      used.add(candidate.item.id);
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

export { whyLine };
