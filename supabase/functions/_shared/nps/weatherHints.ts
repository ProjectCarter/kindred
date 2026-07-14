import type { WeatherIntelligence } from "../weather/providers/types.ts";
import type { NpsParkRecord } from "./types.ts";

function parkNameShort(fullName: string): string {
  return fullName.replace(/ National Park$/i, "").replace(/ National Monument$/i, "").trim();
}

/**
 * Synthesize a weather-aware editorial hint for an NPS park.
 * Used in discovery scoring and Bandit planning notes — never raw NPS copy.
 */
export function buildNpsWeatherHint(
  park: NpsParkRecord,
  intel: WeatherIntelligence | null | undefined
): string | null {
  if (!intel) return null;
  const name = parkNameShort(park.fullName);
  const hasClosure = park.alerts.some((a) =>
    /closure|closed|danger|warning|advisory/i.test(`${a.title} ${a.category}`)
  );

  if (hasClosure || intel.severeWeather) {
    return `${name} has an active park alert — check conditions before heading out.`;
  }

  if (intel.rainBeginsAfternoon && !intel.isRainy) {
    return `Rain may arrive this afternoon — ${name} is worth an early start, or the visitor center this morning.`;
  }

  if (intel.isRainy || intel.isStormy) {
    return `Wet weather today — indoor ranger programs or the visitor center may be the better bet at ${name}.`;
  }

  if (intel.isIdealSunriseHike || (intel.isIdealMorningOutdoor && intel.uviHigh != null && intel.uviHigh <= 6)) {
    return `Clear skies and comfortable morning conditions — a good day to explore ${name}.`;
  }

  if (intel.isIdealShadedPark && intel.isHot) {
    return `High UV and heat today — shaded trails and an early start suit ${name} best.`;
  }

  if (intel.isWindy) {
    return `Windy conditions — exposed viewpoints at ${name} may feel rough; sheltered trails are the safer choice.`;
  }

  if (intel.bucket === "fair" && !intel.isHot) {
    return `Fair weather makes today a strong day for ${name}.`;
  }

  return null;
}

export function enrichNpsParksWithWeather(
  parks: NpsParkRecord[],
  intel: WeatherIntelligence | null | undefined
): NpsParkRecord[] {
  return parks.map((park) => ({
    ...park,
    weatherHint: buildNpsWeatherHint(park, intel),
  }));
}

export function topNpsPlanningNote(
  parks: NpsParkRecord[],
  intel: WeatherIntelligence | null | undefined
): string | null {
  if (!parks.length) return intel?.planningNote ?? null;
  const enriched = enrichNpsParksWithWeather(parks, intel);
  const top = enriched.find((p) => p.weatherHint)?.weatherHint;
  return top ?? intel?.planningNote ?? null;
}
