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
  return items.filter(
    (ranked) =>
      ranked &&
      ranked.item &&
      typeof ranked.item.title === "string" &&
      ranked.item.title.trim().length > 0
  );
}

/** Calm prose — never mentions scores or algorithms. */
export function formatDiscoveryWhy(item: RankedDiscoveryItem): string {
  const top = (item.reasons ?? [])
    .filter((r) => r && r.weight > 0 && !String(r.code).startsWith("surface_"))
    .slice(0, 2)
    .map((r) => r.label)
    .filter((label) => typeof label === "string" && label.trim());
  return top.join(" ") || "Hand-selected for today’s paper.";
}

export const DiscoveryService = {
  parseDiscoveryPayload,
  discoveryItemsForSurface,
  formatDiscoveryWhy,
};

export default DiscoveryService;
