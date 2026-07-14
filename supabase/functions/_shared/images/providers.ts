import type { ImageOrientation, StockSearchCandidate } from "./types.ts";
import { searchUnsplash } from "./unsplash.ts";
import { searchPexels } from "./pexels.ts";
import { searchPixabay } from "./pixabay.ts";
import { searchWikimediaCommons } from "./wikimedia.ts";

/**
 * Provider-agnostic search interface. Unsplash, Pixabay, and Pexels are active;
 * museum and archive sources plug in here later without redesigning select/ingest/library.
 */
export type ImageSearchProviderId =
  | "unsplash"
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
  id: "unsplash" | "pexels" | "pixabay",
  searchFn: (
    query: string,
    options?: ImageSearchOptions
  ) => Promise<StockSearchCandidate[]>
): ImageSearchProvider {
  return {
    id,
    enabled: true,
    search: (query, options) => searchFn(query, options),
  };
}

/** Active royalty-free stock providers — priority: Unsplash → Pixabay → Pexels. */
export const ACTIVE_STOCK_PROVIDERS: ImageSearchProvider[] = [
  wrapStockAdapter("unsplash", searchUnsplash),
  wrapStockAdapter("pixabay", searchPixabay),
  wrapStockAdapter("pexels", searchPexels),
];

const FUTURE_PROVIDER_REGISTRY = new Map<ImageSearchProviderId, ImageSearchProvider>();

/** Off by default — enable with WIKIMEDIA_COMMONS_ENABLED=true in Edge Function secrets. */
registerImageSearchProvider({
  id: "wikimedia",
  enabled: false,
  search: searchWikimediaCommons,
});

function wikimediaEnabledInRuntime(): boolean {
  try {
    return Deno.env.get("WIKIMEDIA_COMMONS_ENABLED") === "true";
  } catch {
    return false;
  }
}

export function registerImageSearchProvider(provider: ImageSearchProvider): void {
  FUTURE_PROVIDER_REGISTRY.set(provider.id, provider);
}

export function getEditorialSearchProviders(): ImageSearchProvider[] {
  const future = [...FUTURE_PROVIDER_REGISTRY.values()].filter((p) => {
    if (p.id === "wikimedia") return wikimediaEnabledInRuntime();
    return p.enabled;
  });
  return [...ACTIVE_STOCK_PROVIDERS.filter((p) => p.enabled), ...future];
}
