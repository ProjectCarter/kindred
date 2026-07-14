/**
 * Client-side image resolution — reads server-enriched library URLs from
 * discovery JSON. Never calls Pexels/Pixabay. Falls back to accurate bundled
 * placeholders only when confidence is high; otherwise returns null for the
 * elegant no-image card.
 */

import type { ImageSourcePropType } from "react-native";
import type { DiscoveryItem } from "./discovery";
import { classifyImageSubject } from "./imageTaxonomy";
import { categoryImageIsConfident } from "./imageConfidence";
import { claimImage, claimRemoteImage, NEUTRAL_PLACEHOLDERS } from "./imageRegistry";

export type ResolvedItemImage = ImageSourcePropType | null;

export type ResolveItemImageInput = {
  id: string;
  item: Pick<
    DiscoveryItem,
    "title" | "dek" | "category" | "venueCategories" | "address" | "editorialImage"
  >;
  bundledPool?: ImageSourcePropType[];
  /** When true, prefer landscape selection semantics (Bandit's Pick). */
  preferLandscape?: boolean;
};

/**
 * Priority:
 * 1. editorialImage.url from server enrichment (library / stock)
 * 2. Confident bundled category placeholder (deduped)
 * 3. null — no-image newspaper card
 */
export function resolveDiscoveryItemImage(
  input: ResolveItemImageInput
): ResolvedItemImage {
  const library = input.item.editorialImage;
  if (library?.url?.trim()) {
    const remote = claimRemoteImage(input.id, library.url.trim(), library.libraryId);
    if (remote) return remote;
  }

  const classification = classifyImageSubject({
    title: input.item.title,
    dek: input.item.dek,
    venueCategories: input.item.venueCategories,
    discoveryCategory: input.item.category,
    address: input.item.address,
  });

  if (classification.confidence === "low") {
    return null;
  }

  const confident = categoryImageIsConfident(input.item.category, input.item);
  if (!confident) {
    return null;
  }

  const pool = input.bundledPool?.length ? input.bundledPool : NEUTRAL_PLACEHOLDERS;
  const bundled = claimImage(input.id, pool, NEUTRAL_PLACEHOLDERS, false);
  return bundled;
}
