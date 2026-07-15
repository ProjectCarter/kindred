import type { HeroArtworkCollectionId, HeroArtworkSeason } from "./types.ts";
import {
  HERO_ARTWORK_COLLECTIONS,
  collectionMatchesSeason,
  listCollections,
  type HeroArtworkCollection,
} from "./collections.ts";
import { parseEditionDate } from "./select.ts";

/** Wikimedia-friendly collections — excludes kindred_curated-only seasonal stubs. */
const DISCOVERY_COLLECTION_IDS: HeroArtworkCollectionId[] = [
  "impressionism",
  "dutch_masters",
  "renaissance",
  "baroque",
  "ukiyo_e",
  "american_realism",
  "romanticism",
  "art_nouveau",
  "botanical_illustration",
  "scientific_illustration",
  "historic_engravings",
  "historic_maps",
  "wpa_travel_posters",
  "vintage_travel_posters",
  "national_parks",
  "nasa",
  "smithsonian",
  "library_of_congress",
  "museum_open_access",
];

const COLLECTION_SEARCH_QUERIES: Partial<
  Record<HeroArtworkCollectionId, string[]>
> = {
  impressionism: [
    "Claude Monet painting landscape",
    "Pierre-Auguste Renoir painting",
    "Impressionist painting public domain",
  ],
  dutch_masters: [
    "Johannes Vermeer painting",
    "Rembrandt van Rijn painting",
    "Dutch Golden Age painting",
  ],
  renaissance: [
    "Renaissance painting public domain",
    "Italian Renaissance altarpiece painting",
  ],
  baroque: ["Baroque painting public domain", "Caravaggio painting"],
  ukiyo_e: [
    "Hokusai woodblock print",
    "Hiroshige woodblock print ukiyo-e",
    "Japanese ukiyo-e print",
  ],
  american_realism: [
    "Edward Hopper painting",
    "Winslow Homer painting",
    "Mary Cassatt painting",
  ],
  romanticism: [
    "J.M.W. Turner landscape painting",
    "Romantic landscape painting 19th century",
  ],
  art_nouveau: [
    "Alphonse Mucha poster art nouveau",
    "Art Nouveau illustration poster",
  ],
  botanical_illustration: [
    "botanical illustration 19th century",
    "flower botanical print scientific",
    "Maria Sibylla Merian botanical",
  ],
  scientific_illustration: [
    "natural history illustration engraving",
    "astronomy antique illustration",
    "scientific illustration birds",
  ],
  historic_engravings: [
    "historic engraving city view",
    "architectural engraving 18th century",
  ],
  historic_maps: [
    "antique map engraving public domain",
    "historic cartography map",
  ],
  wpa_travel_posters: [
    "WPA travel poster national park",
    "Works Progress Administration poster",
  ],
  vintage_travel_posters: [
    "vintage travel poster railway",
    "retro travel poster landscape",
  ],
  national_parks: [
    "national park vintage poster",
    "Yellowstone park illustration",
  ],
  nasa: [
    "NASA public domain space photograph",
    "Hubble telescope image public domain",
    "Earth from space NASA image",
  ],
  smithsonian: [
    "Smithsonian open access painting",
    "Smithsonian American Art painting",
  ],
  library_of_congress: [
    "Library of Congress poster public domain",
    "Library of Congress print illustration",
  ],
  museum_open_access: [
    "museum painting public domain masterpiece",
    "open access fine art painting",
  ],
};

function daySeed(date: Date): number {
  return date.getFullYear() * 1000 + (date.getMonth() + 1) * 50 + date.getDate();
}

function eligibleCollections(season: HeroArtworkSeason): HeroArtworkCollection[] {
  return DISCOVERY_COLLECTION_IDS.map((id) => HERO_ARTWORK_COLLECTIONS[id]).filter(
    (collection) => collectionMatchesSeason(collection.id, season)
  );
}

export function pickDiscoveryCollection(
  editionDate: string,
  season: HeroArtworkSeason
): HeroArtworkCollectionId {
  const pool = eligibleCollections(season);
  const fallback = listCollections().filter((c) =>
    DISCOVERY_COLLECTION_IDS.includes(c.id)
  );
  const candidates = pool.length > 0 ? pool : fallback;
  const date = parseEditionDate(editionDate);
  const index = daySeed(date) % candidates.length;
  return candidates[index]?.id ?? "museum_open_access";
}

export function searchQueriesForCollection(
  collectionId: HeroArtworkCollectionId,
  editionDate: string
): string[] {
  const queries =
    COLLECTION_SEARCH_QUERIES[collectionId] ??
    COLLECTION_SEARCH_QUERIES.museum_open_access ??
    ["public domain painting masterpiece"];
  const date = parseEditionDate(editionDate);
  const start = daySeed(date) % queries.length;
  return [...queries.slice(start), ...queries.slice(0, start)];
}
