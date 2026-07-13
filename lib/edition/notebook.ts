/**
 * Bandit’s Notebook — discovery carousel at the end of the paper.
 * Apple Newsroom’s “In the Loop” taught horizontal snap + peek;
 * this is Bandit’s personal notebook — mixed finds, warmer voice.
 */

import type { ImageSourcePropType } from "react-native";
import type {
  DiscoveryCategory,
  DiscoveryPayload,
  DiscoverySurface,
  RankedDiscoveryItem,
} from "./discovery";
import { discoveryItemsForSurface } from "./discovery";

/** Editor’s notebook mix — places, culture, and quiet media. */
const NOTEBOOK_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "beaches",
  "scenic_drives",
  "coffee",
  "travel",
  "books",
  "restaurants",
  "experiences",
  "parks",
  "hiking",
  "museums",
  "movies",
  "podcasts",
]);

const NOTEBOOK_SURFACES: DiscoverySurface[] = [
  "hidden_gems",
  "weekend_ideas",
  "beaches",
  "scenic_drives",
  "coffee",
  "parks",
  "hiking",
  "museums",
  "restaurants",
  "books",
  "movies",
  "podcasts",
];

const CATEGORY_LABEL: Record<string, string> = {
  beaches: "Hidden shores",
  scenic_drives: "Scenic drives",
  coffee: "Coffee",
  travel: "Weekend trips",
  books: "Reading",
  restaurants: "Quiet tables",
  experiences: "Hidden gems",
  parks: "Parks",
  hiking: "Trails",
  museums: "Culture",
  movies: "Film",
  podcasts: "Listening",
};

/** Preferentially match mood to category, then fall back to unused pool. */
const CATEGORY_PHOTO_PREFS: Record<string, number[]> = {
  beaches: [0],
  scenic_drives: [1, 2],
  coffee: [3],
  travel: [4, 1],
  books: [5, 3],
  restaurants: [3, 6],
  experiences: [6, 7],
  parks: [7, 5],
  hiking: [2, 1],
  museums: [4, 6],
  movies: [3, 6],
  podcasts: [5, 7],
};

/** Full stationery photo library — one unique asset per card. */
const NOTEBOOK_PHOTO_POOL: ImageSourcePropType[] = [
  require("../../assets/heroes/hero-beach-morning.jpg"),
  require("../../assets/heroes/hero-summer-sunrise.jpg"),
  require("../../assets/heroes/hero-mountain-morning.jpg"),
  require("../../assets/heroes/hero-default-morning.jpg"),
  require("../../assets/heroes/hero-city-sunrise.jpg"),
  require("../../assets/heroes/hero-autumn-leaves.jpg"),
  require("../../assets/heroes/hero-winter-snowfall.jpg"),
  require("../../assets/heroes/hero-spring-flowers.jpg"),
];

const INTROS = [
  "A few things I circled for you.",
  "I thought these were worth saving.",
  "If you have twenty quiet minutes…",
  "These almost didn’t make today’s edition.",
];

/** Short Bandit notebook lines — personal, never algorithmic. */
const NOTEBOOK_NOTE: Record<string, string> = {
  disc_beach_morning:
    "I circled this for early light — go before the day finds it.",
  disc_drive_coastal:
    "Saved for days that need a longer sky. Pull off when it asks.",
  disc_coffee_third_wave:
    "A calm cup I’d send a friend to. Sit by the window if you can.",
  disc_travel_day_trip:
    "Worth the drive: one place, one meal, home soft by evening.",
  disc_book_evening:
    "One title. Leave the pile. I think you’ll finish this one.",
  disc_restaurant_neighborhood:
    "A quiet table I keep meaning to mention — cook in season, linger.",
  disc_hidden_side_street:
    "Almost didn’t make the paper. Small, local, easy to walk past.",
  disc_park_afternoon:
    "Shade and a bench. Twenty minutes here resets more than you’d think.",
  disc_hike_ridge:
    "Circled for the overlook, not the steps. Pack water; stay longer.",
  disc_museum_wing:
    "One room done well. Leave the checklist — I always do.",
  disc_movie_quiet:
    "A film for a soft night in. Mood over noise.",
  disc_podcast_walk:
    "One episode for a walk. Curious, unhurried — worth the headphones.",
  disc_recipe_weeknight:
    "If the evening needs something gentle: one pan, clear steps.",
  disc_recipe_weekend_bake:
    "A weekend bake worth the flour — slow hands, quiet kitchen.",
};

export type NotebookCard = {
  id: string;
  ranked: RankedDiscoveryItem;
  category: string;
  headline: string;
  note: string;
  image: ImageSourcePropType;
};

function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, " ");
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function notebookIntro(cards: NotebookCard[]): string {
  if (!cards.length) return INTROS[0];
  return INTROS[hashId(cards[0].id) % INTROS.length];
}

function notebookNote(ranked: RankedDiscoveryItem): string {
  const curated = NOTEBOOK_NOTE[ranked.item.id];
  if (curated) return curated;

  const dek = ranked.item.dek?.trim() || "";
  const cleaned = dek
    .replace(
      /\s*[—–-]\s*(Outside|National Geographic|BBC Travel|Condé Nast Traveler|Smithsonian(?: Magazine)?|Atlas Obscura|Serious Eats|Wirecutter|Kindred Desk|NYT Cooking)[^.—]*[.…]?/gi,
      ""
    )
    .trim();

  if (cleaned.length >= 24 && cleaned.length <= 130) {
    return cleaned;
  }

  return "I tucked this in the notebook — worth a quiet look.";
}

function score(d: RankedDiscoveryItem): number {
  let s = d.score ?? 0;
  if (d.surfaces.includes("hidden_gems")) s += 10;
  if (d.surfaces.includes("weekend_ideas")) s += 8;
  if (NOTEBOOK_CATEGORIES.has(d.item.category)) s += 6;
  return s;
}

function collect(
  discovery: DiscoveryPayload | null | undefined,
  discoveryItems?: RankedDiscoveryItem[] | null
): RankedDiscoveryItem[] {
  const byId = new Map<string, RankedDiscoveryItem>();

  for (const surface of NOTEBOOK_SURFACES) {
    for (const item of discoveryItemsForSurface(discovery, surface)) {
      if (!NOTEBOOK_CATEGORIES.has(item.item.category)) continue;
      if (!byId.has(item.item.id)) byId.set(item.item.id, item);
    }
  }

  for (const item of discoveryItems ?? []) {
    if (!NOTEBOOK_CATEGORIES.has(item.item.category)) continue;
    if (!byId.has(item.item.id)) byId.set(item.item.id, item);
  }

  // Fallback: any surface with notebook categories.
  if (byId.size < 3 && discovery?.surfaces) {
    for (const key of Object.keys(discovery.surfaces) as DiscoverySurface[]) {
      for (const item of discoveryItemsForSurface(discovery, key)) {
        if (!NOTEBOOK_CATEGORIES.has(item.item.category)) continue;
        if (!byId.has(item.item.id)) byId.set(item.item.id, item);
      }
    }
  }

  return [...byId.values()].sort((a, b) => score(b) - score(a));
}

/**
 * Prefer a mixed notebook: different categories first, then fill.
 * Caps at `max` (typically 4–6).
 */
function diversify(
  ranked: RankedDiscoveryItem[],
  max: number
): RankedDiscoveryItem[] {
  const picked: RankedDiscoveryItem[] = [];
  const seenCat = new Set<string>();

  for (const item of ranked) {
    if (picked.length >= max) break;
    if (seenCat.has(item.item.category)) continue;
    picked.push(item);
    seenCat.add(item.item.category);
  }

  for (const item of ranked) {
    if (picked.length >= max) break;
    if (picked.some((p) => p.item.id === item.item.id)) continue;
    picked.push(item);
  }

  return picked;
}

/**
 * Assign one unique photo per card — never repeat within the carousel.
 */
function assignUniqueImages(
  items: RankedDiscoveryItem[]
): ImageSourcePropType[] {
  const used = new Set<number>();
  const poolLen = NOTEBOOK_PHOTO_POOL.length;

  return items.map((d) => {
    const prefs = CATEGORY_PHOTO_PREFS[d.item.category] ?? [];
    let chosen = prefs.find((i) => i >= 0 && i < poolLen && !used.has(i));

    if (chosen === undefined) {
      const start = hashId(d.item.id) % poolLen;
      for (let step = 0; step < poolLen; step++) {
        const i = (start + step) % poolLen;
        if (!used.has(i)) {
          chosen = i;
          break;
        }
      }
    }

    // If pool exhausted (shouldn't happen at max 6 / 8 photos), reuse last.
    if (chosen === undefined) {
      chosen = Math.max(0, poolLen - 1);
    }

    used.add(chosen);
    return NOTEBOOK_PHOTO_POOL[chosen];
  });
}

/**
 * Finite notebook pages — typically 4–6, never infinite.
 * Returns [] when there isn’t enough for a calm carousel (min 3).
 */
export function selectNotebookCards(
  discoveryItems: RankedDiscoveryItem[] | null | undefined,
  options?: {
    discovery?: DiscoveryPayload | null;
    max?: number;
  }
): NotebookCard[] {
  const max = Math.min(options?.max ?? 6, NOTEBOOK_PHOTO_POOL.length);
  const ranked = diversify(collect(options?.discovery, discoveryItems), max);

  if (ranked.length < 3) return [];

  const images = assignUniqueImages(ranked);

  return ranked.map((d, i) => ({
    id: d.item.id,
    ranked: d,
    category: categoryLabel(d.item.category),
    headline: d.item.title.trim(),
    note: notebookNote(d),
    image: images[i],
  }));
}
