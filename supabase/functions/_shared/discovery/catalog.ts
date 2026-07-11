import type { DiscoveryItem } from "./types.ts";
import { CATEGORY_FAMILY } from "./taxonomy.ts";

function item(
  partial: Omit<DiscoveryItem, "family"> & { family?: DiscoveryItem["family"] }
): DiscoveryItem {
  return {
    ...partial,
    family: partial.family ?? CATEGORY_FAMILY[partial.category],
  };
}

/**
 * Editorial seed catalog — calm, magazine-desk recommendations.
 * Location-agnostic with room for local overlays from events.
 * Providers can replace or extend this later without changing the engine.
 */
export const DISCOVERY_SEED_CATALOG: DiscoveryItem[] = [
  item({
    id: "disc_coffee_third_wave",
    title: "A third-wave café with a quiet corner",
    dek: "Single-origin pour-overs, no rush — the kind of place a city magazine would keep on a short list.",
    category: "coffee",
    source: { name: "Kindred Desk", tier: "kindred" },
    tags: ["coffee", "morning", "local"],
    seasons: ["anytime"],
    weatherFit: ["any", "rainy", "cool", "fair"],
    popularity: 0.45,
    uniqueness: 0.7,
    localExpertise: 0.75,
    quality: 0.85,
  }),
  item({
    id: "disc_restaurant_neighborhood",
    title: "A neighborhood restaurant cooking in season",
    dek: "Short menu, local produce, tables that turn slowly — Michelin Bib-style judgment, not a viral list.",
    category: "restaurants",
    source: { name: "Michelin Guide", tier: "guide" },
    tags: ["dinner", "local", "seasonal"],
    seasons: ["anytime"],
    weatherFit: ["any"],
    popularity: 0.5,
    uniqueness: 0.65,
    localExpertise: 0.8,
    quality: 0.95,
  }),
  item({
    id: "disc_recipe_weeknight",
    title: "One calm weeknight recipe",
    dek: "A trustworthy kitchen desk pick — one pan, clear steps, worth making twice.",
    category: "recipes",
    source: { name: "NYT Cooking", tier: "magazine" },
    tags: ["cooking", "weeknight"],
    seasons: ["anytime"],
    weatherFit: ["any", "rainy", "cool"],
    popularity: 0.55,
    uniqueness: 0.4,
    localExpertise: 0.2,
    quality: 0.95,
  }),
  item({
    id: "disc_beach_morning",
    title: "An early shoreline walk",
    dek: "Before the crowds — salt air and a clear horizon. Nat Geo travel desk energy, quietly.",
    category: "beaches",
    source: { name: "National Geographic", tier: "magazine" },
    tags: ["outdoors", "morning", "weekend"],
    seasons: ["summer", "spring", "autumn"],
    weatherFit: ["fair"],
    popularity: 0.6,
    uniqueness: 0.45,
    localExpertise: 0.55,
    quality: 0.9,
  }),
  item({
    id: "disc_hike_ridge",
    title: "A ridge trail with a real view",
    dek: "Chosen for the overlook, not the step count — Outside Magazine sensibility.",
    category: "hiking",
    source: { name: "Outside", tier: "magazine" },
    tags: ["outdoors", "weekend", "views"],
    seasons: ["spring", "summer", "autumn"],
    weatherFit: ["fair", "cool"],
    popularity: 0.5,
    uniqueness: 0.55,
    localExpertise: 0.7,
    quality: 0.9,
  }),
  item({
    id: "disc_park_afternoon",
    title: "An afternoon in a city park",
    dek: "Shade, a bench, and room to think — the newspaper’s simplest outdoor recommendation.",
    category: "parks",
    source: { name: "Local paper", tier: "local" },
    tags: ["outdoors", "local", "quiet"],
    seasons: ["spring", "summer", "autumn"],
    weatherFit: ["fair", "cool"],
    popularity: 0.55,
    uniqueness: 0.35,
    localExpertise: 0.85,
    quality: 0.8,
  }),
  item({
    id: "disc_drive_coastal",
    title: "A short scenic drive",
    dek: "Pull-offs matter more than mileage — BBC Travel’s idea of a good road.",
    category: "scenic_drives",
    source: { name: "BBC Travel", tier: "magazine" },
    tags: ["travel", "weekend", "views"],
    seasons: ["spring", "summer", "autumn"],
    weatherFit: ["fair"],
    popularity: 0.45,
    uniqueness: 0.6,
    localExpertise: 0.5,
    quality: 0.9,
  }),
  item({
    id: "disc_museum_wing",
    title: "One museum wing, unhurried",
    dek: "Skip the checklist — Smithsonian energy: one room done well.",
    category: "museums",
    source: { name: "Smithsonian Magazine", tier: "magazine" },
    tags: ["culture", "indoor", "weekend"],
    seasons: ["anytime"],
    weatherFit: ["any", "rainy", "cool"],
    popularity: 0.55,
    uniqueness: 0.5,
    localExpertise: 0.6,
    quality: 0.95,
  }),
  item({
    id: "disc_book_evening",
    title: "An evening book worth finishing",
    dek: "Magazine desk judgment — one title, not a pile.",
    category: "books",
    source: { name: "Smithsonian Magazine", tier: "magazine" },
    tags: ["reading", "evening"],
    seasons: ["anytime"],
    weatherFit: ["any", "rainy", "cool"],
    popularity: 0.4,
    uniqueness: 0.55,
    localExpertise: 0.15,
    quality: 0.9,
  }),
  item({
    id: "disc_movie_quiet",
    title: "A film for a quiet night in",
    dek: "Chosen for craft and mood — never a streaming dump.",
    category: "movies",
    source: { name: "Kindred Desk", tier: "kindred" },
    tags: ["evening", "indoor"],
    seasons: ["anytime"],
    weatherFit: ["any", "rainy", "cool"],
    popularity: 0.45,
    uniqueness: 0.5,
    localExpertise: 0.1,
    quality: 0.85,
  }),
  item({
    id: "disc_podcast_walk",
    title: "A podcast for a morning walk",
    dek: "One episode that earns the time — curious, not loud.",
    category: "podcasts",
    source: { name: "Kindred Desk", tier: "kindred" },
    tags: ["morning", "listening"],
    seasons: ["anytime"],
    weatherFit: ["any", "fair", "cool"],
    popularity: 0.4,
    uniqueness: 0.55,
    localExpertise: 0.1,
    quality: 0.85,
  }),
  item({
    id: "disc_hidden_side_street",
    title: "A side-street find locals keep quiet",
    dek: "Atlas Obscura spirit — small, specific, memorable.",
    category: "experiences",
    source: { name: "Atlas Obscura", tier: "magazine" },
    tags: ["hidden_gem", "local", "weekend"],
    seasons: ["anytime"],
    weatherFit: ["any"],
    popularity: 0.25,
    uniqueness: 0.9,
    localExpertise: 0.85,
    quality: 0.9,
  }),
  item({
    id: "disc_travel_day_trip",
    title: "A near day trip with a clear reason",
    dek: "Condé Nast Traveler calm — one destination, one good meal, home by evening.",
    category: "travel",
    source: { name: "Condé Nast Traveler", tier: "magazine" },
    tags: ["weekend", "travel"],
    seasons: ["spring", "summer", "autumn"],
    weatherFit: ["fair", "cool"],
    popularity: 0.5,
    uniqueness: 0.55,
    localExpertise: 0.4,
    quality: 0.92,
  }),
  item({
    id: "disc_recipe_weekend_bake",
    title: "A weekend bake worth the flour",
    dek: "Serious Eats discipline — technique that teaches, not just a photo.",
    category: "recipes",
    source: { name: "Serious Eats", tier: "magazine" },
    tags: ["cooking", "weekend"],
    seasons: ["autumn", "winter", "anytime"],
    weatherFit: ["any", "rainy", "cool"],
    popularity: 0.5,
    uniqueness: 0.45,
    localExpertise: 0.15,
    quality: 0.92,
  }),
  item({
    id: "disc_wirecutter_gear_quiet",
    title: "One well-chosen tool for the season",
    dek: "Wirecutter-style care — useful, tested, never a haul.",
    category: "experiences",
    source: { name: "Wirecutter", tier: "guide" },
    tags: ["gear", "practical"],
    seasons: ["anytime"],
    weatherFit: ["any"],
    popularity: 0.55,
    uniqueness: 0.35,
    localExpertise: 0.1,
    quality: 0.9,
  }),
];

/**
 * Turn edition local events into discovery candidates.
 */
export function localEventsAsDiscoveryItems(
  events: Array<{
    name: string;
    startDateTime: string;
    venue: string;
    city: string;
    sourceUrl?: string;
    sourceName?: string;
  }>
): DiscoveryItem[] {
  return events.slice(0, 12).map((e, i) => {
    const hay = `${e.name} ${e.venue}`.toLowerCase();
    let category: DiscoveryItem["category"] = "experiences";
    if (/museum|gallery|exhibit/.test(hay)) category = "museums";
    else if (/hike|trail|walk/.test(hay)) category = "hiking";
    else if (/park|garden/.test(hay)) category = "parks";
    else if (/beach|shore|coast/.test(hay)) category = "beaches";
    else if (/coffee|cafe|café/.test(hay)) category = "coffee";
    else if (/restaurant|dinner|food|market/.test(hay)) category = "restaurants";

    const idBase = e.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 40);

    return item({
      id: `event_${idBase}_${i}`,
      title: e.name.trim(),
      dek: `${e.venue}${e.city ? ` · ${e.city}` : ""} — ${e.startDateTime}`,
      category,
      place: { city: e.city || null },
      source: {
        name: e.sourceName?.trim() || "Local listing",
        tier: "local",
        url: e.sourceUrl ?? null,
      },
      url: e.sourceUrl ?? null,
      tags: ["local_event", "local"],
      seasons: ["anytime"],
      weatherFit: ["any"],
      popularity: 0.4,
      uniqueness: 0.55,
      localExpertise: 0.9,
      quality: 0.7,
    });
  });
}
