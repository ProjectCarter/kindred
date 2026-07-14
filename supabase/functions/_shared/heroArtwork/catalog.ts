import type { HeroArtworkRecord } from "./types.ts";

/** Runtime registry — populated after curator verification and asset hosting. */
let runtimeCatalog: HeroArtworkRecord[] = [];

export function getHeroArtworkCatalog(): HeroArtworkRecord[] {
  return runtimeCatalog;
}

export function registerHeroArtwork(records: HeroArtworkRecord[]): void {
  const byId = new Map(runtimeCatalog.map((record) => [record.internalId, record]));
  for (const record of records) {
    byId.set(record.internalId, record);
  }
  runtimeCatalog = Array.from(byId.values());
}

export function resetHeroArtworkCatalog(): void {
  runtimeCatalog = [];
}

export function getHeroArtworkByInternalId(
  internalId: string
): HeroArtworkRecord | null {
  return runtimeCatalog.find((record) => record.internalId === internalId) ?? null;
}
