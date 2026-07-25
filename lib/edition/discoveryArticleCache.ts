import { articleFromDiscoveryItem, type KindredArticle } from "./article";
import { inferActivitySubtype } from "./activitySubtype";
import { resolveDiscoveryCategoryIcon } from "./categoryIcon";
import type { ClippingContentType } from "./clippingTypes";
import type { DiscoveryItem, RankedDiscoveryItem } from "./discovery";
import { resolveVenueClassification } from "./venueClassification";
import { resolveWhyYoullLoveIt } from "./whyYoullLoveIt";

/** City only, for the detail Quick Overview title. Verified place data only. */
function discoveryDisplayCity(item: DiscoveryItem): string | null {
  return item.place?.city?.trim() || null;
}

/**
 * "Why you'll love it" — an editorial recommendation, not a metadata field. It
 * answers "why should I choose THIS over the hundreds of options nearby?" in one
 * or two warm sentences. Sourced from Kindred's genuine editorial voice: a
 * Bandit's Note when present, otherwise a curated line for the VERIFIED editorial
 * category (see whyYoullLoveIt.ts). It never uses provider descriptions,
 * Foursquare categories, or Eventbrite listing text, and is omitted entirely when
 * there is no verified basis to stand behind — never invented or padded.
 */
function discoveryWhyYoullLoveIt(
  article: KindredArticle,
  item: DiscoveryItem
): string | null {
  const classification = resolveVenueClassification({
    title: item.title,
    venueCategories: item.venueCategories,
    discoveryCategory: item.category,
    dek: item.dek,
    address: item.address,
  });
  return resolveWhyYoullLoveIt({
    banditNote: article.banditNote,
    classification,
    seed: article.id || item.id,
  });
}

/**
 * Server-written grounded "About" paragraphs, when present. Split into 1–2
 * paragraphs for the detail About card. Kindred editorial only — never verbatim
 * provider text. When absent, the reader falls back to Kindred's composed body.
 */
function discoveryAboutParagraphs(item: DiscoveryItem): string[] | null {
  const about = item.about?.trim();
  if (!about) return null;
  const paragraphs = about
    .split(/\n{2,}|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.length ? paragraphs.slice(0, 2) : null;
}

/** Attach presentation-only overview fields sourced from verified item data. */
function withOverviewFields(
  article: KindredArticle,
  item: DiscoveryItem
): KindredArticle {
  return {
    ...article,
    savedCity: article.savedCity ?? discoveryDisplayCity(item),
    knownFor: article.knownFor ?? discoveryWhyYoullLoveIt(article, item),
    aboutParagraphs: article.aboutParagraphs ?? discoveryAboutParagraphs(item),
  };
}

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
  const article = withOverviewFields(
    articleFromDiscoveryItem(item, {
      editionDate: options?.editionDate ?? null,
    }),
    item.item
  );
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
    const article = withOverviewFields(
      articleFromDiscoveryItem(item, { editionDate }),
      item.item
    );
    map.set(
      item.item.id,
      savedContentType ? { ...article, savedContentType } : article
    );
  }
  return map;
}
