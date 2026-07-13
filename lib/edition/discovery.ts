/**
 * Client mirror — Discovery Engine contracts.
 * Generation runs at edition build; the app reads stored payloads.
 * Every future recommendation surface should use this same engine.
 */

export type DiscoverySurface =
  | "bandits_picks"
  | "weekend_ideas"
  | "hidden_gems"
  | "coffee"
  | "restaurants"
  | "beaches"
  | "hiking"
  | "museums"
  | "parks"
  | "scenic_drives"
  | "books"
  | "movies"
  | "podcasts"
  | "recipes";

export type DiscoveryCategory =
  | "coffee"
  | "restaurants"
  | "recipes"
  | "beaches"
  | "hiking"
  | "parks"
  | "scenic_drives"
  | "museums"
  | "books"
  | "movies"
  | "podcasts"
  | "experiences"
  | "travel";

export type DiscoveryReason = {
  code: string;
  label: string;
  weight: number;
};

export type DiscoveryItem = {
  id: string;
  title: string;
  dek: string;
  category: DiscoveryCategory;
  family: string;
  place?: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  } | null;
  source: {
    name: string;
    tier: string;
    url?: string | null;
  };
  url?: string | null;
  tags: string[];
};

export type RankedDiscoveryItem = {
  item: DiscoveryItem;
  score: number;
  reasons: DiscoveryReason[];
  surfaces: DiscoverySurface[];
};

export type DiscoverySurfaceResult = {
  surface: DiscoverySurface;
  headline: string;
  editorNote: string;
  items: RankedDiscoveryItem[];
};

export type DiscoveryPayload = {
  version: 1;
  generatedAt: string;
  editionDate: string;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
  };
  surfaces: Partial<Record<DiscoverySurface, DiscoverySurfaceResult>>;
  picks: Array<{
    id: string;
    title: string;
    category: DiscoveryCategory;
    surface: DiscoverySurface;
    why: string;
  }>;
  editorBrief: string;
  selectionMeta: {
    candidateCount: number;
    selectedCount: number;
    editorNotes: string[];
  };
};

export function parseDiscoveryPayload(value: unknown): DiscoveryPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DiscoveryPayload>;
  if (raw.version !== 1 || !raw.surfaces || !Array.isArray(raw.picks)) {
    return null;
  }
  return raw as DiscoveryPayload;
}

export function discoveryItemsForSurface(
  payload: DiscoveryPayload | null | undefined,
  surface: DiscoverySurface
): RankedDiscoveryItem[] {
  const items = payload?.surfaces?.[surface]?.items ?? [];
  return items.filter((ranked) => {
    if (!ranked?.item || typeof ranked.item.title !== "string") return false;
    const title = ranked.item.title.trim();
    if (!title) return false;
    if (
      /third-wave|editorial quality|magazine desk|hand-selected for today/i.test(
        `${title} ${ranked.item.dek ?? ""}`
      )
    ) {
      return false;
    }
    // Unverified Kindred Desk place templates
    if (
      ranked.item.source?.name === "Kindred Desk" &&
      /coffee|restaurants|hiking|beaches|parks|museums|experiences/.test(
        ranked.item.category
      )
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Calm prose — never mentions scores or algorithms.
 * Excludes the generic per-item "editorial_quality" reason by code (not by
 * label text): it's present on every item with the same label, so — while
 * it should always factor into ranking — showing it as a "why" would make
 * nearly every card's caption open with the same line.
 */
const GENERIC_REASON_CODES = new Set(["editorial_quality"]);

export function formatDiscoveryWhy(item: RankedDiscoveryItem): string {
  const top = (item.reasons ?? [])
    .filter(
      (r) =>
        r &&
        r.weight > 0 &&
        !String(r.code).startsWith("surface_") &&
        !GENERIC_REASON_CODES.has(String(r.code)) &&
        typeof r.label === "string" &&
        r.label.trim() &&
        !/editorial quality|magazine desk|matches what you tend|hand-selected|algorithm|score/i.test(
          r.label
        )
    )
    .slice(0, 2)
    .map((r) => r.label);
  if (top.length) return top.join(" · ");
  if (item.item.place?.city) return `Nearby in ${item.item.place.city}.`;
  return "";
}

export const DiscoveryService = {
  parseDiscoveryPayload,
  discoveryItemsForSurface,
  formatDiscoveryWhy,
};

export default DiscoveryService;
