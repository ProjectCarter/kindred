import type { ImageOrientation, StockSearchCandidate } from "./types.ts";
import { searchPexels } from "./pexels.ts";
import { searchPixabay } from "./pixabay.ts";

/**
 * Provider-agnostic search interface. Pexels and Pixabay are active today;
 * museum and archive sources (Wikimedia, Rijksmuseum, Met, Smithsonian, LoC,
 * National Gallery, Art Institute of Chicago) plug in here later without
 * redesigning select/ingest/library.
 */
export type ImageSearchProviderId =
  | "pexels"
  | "pixabay"
  | "wikimedia"
  | "rijksmuseum"
  | "met"
  | "smithsonian"
  | "loc"
  | "national_gallery"
  | "art_institute_chicago"
  | "provider";

export type ImageSearchOptions = {
  orientation?: ImageOrientation;
  perPage?: number;
};

export interface ImageSearchProvider {
  readonly id: ImageSearchProviderId;
  readonly enabled: boolean;
  search(query: string, options?: ImageSearchOptions): Promise<StockSearchCandidate[]>;
}

function wrapStockAdapter(
  id: "pexels" | "pixabay",
  searchFn: typeof searchPexels
): ImageSearchProvider {
  return {
    id,
    enabled: true,
    search: (query, options) => searchFn(query, options),
  };
}

/** Active royalty-free stock providers — called only at edition build time. */
export const ACTIVE_STOCK_PROVIDERS: ImageSearchProvider[] = [
  wrapStockAdapter("pexels", searchPexels),
  wrapStockAdapter("pixabay", searchPixabay),
];

/**
 * Future museum/archive providers register here when implemented.
 * Example: registerProvider({ id: "wikimedia", enabled: hasApiKey(), search: searchWikimedia })
 */
const FUTURE_PROVIDER_REGISTRY = new Map<ImageSearchProviderId, ImageSearchProvider>();

export function registerImageSearchProvider(provider: ImageSearchProvider): void {
  FUTURE_PROVIDER_REGISTRY.set(provider.id, provider);
}

/** Returns enabled providers in priority order for editorial discovery images. */
export function getEditorialSearchProviders(): ImageSearchProvider[] {
  const future = [...FUTURE_PROVIDER_REGISTRY.values()].filter((p) => p.enabled);
  return [...ACTIVE_STOCK_PROVIDERS.filter((p) => p.enabled), ...future];
}
