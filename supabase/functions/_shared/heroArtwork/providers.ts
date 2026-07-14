import type { HeroArtworkRecord, HeroArtworkSourceProvider } from "./types.ts";

/**
 * Provider adapter for museum/archive open-access collections.
 * Each provider normalizes remote metadata into HeroArtworkRecord drafts
 * for curator review — nothing enters the live library without verification.
 */
export type HeroArtworkProviderDraft = Omit<
  HeroArtworkRecord,
  "id" | "lastUsedAt" | "useCount" | "approvalStatus" | "publicDomainStatus"
> & {
  publicDomainStatus?: HeroArtworkRecord["publicDomainStatus"];
  approvalStatus?: HeroArtworkRecord["approvalStatus"];
};

export interface HeroArtworkSourceAdapter {
  readonly id: HeroArtworkSourceProvider;
  readonly enabled: boolean;
  /** Fetch metadata for a known provider artwork id — no binary download in v1 foundation. */
  fetchArtworkMetadata(
    providerArtworkId: string
  ): Promise<HeroArtworkProviderDraft | null>;
  /** Search or browse candidates for future bulk ingestion pipelines. */
  searchOpenAccess?(query: string, limit?: number): Promise<HeroArtworkProviderDraft[]>;
}

const PROVIDER_REGISTRY = new Map<
  HeroArtworkSourceProvider,
  HeroArtworkSourceAdapter
>();

export function registerHeroArtworkProvider(
  adapter: HeroArtworkSourceAdapter
): void {
  PROVIDER_REGISTRY.set(adapter.id, adapter);
}

export function getHeroArtworkProvider(
  id: HeroArtworkSourceProvider
): HeroArtworkSourceAdapter | null {
  return PROVIDER_REGISTRY.get(id) ?? null;
}

export function listHeroArtworkProviders(): HeroArtworkSourceAdapter[] {
  return [...PROVIDER_REGISTRY.values()].filter((adapter) => adapter.enabled);
}

/**
 * Stub adapters — wired when each museum API is implemented.
 * Architecture stays stable; providers register themselves at deploy time.
 */
export function registerPlannedHeroArtworkProviders(): void {
  const planned: HeroArtworkSourceProvider[] = [
    "met",
    "national_gallery_art",
    "rijksmuseum",
    "smithsonian",
    "loc",
    "wikimedia",
    "nasa",
    "national_archives",
    "art_institute_chicago",
  ];

  for (const id of planned) {
    if (PROVIDER_REGISTRY.has(id)) continue;
    registerHeroArtworkProvider({
      id,
      enabled: false,
      async fetchArtworkMetadata() {
        return null;
      },
    });
  }
}
