/**
 * Client mirror — Discovery Engine contracts.
 * Generation runs at edition build; the app reads stored payloads.
 * Every future recommendation surface should use this same engine.
 */

import { isInternalScoreLabel } from "./contentQuality";
import { containsEngineLanguage } from "./editorialVoice";

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
  | "recipes"
  | "activities"
  | "bakeries"
  | "gardens";

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
  | "travel"
  | "activities"
  | "bakeries"
  | "gardens";

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
  /** Organizer or venue official site — never a listing aggregator. */
  officialWebsite?: string | null;
  /** Verified street address (local places only) — never fabricated. */
  address?: string | null;
  /** Provider-supplied phone when available — never fabricated. */
  phone?: string | null;
  /** Provider-supplied menu URL when available — never fabricated. */
  menuUrl?: string | null;
  /** Verified coordinates when the provider supplies them — never fabricated. */
  lat?: number | null;
  lon?: number | null;
  /** Provider-supplied category names (e.g. Foursquare "Coffee Shop") — editorial context only. */
  venueCategories?: string[];
  tags: string[];
  /** Server-enriched Kindred library / stock photo (never searched client-side). */
  editorialImage?: {
    url: string;
    libraryId: string;
    source: "pexels" | "pixabay" | "unsplash" | "wikimedia" | "provider" | "kindred";
    orientation?: "portrait" | "landscape" | "square";
    photographerName?: string | null;
    sourcePageUrl?: string | null;
    attributionText?: string | null;
  } | null;
  knowledgeGrounding?: import("./knowledgeGrounding").KnowledgeLookupResult | null;
  /** Internal editorial confidence — never shown to readers. */
  editorialConfidence?: import("./editorialConfidence").EditorialConfidence | null;
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
    lat?: number | null;
    lon?: number | null;
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
    enrichQueue?: DiscoveryItem[];
    confidencePrunedAt?: string | null;
  };
};

export function parseDiscoveryPayload(value: unknown): DiscoveryPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DiscoveryPayload>;
  // Surfaces drive Activities / Recommendations. `picks` is a flat index —
  // tolerate a missing array so a partial row still paints discovery desks.
  if (raw.version !== 1 || !raw.surfaces || typeof raw.surfaces !== "object") {
    return null;
  }
  return {
    ...(raw as DiscoveryPayload),
    picks: Array.isArray(raw.picks) ? raw.picks : [],
  };
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
const GENERIC_REASON_CODES = new Set([
  "editorial_quality",
  "trusted_source",
  "reader_interest",
  "followed_topic",
  "favorite_source",
]);

/**
 * Never surface scoring rationale to readers — the dek and article carry
 * the editorial voice. Return empty when only engine reasons exist.
 */
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
        !isInternalScoreLabel(r.label) &&
        !containsEngineLanguage(r.label)
    )
    .slice(0, 2)
    .map((r) => r.label);
  if (top.length) return top.join(" · ");
  return "";
}

export const DiscoveryService = {
  parseDiscoveryPayload,
  discoveryItemsForSurface,
  formatDiscoveryWhy,
};

export default DiscoveryService;
