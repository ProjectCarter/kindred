/**
 * Experiences — Kindred’s travel desk.
 * Layout & editorial rhythm inspired by Condé Nast Traveler destination
 * storytelling; Kindred paper tokens and local place focus remain ours.
 */

import type { ImageSourcePropType } from "react-native";
import type {
  DiscoveryCategory,
  DiscoveryPayload,
  DiscoverySurface,
  RankedDiscoveryItem,
} from "./discovery";
import { discoveryItemsForSurface } from "./discovery";

/** Categories that read as “go there today” experiences. */
export const EXPERIENCE_CATEGORIES: ReadonlySet<DiscoveryCategory> = new Set([
  "hiking",
  "beaches",
  "parks",
  "scenic_drives",
  "museums",
  "experiences",
  "travel",
  "coffee",
  "books",
]);

const EXPERIENCE_SURFACES: DiscoverySurface[] = [
  "hidden_gems",
  "weekend_ideas",
  "hiking",
  "beaches",
  "parks",
  "scenic_drives",
  "museums",
  "coffee",
];

/** Rubrics — small uppercase labels, travel-desk tone. */
const CATEGORY_LABEL: Record<string, string> = {
  hiking: "Trails",
  beaches: "Beaches",
  parks: "Parks",
  scenic_drives: "Road trips",
  museums: "Culture",
  experiences: "Hidden gems",
  travel: "Weekends",
  coffee: "Cafés",
  books: "Bookstores",
  restaurants: "Tables",
};

/**
 * Desire-first editorial sentences when the seed dek still names a magazine
 * or reads like a template. Tone: travel editor, not database.
 */
const INSPIRED_DEK: Record<string, string> = {
  disc_coffee_third_wave:
    "A calm counter, a real cup, and a seat by the window — the kind of morning that resets the day.",
  disc_beach_morning:
    "Salt air before the crowds. Walk until the horizon feels close enough to touch.",
  disc_hike_ridge:
    "Skip the step-count. Go for the overlook — the view that makes you linger.",
  disc_park_afternoon:
    "Shade, a bench, and nowhere else you need to be. The simplest outdoor luxury.",
  disc_drive_coastal:
    "Pull-offs matter more than mileage. Pack water, take the scenic route home.",
  disc_museum_wing:
    "One wing, unhurried — leave the checklist at the door and let a single room hold you.",
  disc_book_evening:
    "A quiet aisle, a title that finds you, and an afternoon that stretches longer than planned.",
  disc_hidden_side_street:
    "The side street locals keep to themselves — small, specific, and worth the detour.",
  disc_travel_day_trip:
    "One clear destination, one good meal, and home by evening — a day that earns the drive.",
};

/** Bundled editorial photography — atmospheric place light, not icons. */
const CATEGORY_PHOTOS: Record<string, ImageSourcePropType[]> = {
  hiking: [
    require("../../assets/heroes/hero-mountain-morning.jpg"),
    require("../../assets/heroes/hero-autumn-leaves.jpg"),
  ],
  beaches: [require("../../assets/heroes/hero-beach-morning.jpg")],
  parks: [
    require("../../assets/heroes/hero-spring-flowers.jpg"),
    require("../../assets/heroes/hero-summer-sunrise.jpg"),
  ],
  scenic_drives: [
    require("../../assets/heroes/hero-summer-sunrise.jpg"),
    require("../../assets/heroes/hero-mountain-morning.jpg"),
  ],
  museums: [require("../../assets/heroes/hero-city-sunrise.jpg")],
  experiences: [
    require("../../assets/heroes/hero-default-morning.jpg"),
    require("../../assets/heroes/hero-spring-flowers.jpg"),
  ],
  travel: [
    require("../../assets/heroes/hero-city-sunrise.jpg"),
    require("../../assets/heroes/hero-mountain-morning.jpg"),
  ],
  coffee: [require("../../assets/heroes/hero-default-morning.jpg")],
  books: [require("../../assets/heroes/hero-autumn-leaves.jpg")],
};

const FALLBACK_PHOTOS: ImageSourcePropType[] = [
  require("../../assets/heroes/hero-default-morning.jpg"),
  require("../../assets/heroes/hero-summer-sunrise.jpg"),
];

export type ExperienceCard = {
  id: string;
  ranked: RankedDiscoveryItem;
  category: string;
  headline: string;
  dek: string;
  location: string | null;
  image: ImageSourcePropType;
};

export type ExperiencesSelection = {
  featured: ExperienceCard | null;
  /** Full-bleed stacked stories — CNT package rhythm. */
  stories: ExperienceCard[];
  /** Final landscape pair when we have enough depth. */
  pair: ExperienceCard[];
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function experienceCategoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.replace(/_/g, " ");
}

export function experienceImageFor(
  category: string,
  id: string
): ImageSourcePropType {
  const pool = CATEGORY_PHOTOS[category] ?? FALLBACK_PHOTOS;
  return pool[hashId(id) % pool.length] ?? FALLBACK_PHOTOS[0];
}

export function experienceLocationLine(
  item: RankedDiscoveryItem["item"],
  fallbackCity?: string | null
): string | null {
  const parts = [
    item.place?.city?.trim(),
    item.place?.region?.trim() || item.place?.state?.trim(),
  ].filter(Boolean);
  if (parts.length) return parts.join(", ");
  const city = fallbackCity?.trim();
  if (city) return city;
  return null;
}

/** Strip magazine name-drops and template voice into desire-first copy. */
export function inspireExperienceDek(
  item: RankedDiscoveryItem["item"]
): string {
  const curated = INSPIRED_DEK[item.id];
  if (curated) return curated;

  let dek = item.dek?.trim() || "";
  if (!dek) {
    const label = experienceCategoryLabel(item.category).toLowerCase();
    return `A ${label} pick worth the trip — go once, and you’ll want to return.`;
  }

  // Remove “— Magazine Name sensibility / energy / calm” tails.
  dek = dek
    .replace(
      /\s*[—–-]\s*(Outside|Nat Geo|National Geographic|BBC Travel|Condé Nast Traveler|Smithsonian(?: Magazine)?|Atlas Obscura|Serious Eats|Wirecutter|Local paper)[^.—]*[.…]?/gi,
      ""
    )
    .replace(
      /\b(Outside|National Geographic|BBC Travel|Condé Nast Traveler|Smithsonian(?: Magazine)?|Atlas Obscura)\s+(Magazine\s+)?(sensibility|energy|calm|spirit|judgment|desk)[,.]?/gi,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();

  if (!dek || dek.length < 28) {
    const label = experienceCategoryLabel(item.category).toLowerCase();
    return `A ${label} worth leaving the house for — the kind of place you talk about on the way home.`;
  }

  return dek;
}

function isExperienceItem(d: RankedDiscoveryItem): boolean {
  return EXPERIENCE_CATEGORIES.has(d.item.category);
}

function experienceSortScore(d: RankedDiscoveryItem): number {
  let s = d.score ?? 0;
  if (d.surfaces.includes("hidden_gems")) s += 8;
  if (d.surfaces.includes("weekend_ideas")) s += 6;
  if (d.surfaces.includes("hiking") || d.surfaces.includes("parks")) s += 5;
  if (d.surfaces.includes("beaches") || d.surfaces.includes("museums")) s += 4;
  if (
    ["hiking", "parks", "beaches", "scenic_drives"].includes(d.item.category)
  ) {
    s += 3;
  }
  return s;
}

export function collectExperienceItems(
  discovery: DiscoveryPayload | null | undefined,
  discoveryItems?: RankedDiscoveryItem[] | null
): RankedDiscoveryItem[] {
  const byId = new Map<string, RankedDiscoveryItem>();

  for (const surface of EXPERIENCE_SURFACES) {
    for (const item of discoveryItemsForSurface(discovery, surface)) {
      if (!isExperienceItem(item)) continue;
      if (!byId.has(item.item.id)) byId.set(item.item.id, item);
    }
  }

  for (const item of discoveryItems ?? []) {
    if (!isExperienceItem(item)) continue;
    if (!byId.has(item.item.id)) byId.set(item.item.id, item);
  }

  if (byId.size < 2 && discovery?.surfaces) {
    for (const key of Object.keys(discovery.surfaces) as DiscoverySurface[]) {
      for (const item of discoveryItemsForSurface(discovery, key)) {
        if (!isExperienceItem(item)) continue;
        if (!byId.has(item.item.id)) byId.set(item.item.id, item);
      }
    }
  }

  return [...byId.values()].sort(
    (a, b) => experienceSortScore(b) - experienceSortScore(a)
  );
}

function toCard(
  d: RankedDiscoveryItem,
  city: string | null
): ExperienceCard {
  return {
    id: d.item.id,
    ranked: d,
    category: experienceCategoryLabel(d.item.category),
    headline: d.item.title.trim(),
    dek: inspireExperienceDek(d.item),
    location: experienceLocationLine(d.item, city),
    image: experienceImageFor(d.item.category, d.item.id),
  };
}

/**
 * Featured cinematic lead + stacked stories + optional landscape pair.
 * Mirrors CNT destination-package rhythm on a phone column.
 */
export function selectExperiences(
  discoveryItems: RankedDiscoveryItem[] | null | undefined,
  options?: {
    city?: string | null;
    /** Full-bleed stories under the feature (default 2). */
    maxStories?: number;
    discovery?: DiscoveryPayload | null;
  }
): ExperiencesSelection {
  const maxStories = options?.maxStories ?? 2;
  const city = options?.city ?? null;
  const ranked = collectExperienceItems(options?.discovery, discoveryItems);

  if (!ranked.length) {
    return { featured: null, stories: [], pair: [] };
  }

  const featured = toCard(ranked[0], city);
  const rest = ranked.slice(1);
  const stories = rest.slice(0, maxStories).map((d) => toCard(d, city));
  const pair = rest.slice(maxStories, maxStories + 2).map((d) => toCard(d, city));

  return { featured, stories, pair };
}
