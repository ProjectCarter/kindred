/**
 * Phase 5 — The Editor's Eye (Edition Curation)
 *
 * After every section is assembled, review the finished edition for balance,
 * variety, and reader experience. Diversity is a tie-breaker only — never
 * demote a clearly stronger story.
 *
 * Keep in sync with supabase/functions/_shared/editorial/editionCuration.ts
 */

import type { RankedDiscoveryItem } from "./discovery";
import type { SectionAllocation } from "./sectionAllocator";
import { inferActivitySubtype } from "./activitySubtype";
import { curateFoodDrinkEdition } from "./foodDrinkCuration";
import { resolveVenueClassification } from "./venueClassification";
import {
  HOMEPAGE_INITIAL_RENDER_COUNT,
} from "./editorialPublishing";
import type { LocalEventCard } from "./localEvents";
import {
  selectEditorialHomepageLocalEvents,
  localEventSelectionKey,
  hasHomepageReaderEditorial,
} from "./localEventsHomepage";
import { filterLocalEventsForHomepageCuration } from "./localEventsHomepageEditorial";
import { curateActivitiesForHomepage } from "./activitiesHomepage";
import {
  parseEventStartDate,
  resolveCardHorizon,
} from "./eventHorizon";
import { meetsLocalEventPublishThreshold } from "./editorialPublishing";

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

  clone(): EditionCurationContext {
    const next = new EditionCurationContext();
    for (const [key, value] of this.fingerprintCounts) {
      next.fingerprintCounts.set(key, value);
    }
    for (const [key, value] of this.toneCounts) {
      next.toneCounts.set(key, value);
    }
    return next;
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

const CATEGORY_ID_FINGERPRINT: Partial<
  Record<ReturnType<typeof resolveVenueClassification>["categoryId"], EditionFingerprint>
> = {
  brewery: "brewery_winery_bar",
  winery: "brewery_winery_bar",
  cocktail_bar: "brewery_winery_bar",
  museum: "museum_gallery",
  historic_site: "historic_district",
  botanical_garden: "botanical_garden",
  scenic_lookout: "scenic_overlook",
  observation_deck: "scenic_overlook",
  scenic_drive: "scenic_overlook",
  farmers_market: "farmers_market",
  market: "shopping_market",
  coffee_shop: "coffee_cafe",
  bakery: "restaurant_dining",
  restaurant: "restaurant_dining",
  beach: "beach_water",
  lake: "beach_water",
  river: "beach_water",
  park: "park_outdoors",
  dog_park: "park_outdoors",
  playground: "park_outdoors",
  bookstore: "bookstore_library",
  library: "bookstore_library",
  escape_room: "escape_room_games",
  arcade: "escape_room_games",
  bowling_alley: "bowling_mini_golf",
  mini_golf: "bowling_mini_golf",
  rock_climbing_gym: "sports_fitness",
  kayaking: "water_sports",
  paddleboarding: "water_sports",
  theater: "theater_performance",
  zoo: "museum_gallery",
  aquarium: "museum_gallery",
};

const ACTIVITY_SUBTYPE_FINGERPRINT: Partial<
  Record<ReturnType<typeof inferActivitySubtype>, EditionFingerprint>
> = {
  hiking: "hike_trail",
  water_recreation: "water_sports",
  escape_rooms: "escape_room_games",
  bowling: "bowling_mini_golf",
  mini_golf: "bowling_mini_golf",
  go_karts: "escape_room_games",
  rock_climbing: "sports_fitness",
  axe_throwing: "escape_room_games",
  arcades: "escape_room_games",
};

const LOCAL_EVENT_CATEGORY_FINGERPRINT: Record<
  NonNullable<LocalEventCard["category"]>,
  EditionFingerprint
> = {
  music: "concert_live_music",
  comedy: "theater_performance",
  arts: "artistic_culture",
  family: "festival_community",
  sports: "sports_fitness",
  food: "restaurant_dining",
  market: "farmers_market",
  nightlife: "brewery_winery_bar",
  community: "festival_community",
};

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

  const fromCategory = categoryToFingerprint(item.item.category);
  if (fromCategory) {
    if (item.item.category === "activities" || item.item.category === "hiking") {
      const subtype = inferActivitySubtype(item.item);
      return ACTIVITY_SUBTYPE_FINGERPRINT[subtype] ?? fromCategory;
    }
    return fromCategory;
  }

  const classified = resolveVenueClassification({
    title: item.item.title,
    discoveryCategory: item.item.category,
    venueCategories: item.item.venueCategories,
    tags: item.item.tags,
  });
  return (
    CATEGORY_ID_FINGERPRINT[classified.categoryId] ?? "general_experience"
  );
}

export function inferEditionFingerprintFromLocalEvent(
  event: Pick<LocalEventCard, "name" | "venue" | "category">
): EditionFingerprint {
  const hay = hayFromParts([event.name, event.venue]);
  const fromHay = fingerprintFromHay(hay);
  if (fromHay) return fromHay;
  if (event.category) {
    return LOCAL_EVENT_CATEGORY_FINGERPRINT[event.category];
  }
  return "festival_community";
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

function scoreLocalEventForCuration(
  event: LocalEventCard,
  reference: Date = new Date()
): number {
  if (typeof event.editorialScore === "number" && Number.isFinite(event.editorialScore)) {
    return event.editorialScore;
  }
  const bucket = resolveCardHorizon(event, reference);
  const schedule = `${event.date} ${event.time}`.trim().toLowerCase();
  let score = 0;
  const parsed = parseEventStartDate(schedule, event.startDateIso, reference);
  if (bucket === "today") score += 40;
  else if (bucket === "this_weekend") score += 30;
  else if (bucket === "next_weekend") score += 20;
  else score += 10;
  if (parsed) score += 5;
  if (event.imageUrl) score += 3;
  if (event.banditNote?.trim()) score += 2;
  return score;
}

export function curateLocalEventsForHomepage(
  events: readonly LocalEventCard[],
  context: EditionCurationContext,
  options?: {
    initialRenderCount?: number;
    reference?: Date;
    sportsMarketId?: string | null;
  }
): LocalEventCard[] {
  const initialRenderCount =
    options?.initialRenderCount ?? HOMEPAGE_INITIAL_RENDER_COUNT;
  const reference = options?.reference ?? new Date();
  const sportsMarketId = options?.sportsMarketId ?? null;
  const published = filterLocalEventsForHomepageCuration(
    events.filter(
      (event) =>
        hasHomepageReaderEditorial(event) &&
        meetsLocalEventPublishThreshold(scoreLocalEventForCuration(event, reference))
    )
  );
  if (published.length <= 1) return [...published];

  const { homepage: gridSeed } = selectEditorialHomepageLocalEvents(
    published,
    {
      maxTotal: initialRenderCount,
      reference,
      sportsMarketId,
    }
  );
  const curatedHomepage = curateOrderedList(gridSeed, {
    getScore: (event) => scoreLocalEventForCuration(event, reference),
    getFingerprint: inferEditionFingerprintFromLocalEvent,
    context,
    tieScoreDelta: LOCAL_EVENT_CURATION_TIE_DELTA,
    curateDepth: gridSeed.length,
  });

  return curatedHomepage;
}

export function applyEditionCurationToAllocation(
  allocation: SectionAllocation,
  context: EditionCurationContext,
  options?: { activitiesReaderLocation?: import("./localDiscoveryScope").ReaderLocation | null }
): SectionAllocation {
  const activities = curateActivitiesForHomepage(allocation.activities, {
    readerLocation: options?.activitiesReaderLocation ?? null,
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

  return {
    ...allocation,
    activities,
    notebook,
    recommendations,
  };
}

export function curateHomepageEdition(input: {
  localEvents: readonly LocalEventCard[];
  allocation: SectionAllocation;
  anchors?: EditionCurationAnchors | null;
  initialRenderCount?: number;
  sportsMarketId?: string | null;
  activitiesReaderLocation?: import("./localDiscoveryScope").ReaderLocation | null;
}): {
  localEvents: LocalEventCard[];
  allocation: SectionAllocation;
} {
  const context = new EditionCurationContext();
  context.seed(input.anchors);

  const localEvents = curateLocalEventsForHomepage(input.localEvents, context, {
    initialRenderCount: input.initialRenderCount,
    sportsMarketId: input.sportsMarketId,
  });
  const allocation = applyEditionCurationToAllocation(input.allocation, context, {
    activitiesReaderLocation: input.activitiesReaderLocation ?? null,
  });

  return { localEvents, allocation };
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
