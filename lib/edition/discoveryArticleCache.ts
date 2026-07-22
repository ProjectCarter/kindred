import { articleFromDiscoveryItem, type KindredArticle } from "./article";
import { inferActivitySubtype } from "./activitySubtype";
import { resolveDiscoveryCategoryIcon } from "./categoryIcon";
import type { ClippingContentType } from "./clippingTypes";
import type { RankedDiscoveryItem } from "./discovery";
import { resolveVenueClassification } from "./venueClassification";

/** Lightweight id index — no article composition. */
export function discoveryItemsById(
  items: readonly RankedDiscoveryItem[]
): Map<string, RankedDiscoveryItem> {
  const map = new Map<string, RankedDiscoveryItem>();
  for (const item of items) {
    map.set(item.item.id, item);
  }
  return map;
}

export function discoveryRankedItemCategoryIcon(
  ranked: RankedDiscoveryItem,
  surface: "activity" | "recommendation"
): string {
  const item = ranked.item;
  const venue = resolveVenueClassification({
    title: item.title,
    venueCategories: item.venueCategories,
    discoveryCategory: item.category,
    dek: item.dek,
    address: item.address,
  });
  return resolveDiscoveryCategoryIcon(
    {
      title: item.title,
      dek: item.dek,
      category: item.category,
      venueCategories: item.venueCategories,
      tags: item.tags,
      editorialCategoryId:
        venue.confidence !== "low" ? venue.categoryId : null,
      activitySubtype:
        item.category === "activities" ? inferActivitySubtype(item) : null,
    },
    surface
  );
}

/**
 * Compose one discovery article when the reader opens it — never during homepage mount.
 * Homepage cards stay lightweight; full editorial composition happens on tap.
 */
export function composeDiscoveryArticleOnTap(
  item: RankedDiscoveryItem,
  options?: {
    savedContentType?: ClippingContentType;
    editionDate?: string | null;
  }
): KindredArticle {
  const article = articleFromDiscoveryItem(item, {
    editionDate: options?.editionDate ?? null,
  });
  return options?.savedContentType != null
    ? { ...article, savedContentType: options.savedContentType }
    : article;
}

/**
 * Bulk pre-compose for See All screens only — not the homepage first-paint path.
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
