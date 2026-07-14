import type { DiscoveryItem, DiscoveryReason } from "../discovery/types.ts";
import type { WeatherIntelligence } from "./providers/types.ts";

function venueHay(item: DiscoveryItem): string {
  return [
    item.title,
    item.dek ?? "",
    ...(item.venueCategories ?? []),
    item.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function isWaterActivity(item: DiscoveryItem): boolean {
  return /kayak|paddleboard|paddle board|surf|beach swim|sailing|boating/i.test(
    venueHay(item)
  );
}

function isFarmersMarket(item: DiscoveryItem): boolean {
  return /farmers market|farmer'?s market|produce market/i.test(venueHay(item));
}

function isIndoorActivity(item: DiscoveryItem): boolean {
  if (item.category !== "activities") return false;
  return /bowling|escape room|arcade|climbing gym|laser tag|indoor|billiards|mini golf|axe throwing|go-kart|karaoke/i.test(
    venueHay(item)
  );
}

function isOutdoorConcert(item: DiscoveryItem): boolean {
  return /concert|live music|outdoor show|amphitheater|music festival/i.test(
    venueHay(item)
  );
}

function isPatios(item: DiscoveryItem): boolean {
  return /patio|rooftop|outdoor seating|beer garden|winery|brewery/i.test(
    venueHay(item)
  );
}

function isVisitorCenter(item: DiscoveryItem): boolean {
  return /visitor center|visitor centre|ranger program|museum/i.test(venueHay(item));
}

/**
 * Additional weather-aware scoring beyond basic weatherFit buckets.
 */
export function weatherIntelligenceAdjustments(
  item: DiscoveryItem,
  intel: WeatherIntelligence | null | undefined
): DiscoveryReason[] {
  if (!intel) return [];
  const reasons: DiscoveryReason[] = [];
  const hay = venueHay(item);

  const add = (code: string, label: string, weight: number) => {
    if (weight === 0) return;
    reasons.push({ code, label, weight });
  };

  if (item.category === "beaches") {
    if (intel.isIdealBeachWeather) {
      add("weather_beach_ideal", "Ideal beach weather today", 14);
    } else if (intel.isRainy || intel.isStormy) {
      add("weather_beach_rain", "Beach day held back — wet weather", -12);
    } else if (intel.isWindy) {
      add("weather_beach_wind", "Windy shore — beach held back", -6);
    }
  }

  if (item.category === "museums" && intel.isIndoorPreferred) {
    add("weather_museum_indoor", "A good indoor day for a museum visit", 10);
  }

  if (item.category === "books" && intel.isIndoorPreferred) {
    add("weather_bookstore_indoor", "Rain or heat — a bookstore afternoon fits", 8);
  }

  if (item.category === "hiking") {
    if (intel.isIdealSunriseHike) {
      add("weather_hike_sunrise", "Clear morning — worth an early trail start", 12);
    }
    if (intel.isIdealShadedPark && intel.isHot) {
      add("weather_hike_shade", "High UV — shaded or early trails suit the day", 6);
    }
    if (intel.isHot) {
      add("weather_hike_heat", "Afternoon heat — trail held back", -8);
    }
    if (intel.isRainy || intel.isStormy) {
      add("weather_hike_rain", "Wet trails — hike held back", -10);
    }
    if (intel.isWindy) {
      add("weather_hike_wind", "Windy ridges — exposed hikes held back", -6);
    }
  }

  if (item.category === "parks" || item.tags.includes("outdoors")) {
    if (intel.bucket === "fair" && !intel.isHot) {
      add("weather_park_fair", "Fine weather for the park", 6);
    }
    if (intel.isIdealShadedPark) {
      add("weather_park_shade", "Shaded parks suit high-UV days", 8);
    }
    if (intel.isRainy) {
      add("weather_park_rain", "Park outing held back — rain likely", -8);
    }
  }

  if (item.category === "scenic_drives" && (intel.isStormy || intel.isWindy)) {
    add("weather_drive_storm", "Storm or wind — scenic drive held back", -8);
  }

  if (item.category === "activities" && isWaterActivity(item)) {
    if (intel.isRainy || intel.isStormy) {
      add("weather_water_rain", "Water activity held back — wet weather", -12);
    } else if (intel.isWindy) {
      add("weather_water_wind", "Windy water — paddle held back", -10);
    } else if (intel.isIdealBeachWeather || intel.bucket === "fair") {
      add("weather_water_fair", "Good conditions for being on the water", 8);
    }
  }

  if (isIndoorActivity(item) && intel.isIndoorPreferred) {
    add("weather_indoor_activity", "Rain or heat — indoor activity fits the day", 10);
  }

  if (isFarmersMarket(item)) {
    if (intel.bucket === "fair" && !intel.isHot) {
      add("weather_market_fair", "Pleasant weather for a farmers market", 8);
    }
    if (intel.isRainy || intel.isStormy) {
      add("weather_market_rain", "Outdoor market held back — rain likely", -10);
    }
  }

  if (isOutdoorConcert(item)) {
    if (intel.bucket === "fair" && !intel.isStormy && !intel.isWindy) {
      add("weather_concert_fair", "Fair evening weather for live music", 8);
    }
    if (intel.isRainy || intel.isStormy) {
      add("weather_concert_rain", "Outdoor show held back — wet weather", -12);
    }
  }

  if (isPatios(item) || (item.category === "restaurants" && /patio|outdoor/i.test(hay))) {
    if (intel.isIdealPatios) {
      add("weather_patio_ideal", "Patio weather — outdoor tables suit the day", 10);
    }
    if (intel.isRainy || intel.isWindy) {
      add("weather_patio_rain", "Outdoor seating held back", -8);
    }
  }

  if (item.tags.includes("nps_park")) {
    if (intel.severeWeather || intel.hasActiveAlerts) {
      add("weather_nps_alert", "Park alert or severe weather — held back", -12);
    } else if (intel.isIdealSunriseHike || intel.isIdealMorningOutdoor) {
      add("weather_nps_ideal", "Strong day for a national park visit", 14);
    } else if (intel.isRainy && isVisitorCenter(item)) {
      add("weather_nps_visitor", "Rainy day — visitor center suits the park", 8);
    } else if (intel.isRainy) {
      add("weather_nps_rain", "Wet weather — park outing held back", -8);
    }
  }

  if (intel.hasActiveAlerts && item.tags.includes("outdoors")) {
    add("weather_alert_outdoor", "Weather advisory — outdoor pick held back", -10);
  }

  if (intel.airQualityPoor && (item.category === "hiking" || item.category === "parks")) {
    add("weather_air_quality", "Air quality advisory — outdoor pick held back", -8);
  }

  if (intel.uviHigh != null && intel.uviHigh >= 9 && item.category === "beaches") {
    add("weather_uv_high", "Very high UV — beach timing matters", -4);
  }

  if (
    intel.isIndoorPreferred &&
    (item.category === "coffee" ||
      item.category === "restaurants" ||
      item.category === "bakeries")
  ) {
    add("weather_indoor_errand", "A comfortable day for something nearby", 4);
  }

  return reasons;
}

export function sumWeatherIntelligenceScore(reasons: DiscoveryReason[]): number {
  return reasons.reduce((n, r) => n + r.weight, 0);
}
