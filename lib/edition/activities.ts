/**
 * Activities — Kindred's "what should I go do?" desk.
 * Real, bookable venues for active participation (kayaking, escape rooms,
 * bowling, mini golf, rock climbing, axe throwing, go-karts, pickleball,
 * hiking) — never a category guess, always a verified place. Presentation
 * mirrors Local Events on purpose: same grid, same rhythm, its own voice.
 */

import type { RankedDiscoveryItem } from "./discovery";
import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import { resolveVenueClassification } from "./venueClassification";
import {
  isWithinActivitiesSectionRadius,
  type ReaderLocation,
} from "./localDiscoveryScope";
import { isActivityProShopParts } from "./venueQuality";
import { isFoodEstablishmentItem } from "./foodDrinkDesk";
import { isDiscoveryQualityExcluded } from "./discoveryQualityFilter";
import { resolveDiscoveryCategoryIcon } from "./categoryIcon";
import { inferActivitySubtype, type ActivitySubtype } from "./activitySubtype";

export { inferActivitySubtype, type ActivitySubtype } from "./activitySubtype";

function isCompleteCard(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(item.title?.trim());
}

/** Real per-city venue kind, inferred from Foursquare's own category text
 *  (never invented) — the underlying DiscoveryCategory is one flat
 *  "activities" bucket, so this recovers "which of the eight" for the
 *  overline label and the matching bundled photograph. */
const SUBTYPE_LABEL: Record<ActivitySubtype, string> = {
  water_recreation: "Kayaking & Paddleboarding",
  escape_rooms: "Escape Room",
  bowling: "Bowling",
  mini_golf: "Mini Golf",
  rock_climbing: "Rock Climbing",
  axe_throwing: "Axe Throwing",
  go_karts: "Go-Karts",
  pickleball: "Pickleball",
  arcades: "Arcade",
  laser_tag: "Laser Tag",
  paintball: "Paintball",
  billiards: "Billiards",
  roller_skating: "Roller Skating",
  ice_skating: "Ice Skating",
  karaoke: "Karaoke",
  batting_cages: "Batting Cages",
  hiking: "Hiking",
  general: "Activity",
};

function inferSubtype(item: RankedDiscoveryItem["item"]): ActivitySubtype {
  return inferActivitySubtype(item);
}

export function activityOverline(item: RankedDiscoveryItem["item"]): string {
  const destinationLabel: Record<string, string> = {
    museums: "Museum",
    parks: "Park",
    beaches: "Beach",
    gardens: "Garden",
    scenic_drives: "Scenic Drive",
    hiking: "Hiking",
  };
  if (destinationLabel[item.category]) return destinationLabel[item.category];

  const venue = resolveVenueClassification({
    title: item.title,
    venueCategories: item.venueCategories,
    discoveryCategory: item.category,
    dek: item.dek,
  });
  if (venue.confidence !== "low") {
    return venue.displayLabel.charAt(0).toUpperCase() + venue.displayLabel.slice(1);
  }
  const specific = item.venueCategories?.find((c) => c && c.trim())?.trim();
  if (specific) return specific;
  return SUBTYPE_LABEL[inferSubtype(item)];
}

export function activityLocationLine(
  item: RankedDiscoveryItem["item"],
  fallbackCity?: string | null
): string | null {
  if (item.address?.trim()) return item.address.trim();
  const city = item.place?.city?.trim() || fallbackCity?.trim();
  return city || null;
}

/** Real venues already carry Kindred's own AI-written note (places/notes.ts) — use it as-is. */
export function activityNote(item: RankedDiscoveryItem["item"]): string | null {
  const dek = item.dek?.trim();
  if (!dek) return null;
  if (dek === item.title.trim()) return null;
  return dek;
}

export function selectActivityCards(
  items: RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null; readerLocation?: ReaderLocation | null }
): EditorialGridCard[] {
  const readerLocation = options?.readerLocation ?? null;
  const ranked = [...(items ?? [])]
    .filter((d) => !isFoodEstablishmentItem(d))
    .filter((d) => isCompleteCard(d.item))
    .filter(
      (d) =>
        !isActivityProShopParts([
          d.item.title,
          d.item.dek,
          ...(d.item.venueCategories ?? []),
        ])
    )
    // Cached-edition safety net (Discovery Quality Filter, V3): keep restricted
    // and service/professional businesses out of Activities even before the
    // edition is regenerated.
    .filter(
      (d) =>
        !isDiscoveryQualityExcluded({
          name: d.item.title,
          venueCategories: d.item.venueCategories,
          category: d.item.category,
          dek: d.item.dek,
        })
    )
    .filter((d) => isWithinActivitiesSectionRadius(d, readerLocation));

  return ranked.map((d) => {
    const venue = resolveVenueClassification({
      title: d.item.title,
      venueCategories: d.item.venueCategories,
      discoveryCategory: d.item.category,
      dek: d.item.dek,
    });
    return {
      id: d.item.id,
      overline: activityOverline(d.item),
      categoryIcon: resolveDiscoveryCategoryIcon(
        {
          title: d.item.title,
          dek: d.item.dek,
          category: d.item.category,
          venueCategories: d.item.venueCategories,
          tags: d.item.tags,
          editorialCategoryId:
            venue.confidence !== "low" ? venue.categoryId : null,
          activitySubtype: inferSubtype(d.item),
        },
        "activity"
      ),
      title: d.item.title.trim(),
      subtitle: activityLocationLine(d.item, options?.city),
      note: activityNote(d.item),
    };
  });
}
