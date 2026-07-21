import type { RankedDiscoveryItem } from "./discovery.ts";
import { resolveVenueClassification } from "./venueClassification.ts";

export type ActivitySubtype =
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
  | "general";

const SUBTYPE_MATCHERS: Array<{ subtype: ActivitySubtype; pattern: RegExp }> = [
  { subtype: "mini_golf", pattern: /mini.?golf|miniature golf|putt.?putt/i },
  { subtype: "water_recreation", pattern: /kayak|paddleboard|paddle board|surf/i },
  { subtype: "escape_rooms", pattern: /escape room/i },
  { subtype: "roller_skating", pattern: /roller.?(skat|rink)/i },
  { subtype: "ice_skating", pattern: /ice.?(skat|rink)/i },
  { subtype: "bowling", pattern: /\bbowling\b|\bbowlero\b|\blanes\b/i },
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

export function inferActivitySubtype(
  item: RankedDiscoveryItem["item"]
): ActivitySubtype {
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
