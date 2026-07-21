/**
 * Editorial venue and event quality signals — shared by discovery scoring
 * and local event ranking. Bandit publishes a newspaper, not a directory.
 */

/** Venues where you actively participate — not passive place listings. */
export const PARTICIPATORY_ACTIVITY_PATTERN =
  /\b(escape room|bowling|mini golf|miniature golf|putt.?putt|rock climbing|climbing gym|bouldering|axe throwing|go.?kart|karting|pickleball|laser tag|paintball|billiards|pool hall|arcade|batting cage|karaoke|kayak|paddleboard|paddle board|canoe|surf school|snorkel|indoor skydiv|trampoline park|roller.?(skat|rink)|ice.?(skat|rink)|comedy club|stand.?up|improv theater|aquarium|planetarium|observatory)\b/i;

/** Low editorial value — accurate listings, but not worth recommending. */
export const LOW_VALUE_VENUE_PATTERN =
  /\b(airport|international airport|parking lot|park(?:ing)? garage|strip mall|shopping plaza|retail plaza|gas station|car wash|self storage|storage unit|u-?haul|check cashing|payday loan|tax prep|ups store|fedex office|dry cleaner|laundromat|auto repair|oil change|jiffy lube|mcdonald|burger king|subway\b|7-?eleven)\b/i;

/** Places a local editor would proudly recommend. */
export const SCENIC_GEM_PATTERN =
  /\b(overlook|viewpoint|scenic|waterfront|harbor|harbour|botanical|arboretum|conservatory|historic district|heritage|landmark|hidden gem|neighborhood favorite|neighbourhood favourite|farmers market|farmer'?s market|waterfall|trailhead|state park|nature preserve|wildlife refuge|memorial park|public garden|riverwalk|boardwalk|pier|lighthouse|monument|plaza|town square|civic center)\b/i;

/** Vague event titles that rarely deserve publication without strong facts. */
export const GENERIC_EVENT_TITLE_PATTERN =
  /^(community|networking|meetup|meeting|social|gathering|event|workshop|seminar|class|program|fundraiser|festival)\b/i;

export function venueHayFromParts(
  parts: Array<string | null | undefined>
): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isParticipatoryActivityVenue(hay: string): boolean {
  return PARTICIPATORY_ACTIVITY_PATTERN.test(hay);
}

export function isLowValueVenue(hay: string): boolean {
  return LOW_VALUE_VENUE_PATTERN.test(hay);
}

export function isScenicOrHiddenGem(hay: string): boolean {
  return SCENIC_GEM_PATTERN.test(hay);
}

export function isGenericEventTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (GENERIC_EVENT_TITLE_PATTERN.test(t)) return true;
  if (/^community meetup$/i.test(t)) return true;
  if (/^networking event$/i.test(t)) return true;
  return false;
}

/** Supply retail — not a participatory activity (Activity Playbook reject). */
export const ACTIVITY_SUPPLY_RETAIL_PATTERN =
  /\b(pro shop|pro-shop|supply store|equipment retail|gear shop|sporting goods)\b/i;

const BOWLING_VENUE_PATTERN =
  /\b(bowlero|bowling alley|bowling center|bowling lane|lanes?\b|lucky strike)\b/i;

export function isActivitySupplyRetail(hay: string): boolean {
  return ACTIVITY_SUPPLY_RETAIL_PATTERN.test(hay);
}

/** True when listing reads as gear retail, not a place to go do the activity. */
export function isActivityProShopHay(hay: string): boolean {
  if (isActivitySupplyRetail(hay)) return true;
  if (
    /\bbowling\b/i.test(hay) &&
    !BOWLING_VENUE_PATTERN.test(hay) &&
    /\b(shop|store|supply|retail|pro)\b/i.test(hay)
  ) {
    return true;
  }
  return false;
}

export function isActivityProShopParts(
  parts: Array<string | null | undefined>
): boolean {
  return isActivityProShopHay(venueHayFromParts(parts));
}

export { isEditoriallyExcludedListing, isAdultEntertainmentListing } from "../localEvents/familyFriendlyFilter.ts";
