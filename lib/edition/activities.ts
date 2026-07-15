/**
 * Activities — Kindred's "what should I go do?" desk.
 * Real, bookable venues for active participation (kayaking, escape rooms,
 * bowling, mini golf, rock climbing, axe throwing, go-karts, pickleball,
 * hiking) — never a category guess, always a verified place. Presentation
 * mirrors Local Events on purpose: same grid, same rhythm, its own voice.
 */

import type { RankedDiscoveryItem } from "./discovery";
import type { EditorialGridCard } from "../../components/EditorialCardGrid";
import { resolveListingActionsForDiscoveryItem } from "./actionBar";
import { resolveVenueClassification } from "./venueClassification";
import {
  compareByLocalProximity,
  isWithinActivitiesSectionRadius,
  type ReaderLocation,
} from "./localDiscoveryScope";
import {
  isParticipatoryActivityVenue,
  venueHayFromParts,
} from "./venueQuality";

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

  const fromVenue: Partial<Record<string, ActivitySubtype>> = {
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
  if (d.item.tags?.includes("chain")) s -= 6;
  const hay = venueHayFromParts([
    d.item.title,
    d.item.dek,
    ...(d.item.venueCategories ?? []),
  ]);
  if (d.item.category === "activities" && !isParticipatoryActivityVenue(hay)) {
    s -= 20;
  }
  if (isParticipatoryActivityVenue(hay)) s += 4;
  return s;
}

export function selectActivityCards(
  items: RankedDiscoveryItem[] | null | undefined,
  options?: { city?: string | null; readerLocation?: ReaderLocation | null }
): EditorialGridCard[] {
  const readerLocation = options?.readerLocation ?? null;
  const ranked = [...(items ?? [])]
    .filter((d) => isCompleteCard(d.item))
    .filter((d) => isWithinActivitiesSectionRadius(d, readerLocation))
    .sort((a, b) => {
      const proximity = compareByLocalProximity(a, b, readerLocation);
      if (proximity !== 0) return proximity;
      return activitySortScore(b) - activitySortScore(a);
    });

  return ranked.map((d) => ({
    id: d.item.id,
    overline: activityOverline(d.item),
    title: d.item.title.trim(),
    subtitle: activityLocationLine(d.item, options?.city),
    note: activityNote(d.item),
    actions: resolveListingActionsForDiscoveryItem(d.item, {
      fallbackCity: options?.city,
      surface: "activity",
    }),
  }));
}
