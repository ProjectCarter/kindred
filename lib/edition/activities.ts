/**
 * Activities — Kindred's "what should I go do?" desk.
 * Real, bookable venues for active participation (kayaking, escape rooms,
 * bowling, mini golf, rock climbing, axe throwing, go-karts, pickleball,
 * hiking) — never a category guess, always a verified place. Presentation
 * mirrors Local Events on purpose: same grid, same rhythm, its own voice.
 */

import type { ImageSourcePropType } from "react-native";
import type { RankedDiscoveryItem } from "./discovery";
import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import { resolveDiscoveryItemImage } from "./resolveItemImage";
import { resolveVenueClassification } from "./venueClassification";
import { resolveActionsForActivity } from "./actionBar";
import type { ImageCategoryTag } from "./imageTaxonomy";
import { NEUTRAL_PLACEHOLDERS } from "./imageRegistry";

function isCompleteCard(item: RankedDiscoveryItem["item"]): boolean {
  return Boolean(item.title?.trim());
}

/** Real per-city venue kind, inferred from Foursquare's own category text
 *  (never invented) — the underlying DiscoveryCategory is one flat
 *  "activities" bucket, so this recovers "which of the eight" for the
 *  overline label and the matching bundled photograph. */
type ActivitySubtype =
  | "water_recreation"
  | "escape_rooms"
  | "bowling"
  | "mini_golf"
  | "rock_climbing"
  | "axe_throwing"
  | "go_karts"
  | "pickleball"
  | "arcades"
  | "laser_tag"
  | "paintball"
  | "billiards"
  | "roller_skating"
  | "ice_skating"
  | "karaoke"
  | "batting_cages"
  | "hiking"
  /**
   * Real venue, but its own text didn't confidently match any specific
   * subtype above — a tasteful, neutral photo beats guessing wrong (e.g.
   * defaulting to a kayaking/beach photo for a venue that isn't on the
   * water at all).
   */
  | "general";

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

const SUBTYPE_PHOTOS: Record<ActivitySubtype, ImageSourcePropType[]> = {
  water_recreation: [require("../../assets/discovery/activity-water-recreation.jpg")],
  escape_rooms: [require("../../assets/discovery/activity-escape-room.jpg")],
  bowling: [require("../../assets/discovery/activity-bowling.jpg")],
  mini_golf: [require("../../assets/discovery/activity-mini-golf.jpg")],
  rock_climbing: [require("../../assets/discovery/activity-rock-climbing.jpg")],
  axe_throwing: [require("../../assets/discovery/activity-axe-throwing.jpg")],
  go_karts: [require("../../assets/discovery/activity-go-karts.jpg")],
  pickleball: [require("../../assets/discovery/activity-pickleball.jpg")],
  arcades: [require("../../assets/discovery/activity-arcade.jpg")],
  laser_tag: [require("../../assets/discovery/activity-laser-tag.jpg")],
  paintball: [require("../../assets/discovery/activity-paintball.jpg")],
  billiards: [require("../../assets/discovery/activity-billiards.jpg")],
  roller_skating: [require("../../assets/discovery/activity-roller-skating.jpg")],
  ice_skating: [require("../../assets/discovery/activity-ice-skating.jpg")],
  karaoke: [require("../../assets/discovery/activity-karaoke.jpg")],
  batting_cages: [require("../../assets/discovery/activity-batting-cages.jpg")],
  hiking: [
    require("../../assets/heroes/hero-mountain-morning.jpg"),
    require("../../assets/heroes/hero-autumn-leaves.jpg"),
  ],
  general: NEUTRAL_PLACEHOLDERS,
};

/** Ordered so a more specific phrase (e.g. "mini golf") wins over a looser one. */
const SUBTYPE_MATCHERS: Array<{ subtype: ActivitySubtype; pattern: RegExp }> = [
  { subtype: "mini_golf", pattern: /mini.?golf|miniature golf|putt.?putt/i },
  { subtype: "water_recreation", pattern: /kayak|paddleboard|paddle board|surf/i },
  { subtype: "escape_rooms", pattern: /escape room/i },
  { subtype: "roller_skating", pattern: /roller.?(skat|rink)/i },
  { subtype: "ice_skating", pattern: /ice.?(skat|rink)/i },
  { subtype: "bowling", pattern: /bowl/i },
  { subtype: "rock_climbing", pattern: /climbing/i },
  { subtype: "axe_throwing", pattern: /axe/i },
  { subtype: "go_karts", pattern: /go.?kart|karting/i },
  { subtype: "pickleball", pattern: /pickleball/i },
  { subtype: "laser_tag", pattern: /laser tag/i },
  { subtype: "paintball", pattern: /paintball/i },
  { subtype: "billiards", pattern: /billiards|pool hall/i },
  { subtype: "karaoke", pattern: /karaoke/i },
  { subtype: "batting_cages", pattern: /batting cage/i },
  { subtype: "arcades", pattern: /arcade/i },
];

function inferSubtype(item: RankedDiscoveryItem["item"]): ActivitySubtype {
  if (item.category === "hiking") return "hiking";

  const venue = resolveVenueClassification({
    title: item.title,
    venueCategories: item.venueCategories,
    discoveryCategory: item.category,
    dek: item.dek,
    address: item.address,
  });

  const fromVenue: Partial<Record<ImageCategoryTag, ActivitySubtype>> = {
    kayaking: "water_recreation",
    paddleboarding: "water_recreation",
    escape_room: "escape_rooms",
    bowling: "bowling",
    mini_golf: "mini_golf",
    rock_climbing: "rock_climbing",
    axe_throwing: "axe_throwing",
    go_karts: "go_karts",
    arcade: "arcades",
    hiking: "hiking",
  };

  if (venue.confidence !== "low") {
    const mapped = fromVenue[venue.editorialType];
    if (mapped) return mapped;
  }

  const hay = [item.title, item.dek, ...(item.venueCategories ?? [])]
    .filter(Boolean)
    .join(" ");
  for (const { subtype, pattern } of SUBTYPE_MATCHERS) {
    if (pattern.test(hay)) return subtype;
  }
  return "general";
}

export function activityOverline(item: RankedDiscoveryItem["item"]): string {
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

export function activityImageFor(
  item: RankedDiscoveryItem["item"]
): ImageSourcePropType | null {
  const subtype = inferSubtype(item);
  const pool = SUBTYPE_PHOTOS[subtype];
  return resolveDiscoveryItemImage({
    id: item.id,
    item,
    bundledPool: pool,
  });
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

function activitySortScore(d: RankedDiscoveryItem): number {
  let s = d.score ?? 0;
  if (d.item.category === "hiking") s += 2;
  return s;
}

export function selectActivityCards(
  items: RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null }
): EditorialGridCard[] {
  const ranked = [...(items ?? [])]
    .filter((d) => isCompleteCard(d.item))
    .sort((a, b) => activitySortScore(b) - activitySortScore(a));

  return ranked.map((d) => ({
    id: d.item.id,
    image: activityImageFor(d.item),
    overline: activityOverline(d.item),
    title: d.item.title.trim(),
    subtitle: activityLocationLine(d.item, options?.city),
    note: activityNote(d.item),
    actions: resolveActionsForActivity(d.item, {
      fallbackCity: options?.city,
      includeSave: false,
    }),
  }));
}
