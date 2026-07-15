/**
 * Editorial variety — never let one genre crowd the Local Events desk.
 * Maximum of two picks from any single category (kindred-recommendations.mdc).
 */

import type { LocalEvent } from "./provider.ts";
import { scoreLocalEventForEdition } from "./ranking.ts";
import type { WeatherIntelligence } from "../weather/providers/types.ts";

const MAX_PER_CATEGORY = 2;

export function applyEventCategoryVariety(
  events: LocalEvent[],
  options?: { now?: Date; weatherIntel?: WeatherIntelligence | null }
): LocalEvent[] {
  const counts = new Map<string, number>();
  const out: LocalEvent[] = [];

  const scored = [...events]
    .map((event) => ({
      event,
      score: scoreLocalEventForEdition(event, options),
    }))
    .sort((a, b) => b.score - a.score);

  for (const { event } of scored) {
    const category = event.category ?? "community";
    const used = counts.get(category) ?? 0;
    if (used >= MAX_PER_CATEGORY) continue;
    counts.set(category, used + 1);
    out.push(event);
  }

  return out;
}
