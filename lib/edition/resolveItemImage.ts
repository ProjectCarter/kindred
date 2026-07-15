/**
 * Client-side discovery image resolution — disabled for V1.
 * Activities and Recommendations are typography-first newspaper listings;
 * no listing photography is resolved on the client.
 */

import type { ImageSourcePropType } from "react-native";
import type { DiscoveryItem } from "./discovery";

export type ResolvedItemImage = ImageSourcePropType | null;

export type ResolveItemImageInput = {
  id: string;
  item: Pick<
    DiscoveryItem,
    "title" | "dek" | "category" | "venueCategories" | "address" | "editorialImage"
  >;
  bundledPool?: ImageSourcePropType[];
  preferLandscape?: boolean;
};

export function resolveDiscoveryItemImage(
  _input: ResolveItemImageInput
): ResolvedItemImage {
  return null;
}
