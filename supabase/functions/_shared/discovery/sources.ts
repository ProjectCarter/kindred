/**
 * Trusted discovery sources — magazine / guide priors.
 * Modeled after how Nat Geo, Smithsonian, BBC Travel, Condé Nast,
 * Michelin, Wirecutter, and careful local papers curate — not affiliate lists.
 */

export type TrustedDiscoverySource = {
  name: string;
  tier: "wire" | "guide" | "magazine" | "local" | "kindred";
  /** Quality prior 0–1 */
  weight: number;
  categories: string[];
};

export const TRUSTED_DISCOVERY_SOURCES: TrustedDiscoverySource[] = [
  {
    name: "National Geographic",
    tier: "magazine",
    weight: 1,
    categories: ["travel", "outdoors", "museums", "parks", "scenic_drives"],
  },
  {
    name: "Smithsonian Magazine",
    tier: "magazine",
    weight: 0.98,
    categories: ["museums", "books", "culture", "travel"],
  },
  {
    name: "BBC Travel",
    tier: "magazine",
    weight: 0.95,
    categories: ["travel", "experiences", "restaurants", "scenic_drives"],
  },
  {
    name: "Condé Nast Traveler",
    tier: "magazine",
    weight: 0.95,
    categories: ["travel", "restaurants", "hotels", "experiences"],
  },
  {
    name: "Michelin Guide",
    tier: "guide",
    weight: 1,
    categories: ["restaurants", "coffee"],
  },
  {
    name: "Wirecutter",
    tier: "guide",
    weight: 0.9,
    categories: ["books", "recipes", "gear"],
  },
  {
    name: "NYT Cooking",
    tier: "magazine",
    weight: 0.95,
    categories: ["recipes"],
  },
  {
    name: "Serious Eats",
    tier: "magazine",
    weight: 0.9,
    categories: ["recipes"],
  },
  {
    name: "AllRecipes Editorial",
    tier: "magazine",
    weight: 0.75,
    categories: ["recipes"],
  },
  {
    name: "Outside",
    tier: "magazine",
    weight: 0.92,
    categories: ["hiking", "parks", "outdoors"],
  },
  {
    name: "Atlas Obscura",
    tier: "magazine",
    weight: 0.93,
    categories: ["hidden_gems", "museums", "experiences", "travel"],
  },
  {
    name: "Local paper",
    tier: "local",
    weight: 0.88,
    categories: ["restaurants", "coffee", "events", "parks"],
  },
  {
    name: "Kindred Desk",
    tier: "kindred",
    weight: 0.85,
    categories: ["experiences", "weekend"],
  },
];

export function sourceQualityPrior(sourceName: string): {
  score: number;
  tier: TrustedDiscoverySource["tier"];
} {
  const key = sourceName.toLowerCase();
  for (const s of TRUSTED_DISCOVERY_SOURCES) {
    if (key.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(key)) {
      return { score: s.weight, tier: s.tier };
    }
  }
  if (/tripadvisor|yelp|tiktok|buzzfeed/i.test(key)) {
    return { score: 0.35, tier: "local" };
  }
  return { score: 0.55, tier: "local" };
}
