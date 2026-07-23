/**
 * Local Events display photography — authorized listing art first,
 * verified category fallback when no trustworthy listing image exists.
 * Never AI-generated; never unlicensed provider thumbnails.
 */

import type { ImageSourcePropType } from "react-native";
import { authorizedEventImageUrl } from "./eventImageRights.ts";

export type EventImageCategory =
  | "music"
  | "comedy"
  | "arts"
  | "family"
  | "sports"
  | "food"
  | "market"
  | "nightlife"
  | "community";

export type EventDisplayImageInput = {
  imageUrl?: string | null;
  imageRights?: import("./eventImageRights.ts").EventImageRights | null;
  category?: EventImageCategory | null;
};

const EVENT_CATEGORY_FALLBACK: Record<EventImageCategory, ImageSourcePropType> = {
  music: categoryAsset("music"),
  comedy: categoryAsset("comedy"),
  arts: categoryAsset("arts"),
  family: categoryAsset("family"),
  sports: categoryAsset("sports"),
  food: categoryAsset("food"),
  market: categoryAsset("market"),
  nightlife: categoryAsset("nightlife"),
  community: categoryAsset("community"),
};

function categoryAsset(category: EventImageCategory): ImageSourcePropType {
  if (process.env.KINDRED_SKIP_BUNDLED_ASSETS === "1") {
    return { uri: `kindred://event-category/${category}` };
  }
  switch (category) {
    case "music":
      return require("../../assets/discovery/event-music.jpg");
    case "comedy":
      return require("../../assets/discovery/event-comedy.jpg");
    case "arts":
      return require("../../assets/discovery/event-arts.jpg");
    case "family":
      return require("../../assets/discovery/event-family.jpg");
    case "sports":
      return require("../../assets/discovery/event-sports.jpg");
    case "food":
      return require("../../assets/discovery/event-food.jpg");
    case "market":
      return require("../../assets/discovery/event-market.jpg");
    case "nightlife":
      return require("../../assets/discovery/event-nightlife.jpg");
    default:
      return require("../../assets/discovery/event-community.jpg");
  }
}

export type EventDisplayImageKind = "listing" | "category";

export type ResolvedEventDisplayImage = {
  kind: EventDisplayImageKind;
  source: ImageSourcePropType;
};

/** Verified bundled category art — honest fallback, not listing photography. */
export function eventCategoryFallbackImage(
  category?: EventImageCategory | null
): ImageSourcePropType {
  if (category && EVENT_CATEGORY_FALLBACK[category]) {
    return EVENT_CATEGORY_FALLBACK[category];
  }
  return EVENT_CATEGORY_FALLBACK.community;
}

export function eventFallbackImage(
  category?: EventImageCategory | null,
  id?: string | null
): ImageSourcePropType | null {
  void id;
  return eventCategoryFallbackImage(category);
}

/**
 * Resolve the image every Local Events card should render.
 * Listing photo only when source rights explicitly authorize display.
 */
export function resolveEventDisplayImage(
  event: EventDisplayImageInput
): ResolvedEventDisplayImage {
  const listingUrl = authorizedEventImageUrl(event);
  if (listingUrl) {
    return { kind: "listing", source: { uri: listingUrl } };
  }
  return {
    kind: "category",
    source: eventCategoryFallbackImage(event.category),
  };
}

export function eventDisplayImageSource(
  event: EventDisplayImageInput
): ImageSourcePropType {
  return resolveEventDisplayImage(event).source;
}

export function eventDisplayImageKind(
  event: EventDisplayImageInput
): EventDisplayImageKind {
  return resolveEventDisplayImage(event).kind;
}

export function eventHasDisplayImage(event: EventDisplayImageInput): boolean {
  return Boolean(eventDisplayImageSource(event));
}
