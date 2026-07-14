import type { HeroArtworkAsset } from "./types.ts";

let runtimeCatalog: HeroArtworkAsset[] = [];

export function getHeroArtworkCatalog(): HeroArtworkAsset[] {
  return runtimeCatalog;
}

export function registerHeroArtworkAssets(assets: HeroArtworkAsset[]): void {
  const byId = new Map(runtimeCatalog.map((asset) => [asset.internalId, asset]));
  for (const asset of assets) {
    byId.set(asset.internalId, asset);
  }
  runtimeCatalog = Array.from(byId.values());
}

export function resetHeroArtworkCatalog(): void {
  runtimeCatalog = [];
}

export function getHeroArtworkAssetById(id: string): HeroArtworkAsset | null {
  return runtimeCatalog.find((asset) => asset.id === id || asset.internalId === id) ?? null;
}
