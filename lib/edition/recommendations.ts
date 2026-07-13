/**
 * Recommendations — Kindred’s calm editorial desk.
 * Voice: a trusted friend who wants to improve someone’s day.
 * Kinfolk taught the pacing; Kindred keeps the paper.
 */

import type { ImageSourcePropType } from "react-native";
import type {
  DiscoveryCategory,
  RankedDiscoveryItem,
} from "./discovery";

/** Soft day-improvers — not travel-desk Experiences territory. */
const DESK_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "books",
  "movies",
  "podcasts",
  "recipes",
  "coffee",
  "restaurants",
  "experiences",
]);

const CATEGORY_LABEL: Record<string, string> = {
  books: "Reading",
  movies: "Film",
  podcasts: "Listening",
  recipes: "Kitchen",
  coffee: "Morning",
  restaurants: "Table",
  experiences: "Today",
  museums: "Culture",
  hiking: "Outdoors",
  beaches: "Shore",
  parks: "Park",
  scenic_drives: "Drive",
  travel: "Weekend",
};

/**
 * Why go / why open — personal desk voice.
 * Emphasizes the day improved, not a synopsis.
 */
const DESK_WHY: Record<string, string> = {
  disc_book_evening:
    "I think you’ll enjoy finishing something tonight — one title, no pile.",
  disc_movie_quiet:
    "A film chosen for mood, not noise. Good company for a quiet night in.",
  disc_podcast_walk:
    "One episode that earns a walk — curious, unhurried, worth the headphones.",
  disc_recipe_weeknight:
    "One pan, clear steps — cooking that leaves the evening calmer than it found you.",
  disc_recipe_weekend_bake:
    "Worth the flour. A weekend bake that teaches your hands something gentle.",
  disc_coffee_third_wave:
    "A slower cup somewhere nearby — the kind of pause that resets the morning.",
  disc_restaurant_neighborhood:
    "A neighborhood table cooking in season. Go for the evening, not the review.",
  disc_hidden_side_street:
    "A small find I’d point a friend toward — specific, local, easy to miss.",
  disc_wirecutter_gear_quiet:
    "One well-chosen tool for the season — useful, not a haul.",
};

const OPENER_IMAGE = require("../../assets/heroes/hero-default-morning.jpg");

export type RecommendationCard = {
  id: string;
  ranked: RankedDiscoveryItem;
  category: string;
  headline: string;
  /** Intimate “why today” line — Bandit’s desk voice. */
  note: string;
};

export function recommendationCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, " ");
}

export function recommendationOpenerImage(): ImageSourcePropType {
  return OPENER_IMAGE;
}

function stripMagazineTail(text: string): string {
  return text
    .replace(
      /\s*[—–-]\s*(Outside|Nat Geo|National Geographic|BBC Travel|Condé Nast Traveler|Smithsonian(?: Magazine)?|Atlas Obscura|Serious Eats|Wirecutter|NYT Cooking|Local paper|Kindred Desk)[^.—]*[.…]?/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

/** Prefer curated desk note; fall back to a cleaned, desire-first dek. */
export function recommendationNote(ranked: RankedDiscoveryItem): string {
  const curated = DESK_WHY[ranked.item.id];
  if (curated) return curated;

  const why = (ranked.reasons ?? [])
    .filter(
      (r) =>
        r &&
        typeof r.label === "string" &&
        r.label.trim() &&
        !/editorial quality|magazine desk|algorithm|score|hand-selected/i.test(
          r.label
        )
    )
    .map((r) => r.label.trim())[0];

  if (why && why.length > 20 && !/matches what you/i.test(why)) {
    return why;
  }

  const dek = stripMagazineTail(ranked.item.dek?.trim() || "");
  if (dek.length >= 24) {
    // Soften description into a nudge when it still reads like a blurb.
    if (/look for|skip the|chosen for|trustworthy/i.test(dek)) {
      return dek;
    }
    return dek;
  }

  const label = recommendationCategoryLabel(ranked.item.category).toLowerCase();
  return `Something I’d quietly put on your day — a ${label} pick worth the time.`;
}

function deskScore(d: RankedDiscoveryItem): number {
  let s = d.score ?? 0;
  if (DESK_CATEGORIES.has(d.item.category)) s += 10;
  if (["books", "podcasts", "recipes", "movies"].includes(d.item.category))
    s += 6;
  if (d.surfaces.includes("bandits_picks")) s += 5;
  if (d.surfaces.includes("weekend_ideas")) s += 3;
  return s;
}

/**
 * Bandit-selected desk picks — 3 to 5, calm and personal.
 * Prefers day-improvers over travel Experiences overlap.
 */
export function selectRecommendations(
  discoveryItems: RankedDiscoveryItem[] | null | undefined,
  options?: { max?: number }
): RecommendationCard[] {
  const max = Math.min(Math.max(options?.max ?? 5, 3), 5);
  const pool = [...(discoveryItems ?? [])].sort(
    (a, b) => deskScore(b) - deskScore(a)
  );

  const preferred = pool.filter((d) => DESK_CATEGORIES.has(d.item.category));
  const chosen = (preferred.length >= 3 ? preferred : pool).slice(0, max);

  return chosen.map((ranked) => ({
    id: ranked.item.id,
    ranked,
    category: recommendationCategoryLabel(ranked.item.category),
    headline: ranked.item.title.trim(),
    note: recommendationNote(ranked),
  }));
}
