import type { HistoryPlaceSnapshot } from "./historyAroundTown/types";

/** In-memory handoff for History Around Town See All — same pattern as activitiesListStore. */
let todaysHistoryPlaces: HistoryPlaceSnapshot[] = [];

export function stashTodaysHistoryPlaces(places: HistoryPlaceSnapshot[]): void {
  todaysHistoryPlaces = places;
}

export function getTodaysHistoryPlaces(): HistoryPlaceSnapshot[] {
  return todaysHistoryPlaces;
}

export function getHistoryPlaceById(id: string): HistoryPlaceSnapshot | null {
  return todaysHistoryPlaces.find((place) => place.id === id) ?? null;
}
