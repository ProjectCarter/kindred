import type {
  DiscoveryCategory,
  DiscoveryFamily,
  DiscoverySurface,
} from "./types.ts";

export const CATEGORY_FAMILY: Record<DiscoveryCategory, DiscoveryFamily> = {
  coffee: "food_drink",
  restaurants: "food_drink",
  recipes: "food_drink",
  beaches: "outdoors",
  hiking: "outdoors",
  parks: "outdoors",
  scenic_drives: "outdoors",
  museums: "culture_leisure",
  books: "culture_leisure",
  movies: "culture_leisure",
  podcasts: "culture_leisure",
  experiences: "travel",
  travel: "travel",
};

export const SURFACE_CATEGORIES: Record<DiscoverySurface, DiscoveryCategory[]> = {
  bandits_picks: [
    "experiences",
    "museums",
    "books",
    "restaurants",
    "hiking",
    "recipes",
    "podcasts",
  ],
  weekend_ideas: [
    "parks",
    "hiking",
    "museums",
    "restaurants",
    "beaches",
    "scenic_drives",
    "coffee",
    "experiences",
  ],
  hidden_gems: [
    "coffee",
    "restaurants",
    "parks",
    "museums",
    "scenic_drives",
    "experiences",
  ],
  coffee: ["coffee"],
  restaurants: ["restaurants"],
  beaches: ["beaches"],
  hiking: ["hiking"],
  museums: ["museums"],
  parks: ["parks"],
  scenic_drives: ["scenic_drives"],
  books: ["books"],
  movies: ["movies"],
  podcasts: ["podcasts"],
  recipes: ["recipes"],
};

export const SURFACE_HEADLINES: Record<DiscoverySurface, string> = {
  bandits_picks: "Bandit's Picks",
  weekend_ideas: "Weekend Ideas",
  hidden_gems: "Hidden Gems",
  coffee: "Coffee",
  restaurants: "Restaurants",
  beaches: "Beaches",
  hiking: "Hiking",
  museums: "Museums",
  parks: "Parks",
  scenic_drives: "Scenic Drives",
  books: "Books",
  movies: "Movies",
  podcasts: "Podcasts",
  recipes: "Recipes",
};

export const SURFACE_EDITOR_NOTES: Record<DiscoverySurface, string> = {
  bandits_picks:
    "A short weekly list — curious, calm, never overwhelming.",
  weekend_ideas:
    "Outing ideas chosen for the weekend paper — weather-aware when possible.",
  hidden_gems:
    "Quieter finds with local character — uniqueness over popularity.",
  coffee: "Places worth the walk — not a chain roundup.",
  restaurants: "Tables worth knowing — editorial, never affiliate.",
  beaches: "Shoreline worth the trip — seasonal and weather-aware.",
  hiking: "Trails with a clear reason to go.",
  museums: "Exhibitions and rooms worth an unhurried visit.",
  parks: "Green space for a quieter hour.",
  scenic_drives: "Roads chosen for the view, not the miles.",
  books: "Reading worth your evening — magazine-desk judgment.",
  movies: "Films worth the time — not a streaming dump.",
  podcasts: "Listening with editorial care.",
  recipes: "Cooking for a calm kitchen — trustworthy sources only.",
};

/** Map onboarding / news interests → discovery affinities. */
export function interestToDiscoveryCategories(
  interests: string[]
): DiscoveryCategory[] {
  const out = new Set<DiscoveryCategory>();
  for (const raw of interests) {
    const i = raw.toLowerCase();
    if (i.includes("culture") || i.includes("art")) {
      out.add("museums");
      out.add("books");
      out.add("movies");
    }
    if (i.includes("health") || i.includes("wellbeing")) {
      out.add("hiking");
      out.add("parks");
      out.add("recipes");
    }
    if (i.includes("climate") || i.includes("environment")) {
      out.add("parks");
      out.add("beaches");
      out.add("scenic_drives");
      out.add("hiking");
    }
    if (i.includes("science")) {
      out.add("museums");
      out.add("books");
      out.add("podcasts");
    }
    if (i.includes("sport")) {
      out.add("parks");
      out.add("hiking");
    }
    if (i.includes("business") || i.includes("tech")) {
      out.add("books");
      out.add("podcasts");
      out.add("coffee");
    }
  }
  return Array.from(out);
}

export function seasonForDate(date: Date): "spring" | "summer" | "autumn" | "winter" {
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

export function weatherBucket(
  summary?: string | null
): "fair" | "cool" | "rainy" | "any" {
  if (!summary) return "any";
  const s = summary.toLowerCase();
  if (/rain|shower|storm|drizzle/.test(s)) return "rainy";
  if (/snow|cold|freezing|chilly/.test(s)) return "cool";
  if (/sun|clear|warm|mild|beautiful/.test(s)) return "fair";
  return "any";
}
