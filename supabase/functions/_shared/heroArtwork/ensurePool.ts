import type { HeroArtworkRecord, HeroArtworkSelectionContext } from "./types.ts";
import { selectDailyHeroArtwork } from "./select.ts";

export { listRecentHeroArtworkRotation } from "./backgroundDiscovery.ts";

export async function selectDailyHeroFromPool(
  catalog: HeroArtworkRecord[],
  editionDate: string,
  context: HeroArtworkSelectionContext
): Promise<HeroArtworkRecord | null> {
  return selectDailyHeroArtwork(catalog, { ...context, date: editionDate });
}
