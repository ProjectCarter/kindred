/**
 * Phase 5 — The Editor's Eye (Edition Curation)
 * Server mirror of lib/edition/editionCuration.ts
 */

import type { RankedDiscoveryItem } from "../discovery/types.ts";
import type { SectionAllocation } from "../discovery/sectionAllocation.ts";
import { curateFoodDrinkEdition } from "./foodDrinkCuration.ts";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "../editorial/publishing.ts";

export type EditionTone =
  | "adventurous"
  | "reflective"
  | "historical"
  | "practical"
  | "seasonal"
  | "artistic";

export type EditionFingerprint =
  | "brewery_winery_bar"
  | "hike_trail"
  | "museum_gallery"
  | "scenic_overlook"
  | "farmers_market"
  | "concert_live_music"
  | "coffee_cafe"
  | "restaurant_dining"
  | "botanical_garden"
  | "beach_water"
  | "park_outdoors"
  | "bookstore_library"
  | "escape_room_games"
  | "water_sports"
  | "bowling_mini_golf"
  | "festival_community"
  | "theater_performance"
  | "historic_district"
  | "sports_fitness"
  | "aviation_history"
  | "artistic_culture"
  | "shopping_market"
  | "general_experience";

export const DISCOVERY_CURATION_TIE_DELTA = 4;
export const LOCAL_EVENT_CURATION_TIE_DELTA = 2;
export const MAX_FINGERPRINT_ON_EDITION = 2;

export type EditionCurationAnchor = {
  fingerprint: EditionFingerprint;
  tone?: EditionTone;
};

export type EditionCurationAnchors = {
  banditsPick?: EditionCurationAnchor | null;
  todayInHistory?: EditionCurationAnchor | null;
  heroArt?: EditionCurationAnchor | null;
};

export class EditionCurationContext {
  private fingerprintCounts = new Map<EditionFingerprint, number>();
  private toneCounts = new Map<EditionTone, number>();

  fingerprintCount(fingerprint: EditionFingerprint): number {
    return this.fingerprintCounts.get(fingerprint) ?? 0;
  }

  toneCount(tone: EditionTone): number {
    return this.toneCounts.get(tone) ?? 0;
  }

  record(fingerprint: EditionFingerprint, tone?: EditionTone): void {
    this.fingerprintCounts.set(
      fingerprint,
      (this.fingerprintCounts.get(fingerprint) ?? 0) + 1
    );
    if (tone) {
      this.toneCounts.set(tone, (this.toneCounts.get(tone) ?? 0) + 1);
    }
  }

  seed(anchors: EditionCurationAnchors | null | undefined): void {
    if (!anchors) return;
    for (const anchor of [
      anchors.banditsPick,
      anchors.todayInHistory,
      anchors.heroArt,
    ]) {
      if (!anchor) continue;
      this.record(anchor.fingerprint, anchor.tone);
    }
  }
}

const FINGERPRINT_TONE: Record<EditionFingerprint, EditionTone> = {
  brewery_winery_bar: "seasonal",
  hike_trail: "adventurous",
  museum_gallery: "reflective",
  scenic_overlook: "reflective",
  farmers_market: "seasonal",
  concert_live_music: "artistic",
  coffee_cafe: "practical",
  restaurant_dining: "seasonal",
  botanical_garden: "reflective",
  beach_water: "adventurous",
  park_outdoors: "adventurous",
  bookstore_library: "reflective",
  escape_room_games: "adventurous",
  water_sports: "adventurous",
  bowling_mini_golf: "adventurous",
  festival_community: "seasonal",
  theater_performance: "artistic",
  historic_district: "historical",
  sports_fitness: "adventurous",
  aviation_history: "historical",
  artistic_culture: "artistic",
  shopping_market: "practical",
  general_experience: "practical",
};

function hayFromParts(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function fingerprintFromHay(hay: string): EditionFingerprint | null {
  if (/brewery|brewing|taproom|distillery|winery|cocktail bar|speakeasy/i.test(hay)) {
    return "brewery_winery_bar";
  }
  if (/farmers.? market|farm market|produce market/i.test(hay)) {
    return "farmers_market";
  }
  if (/hiking trail|hike\b|trailhead|summit trail|nature trail/i.test(hay)) {
    return "hike_trail";
  }
  if (/scenic overlook|lookout|viewpoint|observation deck|scenic drive/i.test(hay)) {
    return "scenic_overlook";
  }
  if (/botanical garden|arboretum|conservatory/i.test(hay)) {
    return "botanical_garden";
  }
  if (/historic district|old town|heritage district|preservation district/i.test(hay)) {
    return "historic_district";
  }
  if (/aviation|aircraft|airplane|flight history|wright brothers/i.test(hay)) {
    return "aviation_history";
  }
  if (/museum|gallery|exhibit|zoo|aquarium/i.test(hay)) {
    return "museum_gallery";
  }
  if (/concert|live music|jazz|symphony|orchestra|festival stage/i.test(hay)) {
    return "concert_live_music";
  }
  if (/coffee|espresso|cafe\b|café|roaster/i.test(hay)) {
    return "coffee_cafe";
  }
  if (/restaurant|bistro|diner|eatery|bakery/i.test(hay)) {
    return "restaurant_dining";
  }
  if (/beach|shoreline|coast|paddleboard|kayak|snorkel/i.test(hay)) {
    return hay.includes("kayak") || hay.includes("paddle")
      ? "water_sports"
      : "beach_water";
  }
  if (/state park|national park|dog park|playground|trail park/i.test(hay)) {
    return "park_outdoors";
  }
  if (/bookstore|library|independent books/i.test(hay)) {
    return "bookstore_library";
  }
  if (/escape room|axe throwing|go-kart|mini golf|bowling|arcade|laser tag/i.test(hay)) {
    return /bowling|mini golf|go-kart/i.test(hay)
      ? "bowling_mini_golf"
      : "escape_room_games";
  }
  if (/theater|theatre|playhouse|broadway|performance/i.test(hay)) {
    return "theater_performance";
  }
  if (/farmers|festival|fair\b|parade|street fair/i.test(hay)) {
    return "festival_community";
  }
  if (/marathon|5k|pickleball|fitness|stadium|arena/i.test(hay)) {
    return "sports_fitness";
  }
  if (/art walk|sculpture|mural|impressionist|landscape painting|gallery night/i.test(hay)) {
    return "artistic_culture";
  }
  if (/market district|shopping district|farm stand/i.test(hay)) {
    return "shopping_market";
  }
  return null;
}

function categoryToFingerprint(category: string | null | undefined): EditionFingerprint | null {
  switch (category) {
    case "hiking":
      return "hike_trail";
    case "museums":
      return "museum_gallery";
    case "beaches":
      return "beach_water";
    case "parks":
      return "park_outdoors";
    case "coffee":
      return "coffee_cafe";
    case "restaurants":
    case "bakeries":
      return "restaurant_dining";
    case "gardens":
      return "botanical_garden";
    case "scenic_drives":
      return "scenic_overlook";
    case "activities":
      return "escape_room_games";
    case "books":
      return "bookstore_library";
    case "experiences":
      return "general_experience";
    default:
      return null;
  }
}

export function inferEditionFingerprintFromHay(
  hay: string
): EditionFingerprint {
  return fingerprintFromHay(hay) ?? "general_experience";
}

export function inferEditionFingerprintFromDiscoveryItem(
  item: RankedDiscoveryItem
): EditionFingerprint {
  const hay = hayFromParts([
    item.item.title,
    item.item.dek,
    ...(item.item.venueCategories ?? []),
  ]);
  const fromHay = fingerprintFromHay(hay);
  if (fromHay) return fromHay;
  return categoryToFingerprint(item.item.category) ?? "general_experience";
}

export function inferEditionToneFromFingerprint(
  fingerprint: EditionFingerprint
): EditionTone {
  return FINGERPRINT_TONE[fingerprint];
}

export function inferEditionToneFromHay(hay: string): EditionTone {
  return inferEditionToneFromFingerprint(inferEditionFingerprintFromHay(hay));
}

function diversitySortKey(
  fingerprint: EditionFingerprint,
  tone: EditionTone,
  context: EditionCurationContext
): [number, number, number] {
  const fpCount = context.fingerprintCount(fingerprint);
  const atMax = fpCount >= MAX_FINGERPRINT_ON_EDITION ? 1 : 0;
  const toneCount = context.toneCount(tone);
  return [atMax, fpCount, toneCount];
}

export function curateOrderedList<T>(
  items: readonly T[],
  options: {
    getScore: (item: T) => number;
    getFingerprint: (item: T) => EditionFingerprint;
    getTone?: (item: T) => EditionTone;
    context: EditionCurationContext;
    tieScoreDelta: number;
    curateDepth?: number;
  }
): T[] {
  if (items.length <= 1) return [...items];

  const depth = options.curateDepth ?? HOMEPAGE_INITIAL_RENDER_COUNT;
  const remaining = [...items];
  const curated: T[] = [];

  while (curated.length < depth && remaining.length > 0) {
    const maxScore = Math.max(...remaining.map((item) => options.getScore(item)));
    const band = remaining.filter(
      (item) => options.getScore(item) >= maxScore - options.tieScoreDelta
    );

    const pick = band.slice().sort((a, b) => {
      const fpA = options.getFingerprint(a);
      const fpB = options.getFingerprint(b);
      const toneA = options.getTone?.(a) ?? inferEditionToneFromFingerprint(fpA);
      const toneB = options.getTone?.(b) ?? inferEditionToneFromFingerprint(fpB);
      const keyA = diversitySortKey(fpA, toneA, options.context);
      const keyB = diversitySortKey(fpB, toneB, options.context);
      for (let i = 0; i < keyA.length; i += 1) {
        if (keyA[i] !== keyB[i]) return keyA[i] - keyB[i];
      }
      return options.getScore(b) - options.getScore(a);
    })[0]!;

    curated.push(pick);
    const tone =
      options.getTone?.(pick) ??
      inferEditionToneFromFingerprint(options.getFingerprint(pick));
    options.context.record(options.getFingerprint(pick), tone);
    remaining.splice(remaining.indexOf(pick), 1);
  }

  remaining.sort((a, b) => options.getScore(b) - options.getScore(a));
  return [...curated, ...remaining];
}

export function applyEditionCurationToAllocation(
  allocation: SectionAllocation,
  context: EditionCurationContext
): SectionAllocation {
  const activities = curateOrderedList(allocation.activities, {
    getScore: (item) => item.score,
    getFingerprint: inferEditionFingerprintFromDiscoveryItem,
    context,
    tieScoreDelta: DISCOVERY_CURATION_TIE_DELTA,
  });

  const notebook = curateOrderedList(allocation.notebook, {
    getScore: (item) => item.score,
    getFingerprint: inferEditionFingerprintFromDiscoveryItem,
    context,
    tieScoreDelta: DISCOVERY_CURATION_TIE_DELTA,
  });

  const recommendations = curateFoodDrinkEdition(allocation.recommendations, {
    getScore: (item) => item.score,
  });

  return { activities, notebook, recommendations };
}

export function buildEditionAnchors(input: {
  banditsPickTitle?: string | null;
  banditsPickCategory?: string | null;
  historyHeadline?: string | null;
  heroStyle?: string | null;
}): EditionCurationAnchors {
  const banditsHay = hayFromParts([
    input.banditsPickTitle,
    input.banditsPickCategory,
  ]);
  const historyHay = input.historyHeadline ?? "";
  const heroHay = input.heroStyle ?? "";

  return {
    banditsPick: banditsHay
      ? {
          fingerprint: inferEditionFingerprintFromHay(banditsHay),
          tone: inferEditionToneFromHay(banditsHay),
        }
      : null,
    todayInHistory: historyHay
      ? {
          fingerprint: inferEditionFingerprintFromHay(historyHay),
          tone: inferEditionToneFromHay(historyHay),
        }
      : null,
    heroArt: heroHay
      ? {
          fingerprint: inferEditionFingerprintFromHay(heroHay),
          tone: inferEditionToneFromHay(heroHay),
        }
      : null,
  };
}

export function curateDiscoveryAllocation(
  allocation: SectionAllocation,
  anchors?: EditionCurationAnchors | null
): SectionAllocation {
  const context = new EditionCurationContext();
  context.seed(anchors);
  return applyEditionCurationToAllocation(allocation, context);
}
