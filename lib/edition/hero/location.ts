import type { HeroRegionId, ResolvedLocation } from "./types";

type CityRecord = {
  city: string;
  metro: string;
  region: HeroRegionId;
  state: string;
  country: string;
  aliases?: string[];
};

/**
 * Growing place index for location-accurate hero selection.
 * Add cities here as the photography library expands —
 * selection logic does not need to change.
 */
export const CITY_DIRECTORY: CityRecord[] = [
  {
    city: "Seattle",
    metro: "Seattle",
    region: "pacific_northwest",
    state: "WA",
    country: "US",
    aliases: ["seattle wa", "bellevue", "tacoma", "redmond", "kirkland"],
  },
  {
    city: "Portland",
    metro: "Portland",
    region: "pacific_northwest",
    state: "OR",
    country: "US",
  },
  {
    city: "Phoenix",
    metro: "Phoenix",
    region: "southwest_desert",
    state: "AZ",
    country: "US",
    aliases: ["scottsdale", "tempe", "mesa", "chandler"],
  },
  {
    city: "Tucson",
    metro: "Tucson",
    region: "southwest_desert",
    state: "AZ",
    country: "US",
  },
  {
    city: "San Diego",
    metro: "San Diego",
    region: "southern_california",
    state: "CA",
    country: "US",
    aliases: ["la jolla"],
  },
  {
    city: "Los Angeles",
    metro: "Los Angeles",
    region: "southern_california",
    state: "CA",
    country: "US",
    aliases: ["santa monica", "pasadena", "long beach"],
  },
  {
    city: "San Francisco",
    metro: "San Francisco Bay Area",
    region: "pacific_northwest",
    state: "CA",
    country: "US",
    aliases: ["sf", "oakland", "berkeley", "palo alto"],
  },
  {
    city: "San Jose",
    metro: "San Francisco Bay Area",
    region: "pacific_northwest",
    state: "CA",
    country: "US",
  },
  {
    city: "Denver",
    metro: "Denver",
    region: "rocky_mountain",
    state: "CO",
    country: "US",
    aliases: ["boulder", "aurora"],
  },
  {
    city: "Salt Lake City",
    metro: "Salt Lake City",
    region: "rocky_mountain",
    state: "UT",
    country: "US",
  },
  {
    city: "Miami",
    metro: "Miami",
    region: "gulf_coast",
    state: "FL",
    country: "US",
    aliases: ["miami beach", "fort lauderdale"],
  },
  {
    city: "Chicago",
    metro: "Chicago",
    region: "midwest",
    state: "IL",
    country: "US",
  },
  {
    city: "New York",
    metro: "New York",
    region: "northeast",
    state: "NY",
    country: "US",
    aliases: ["nyc", "brooklyn", "manhattan"],
  },
  {
    city: "Boston",
    metro: "Boston",
    region: "northeast",
    state: "MA",
    country: "US",
  },
  {
    city: "Atlanta",
    metro: "Atlanta",
    region: "southeast",
    state: "GA",
    country: "US",
  },
];

function normalizePlace(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve a free-text city into metro/region metadata.
 * Unknown cities return null region rather than guessing a famous skyline.
 */
export function resolveLocation(input?: {
  city?: string | null;
  metro?: string | null;
  region?: HeroRegionId | null;
  state?: string | null;
  country?: string | null;
} | null): ResolvedLocation {
  if (!input) {
    return {
      city: null,
      metro: null,
      region: null,
      state: null,
      country: null,
    };
  }

  if (input.region || input.metro) {
    return {
      city: input.city?.trim() || null,
      metro: input.metro?.trim() || null,
      region: input.region ?? null,
      state: input.state?.trim() || null,
      country: input.country?.trim() || "US",
    };
  }

  const raw = input.city?.trim();
  if (!raw || raw.toLowerCase() === "your area") {
    return {
      city: null,
      metro: null,
      region: null,
      state: null,
      country: null,
    };
  }

  const needle = normalizePlace(raw);

  for (const record of CITY_DIRECTORY) {
    const keys = [
      record.city,
      `${record.city} ${record.state}`,
      ...(record.aliases ?? []),
    ].map(normalizePlace);

    if (keys.some((k) => needle === k || needle.includes(k) || k.includes(needle))) {
      return {
        city: record.city,
        metro: record.metro,
        region: record.region,
        state: record.state,
        country: record.country,
      };
    }
  }

  // Known city string, but not in directory — keep the label, no region guess
  // that could unlock the wrong landscape family.
  return {
    city: raw,
    metro: null,
    region: null,
    state: input.state?.trim() || null,
    country: input.country?.trim() || "US",
  };
}

export function placesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  return normalizePlace(a) === normalizePlace(b);
}
