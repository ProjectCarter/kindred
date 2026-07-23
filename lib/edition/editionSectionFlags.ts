/**
 * Edition desk kill switches — one source of truth for V1 cost testing and
 * emergency section control. Mirror in supabase/functions/_shared/edition/.
 *
 * News and Bandit's Picks remain gated separately (newsSectionsFeature,
 * banditsPicksFeature) and stay disabled for V1.
 */

export const ENABLE_EVENTS = true;
export const ENABLE_ACTIVITIES = true;
/** Cost testing default — set true to re-enable Food & Drinks desk. */
export const ENABLE_FOOD_DRINKS = true;
export const ENABLE_HISTORY_AROUND_TOWN = true;
export const ENABLE_MASTERPIECE = true;
export const ENABLE_TODAY_IN_HISTORY = true;

export type EditionSectionFlag =
  | "events"
  | "activities"
  | "food_drinks"
  | "history_around_town"
  | "masterpiece"
  | "today_in_history";

export function isEventsEnabled(): boolean {
  return ENABLE_EVENTS;
}

export function isActivitiesEnabled(): boolean {
  return ENABLE_ACTIVITIES;
}

export function isFoodDrinksEnabled(): boolean {
  return ENABLE_FOOD_DRINKS;
}

export function isHistoryAroundTownEnabled(): boolean {
  return ENABLE_HISTORY_AROUND_TOWN;
}

export function isMasterpieceEnabled(): boolean {
  return ENABLE_MASTERPIECE;
}

export function isTodayInHistoryEnabled(): boolean {
  return ENABLE_TODAY_IN_HISTORY;
}

export function isEditionSectionEnabled(section: EditionSectionFlag): boolean {
  switch (section) {
    case "events":
      return isEventsEnabled();
    case "activities":
      return isActivitiesEnabled();
    case "food_drinks":
      return isFoodDrinksEnabled();
    case "history_around_town":
      return isHistoryAroundTownEnabled();
    case "masterpiece":
      return isMasterpieceEnabled();
    case "today_in_history":
      return isTodayInHistoryEnabled();
    default:
      return false;
  }
}
