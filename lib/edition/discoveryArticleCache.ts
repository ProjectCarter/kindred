import { articleFromDiscoveryItem, type KindredArticle } from "./article";
import type { ClippingContentType } from "./clippingTypes";
import type { RankedDiscoveryItem } from "./discovery";

/**
 * Pre-compose discovery articles off the tap path so navigation can begin
 * immediately with the full reader handoff already in memory.
 */
export function discoveryArticlesById(
  items: RankedDiscoveryItem[],
  savedContentType?: ClippingContentType,
  editionDate?: string | null
): Map<string, KindredArticle> {
  const map = new Map<string, KindredArticle>();
  for (const item of items) {
    const article = articleFromDiscoveryItem(item, { editionDate });
    map.set(
      item.item.id,
      savedContentType ? { ...article, savedContentType } : article
    );
  }
  return map;
}
