/**
 * Edition Health Report — internal QA dashboard (dev builds only).
 * Observes a generated edition; never mutates production logic.
 */

import { banditsPick } from "../edition/bandit";
import { parseDiscoveryPayload, type RankedDiscoveryItem } from "../edition/discovery";
import type { CachedEditionBundle } from "../edition/editionCache";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "../edition/editorialPublishing";
import { extractEventsFromSections } from "../edition/localEventsPipeline";
import {
  getSportsMarketById,
  isHometownTeamEvent,
  resolveSportsMarketId,
} from "../edition/hometownTeams";
import { parseHistoryAroundTownPayload } from "../edition/historyAroundTown/types";
import { inferActivitySubtype } from "../edition/activities";
import { prepareFoodDrinkPool } from "../edition/foodDrinkGuide";
import { selectHomepageRecommendationCards } from "../edition/recommendations";
import { allocateDiscoverySections } from "../edition/sectionAllocator";
import type { KindredPlace } from "../location/types";
import { metroKeyFromPlace } from "../location/metroKey";
import { assessEditionCompleteness } from "../perf/editionCompleteness";
import {
  parseStoryOfSourceNote,
  STORY_OF_SECTION_TYPE,
  LEGACY_YOUR_CITY_SECTION_TYPE,
} from "../edition/storyOf";
import type { DevEditionDiagnostics } from "./editionOverrideTypes";

export type HealthSeverity = "info" | "warning" | "critical";

export type EditionHealthWarning = {
  id: string;
  severity: HealthSeverity;
  message: string;
  sectionId?: EditionHealthSectionId;
};

export type EditionHealthSectionId =
  | "masterpiece"
  | "local_events"
  | "activities"
  | "food_drinks"
  | "story_of"
  | "bandits_pick"
  | "today_in_history"
  | "local_news"
  | "historical_carousel";

export type EditionHealthApiStatus = "ok" | "degraded" | "failed" | "unknown";

export type EditionHealthSectionReport = {
  id: EditionHealthSectionId;
  label: string;
  itemCount: number;
  qualityScore: number;
  warnings: EditionHealthWarning[];
  apiStatus: EditionHealthApiStatus;
  cacheStatus: DevEditionDiagnostics["cacheStatus"];
};

export type EditionGenerationStats = {
  generationTimeMs: number | null;
  apiCallsByProvider: Record<string, EditionHealthApiStatus>;
  cacheStatus: DevEditionDiagnostics["cacheStatus"];
  importedCount: number | null;
  filteredCount: number | null;
  publishedCount: number | null;
  rejectedCount: number | null;
  duplicateMerges: number | null;
  radiusMiles: number;
  localTimeZone: string;
  editionDate: string;
  localDate: string;
  editionGeneratedAt: string | null;
};

export type EditionHealthReport = {
  analyzedAt: string;
  overallScore: number;
  overallGrade: "excellent" | "good" | "fair" | "poor";
  sections: EditionHealthSectionReport[];
  warnings: EditionHealthWarning[];
  stats: EditionGenerationStats;
};

const SECTION_LABELS: Record<EditionHealthSectionId, string> = {
  masterpiece: "Today's Masterpiece",
  local_events: "Local Events",
  activities: "Activities",
  food_drinks: "Food & Drinks",
  story_of: "The Story of Your City",
  bandits_pick: "Bandit's Picks",
  today_in_history: "Today in History",
  local_news: "Local News",
  historical_carousel: "Historical Carousel",
};

const KNOWN_FOOD_CHAINS: readonly string[] = [
  "starbucks", "dunkin", "peet's coffee", "panera", "mcdonald", "burger king",
  "wendy", "taco bell", "chipotle", "subway", "chili", "olive garden",
  "domino", "pizza hut", "kfc", "chick-fil-a", "five guys", "in-n-out",
];

const TARGETS = {
  localEvents: HOMEPAGE_INITIAL_RENDER_COUNT,
  activities: HOMEPAGE_INITIAL_RENDER_COUNT,
  foodDrinks: HOMEPAGE_INITIAL_RENDER_COUNT,
  historyCarousel: 4,
  storyOfWords: 600,
  historyWords: 250,
  masterpieceWords: 600,
  banditsPickWords: 150,
  leadStoryWords: 120,
  slowGenerationMs: 60_000,
  verySlowGenerationMs: 120_000,
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function gradeFromScore(score: number): EditionHealthReport["overallGrade"] {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

function wordCount(text: string | null | undefined): number {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function wordsInParagraphs(paragraphs: string[] | null | undefined): number {
  if (!paragraphs?.length) return 0;
  return paragraphs.reduce((n, p) => n + wordCount(p), 0);
}

function isLikelyChainName(name: string): boolean {
  const hay = name.toLowerCase();
  return KNOWN_FOOD_CHAINS.some((chain) => hay.includes(chain));
}

function normalizeVenueKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function countByKey<T>(
  items: T[],
  keyFn: (item: T) => string | null
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function duplicateEntries(map: Map<string, number>, minCount = 2): Array<[string, number]> {
  return [...map.entries()].filter(([, count]) => count >= minCount);
}

function warn(
  id: string,
  severity: HealthSeverity,
  message: string,
  sectionId?: EditionHealthSectionId
): EditionHealthWarning {
  return { id, severity, message, sectionId };
}

function sectionScore(input: {
  itemCount: number;
  target: number;
  emptyAllowed?: boolean;
  warnings: EditionHealthWarning[];
}): number {
  let score = 100;
  if (input.itemCount === 0 && !input.emptyAllowed) score -= 35;
  else if (input.itemCount < input.target * 0.4) score -= 25;
  else if (input.itemCount < input.target * 0.65) score -= 15;
  else if (input.itemCount < input.target) score -= 8;

  for (const w of input.warnings) {
    if (w.severity === "critical") score -= 14;
    else if (w.severity === "warning") score -= 7;
    else score -= 2;
  }
  return clampScore(score);
}

function inferProviderStatus(
  provider: string,
  apiErrors: string[],
  editorNotes: string[]
): EditionHealthApiStatus {
  const hay = `${provider} ${apiErrors.join(" ")} ${editorNotes.join(" ")}`.toLowerCase();
  if (new RegExp(`${provider}.*fail|fail.*${provider}|${provider}.*error`, "i").test(hay)) {
    return "failed";
  }
  if (new RegExp(`${provider}.*degrad|${provider}.*partial|${provider}.*continuing`, "i").test(hay)) {
    return "degraded";
  }
  if (apiErrors.some((e) => e.toLowerCase().includes(provider))) return "failed";
  if (editorNotes.some((n) => n.toLowerCase().includes(provider))) return "degraded";
  return "unknown";
}

function collectEditorNotes(bundle: CachedEditionBundle): string[] {
  const notes: string[] = [];
  const discovery = parseDiscoveryPayload(bundle.intelligence?.discovery);
  if (discovery?.selectionMeta?.editorNotes?.length) {
    notes.push(...discovery.selectionMeta.editorNotes);
  }
  return notes;
}

function readerLocationFromPlace(place: KindredPlace | null) {
  if (!place) return null;
  return {
    lat: place.lat,
    lon: place.lon,
    city: place.city,
    state: place.state ?? null,
    region: place.region ?? null,
  };
}


function missingImageDiscoveryItems(items: RankedDiscoveryItem[]): number {
  return items.filter((d) => !d.item.editorialImage?.url?.trim()).length;
}

function missingMapDiscoveryItems(items: RankedDiscoveryItem[]): number {
  return items.filter((d) => d.item.lat == null || d.item.lon == null).length;
}

function masterpieceWordCount(
  hero: NonNullable<CachedEditionBundle["morningHero"]>
): number {
  const detailWords =
    hero.detail?.sections?.reduce(
      (n, section) =>
        n + wordCount(section.heading) + wordsInParagraphs(section.paragraphs),
      0
    ) ?? 0;
  if (detailWords > 0) return detailWords;
  return (
    wordCount(hero.aboutArtworkBody) +
    wordsInParagraphs(hero.detail?.longStoryParagraphs ?? null) +
    wordCount(hero.detail?.longStoryBody ?? null)
  );
}

function analyzeMasterpiece(
  bundle: CachedEditionBundle,
  cacheStatus: DevEditionDiagnostics["cacheStatus"],
  apiErrors: string[],
  editorNotes: string[]
): EditionHealthSectionReport {
  const hero = bundle.morningHero ?? bundle.intelligence?.morningHero ?? null;
  const warnings: EditionHealthWarning[] = [];
  const bodyWords = hero ? masterpieceWordCount(hero) : 0;
  const itemCount = hero ? 1 : 0;

  if (!hero) {
    warnings.push(warn("masterpiece_missing", "critical", "Today's Masterpiece missing", "masterpiece"));
  } else {
    if (!hero.imageUrl?.trim() && !hero.hostedUrl?.trim()) {
      warnings.push(warn("masterpiece_image", "warning", "Masterpiece hero image missing", "masterpiece"));
    }
    if (bodyWords < TARGETS.masterpieceWords) {
      warnings.push(
        warn(
          "masterpiece_short",
          "warning",
          `Masterpiece article below target length (${bodyWords} words)`,
          "masterpiece"
        )
      );
    }
    if (!hero.creditLine?.trim() && !hero.attributionText?.trim()) {
      warnings.push(
        warn("masterpiece_attribution", "warning", "Masterpiece source attribution missing", "masterpiece")
      );
    }
  }

  const apiStatus = inferProviderStatus("morning", apiErrors, editorNotes);

  return {
    id: "masterpiece",
    label: SECTION_LABELS.masterpiece,
    itemCount,
    qualityScore: sectionScore({ itemCount, target: 1, warnings }),
    warnings,
    apiStatus,
    cacheStatus,
  };
}

function analyzeLocalEvents(
  bundle: CachedEditionBundle,
  place: KindredPlace | null,
  cacheStatus: DevEditionDiagnostics["cacheStatus"],
  apiErrors: string[],
  editorNotes: string[]
): EditionHealthSectionReport {
  const events = extractEventsFromSections(bundle.sections);
  const warnings: EditionHealthWarning[] = [];
  const sportsMarketId = resolveSportsMarketId({
    city: place?.city,
    state: place?.state,
    region: place?.region,
    metroKey: place ? metroKeyFromPlace(place) : null,
  });

  if (events.length === 0) {
    warnings.push(warn("events_empty", "critical", "Local Events section is empty", "local_events"));
  } else if (events.length < 5) {
    warnings.push(
      warn("events_few", "warning", `Only ${events.length} Local Events found`, "local_events")
    );
  } else if (events.length < TARGETS.localEvents) {
    warnings.push(
      warn(
        "events_below_target",
        "info",
        `${events.length} events — below ${TARGETS.localEvents} homepage target`,
        "local_events"
      )
    );
  }

  const venueDupes = duplicateEntries(
    countByKey(events, (e) => (e.venue?.trim() ? normalizeVenueKey(e.venue) : null))
  );
  for (const [venue, count] of venueDupes.slice(0, 3)) {
    warnings.push(
      warn(
        `event_venue_dupe_${venue}`,
        "warning",
        `${count} events share venue "${venue}"`,
        "local_events"
      )
    );
  }

  const categoryDupes = duplicateEntries(
    countByKey(events, (e) => (e.category ? e.category : null)),
    3
  );
  for (const [category, count] of categoryDupes) {
    warnings.push(
      warn(
        `event_category_dupe_${category}`,
        "warning",
        `${count} ${category} events — variety may be thin`,
        "local_events"
      )
    );
  }

  const missingImages = events.filter((e) => !e.imageUrl?.trim()).length;
  if (missingImages > 0) {
    warnings.push(
      warn(
        "events_missing_images",
        "warning",
        `Event images missing (${missingImages})`,
        "local_events"
      )
    );
  }

  const missingOfficial = events.filter(
    (e) => !e.officialWebsite?.trim() && !e.sourceUrl?.trim()
  ).length;
  if (missingOfficial > 0) {
    warnings.push(
      warn(
        "events_missing_official",
        "info",
        `${missingOfficial} events missing official website`,
        "local_events"
      )
    );
  }

  const missingMaps = events.filter((e) => e.lat == null || e.lon == null).length;
  if (missingMaps > events.length * 0.4 && events.length > 0) {
    warnings.push(
      warn(
        "events_missing_maps",
        "warning",
        `${missingMaps} events missing verified map coordinates`,
        "local_events"
      )
    );
  }

  if (sportsMarketId && getSportsMarketById(sportsMarketId)) {
    const hometownSports = events.filter((e) =>
      isHometownTeamEvent(
        { name: e.name, venue: e.venue, category: e.category ?? null },
        sportsMarketId
      )
    );
    if (hometownSports.length === 0) {
      warnings.push(
        warn(
          "events_no_hometown_sports",
          "warning",
          "No hometown sports surfaced",
          "local_events"
        )
      );
    }
  }

  let apiStatus: EditionHealthApiStatus = "unknown";
  const providers = ["ticketmaster", "eventbrite", "serpapi"];
  const statuses = providers.map((p) => inferProviderStatus(p, apiErrors, editorNotes));
  if (statuses.some((s) => s === "failed")) apiStatus = "failed";
  else if (statuses.some((s) => s === "degraded")) apiStatus = "degraded";
  else if (events.length > 0) apiStatus = "ok";

  return {
    id: "local_events",
    label: SECTION_LABELS.local_events,
    itemCount: events.length,
    qualityScore: sectionScore({ itemCount: events.length, target: TARGETS.localEvents, warnings }),
    warnings,
    apiStatus,
    cacheStatus,
  };
}

function analyzeActivities(
  bundle: CachedEditionBundle,
  place: KindredPlace | null,
  cacheStatus: DevEditionDiagnostics["cacheStatus"],
  apiErrors: string[],
  editorNotes: string[]
): EditionHealthSectionReport {
  const readerLocation = readerLocationFromPlace(place);
  const allocation = allocateDiscoverySections(
    parseDiscoveryPayload(bundle.intelligence?.discovery),
    bundle.intelligence?.discoveryItems,
    { readerLocation }
  );
  const activities = allocation.activities;
  const warnings: EditionHealthWarning[] = [];

  if (activities.length === 0) {
    warnings.push(warn("activities_empty", "critical", "Activities section is empty", "activities"));
  } else if (activities.length < 4) {
    warnings.push(
      warn("activities_few", "warning", `Only ${activities.length} Activities found`, "activities")
    );
  }

  const bowlingDupes = duplicateEntries(
    countByKey(
      activities.filter((a) => inferActivitySubtype(a.item) === "bowling"),
      (a) => normalizeVenueKey(a.item.title)
    )
  );
  for (const [, count] of bowlingDupes) {
    warnings.push(
      warn("activities_bowling_dupe", "warning", `${count} duplicate bowling venues`, "activities")
    );
  }

  const missingImages = missingImageDiscoveryItems(activities);
  if (missingImages > 0) {
    warnings.push(
      warn(
        "activities_missing_images",
        "warning",
        `Activity images missing (${missingImages})`,
        "activities"
      )
    );
  }

  const apiStatus = inferProviderStatus("foursquare", apiErrors, editorNotes);

  return {
    id: "activities",
    label: SECTION_LABELS.activities,
    itemCount: activities.length,
    qualityScore: sectionScore({
      itemCount: activities.length,
      target: TARGETS.activities,
      warnings,
    }),
    warnings,
    apiStatus,
    cacheStatus,
  };
}

function analyzeFoodDrinks(
  bundle: CachedEditionBundle,
  place: KindredPlace | null,
  cacheStatus: DevEditionDiagnostics["cacheStatus"],
  apiErrors: string[],
  editorNotes: string[]
): EditionHealthSectionReport {
  const readerLocation = readerLocationFromPlace(place);
  const allocation = allocateDiscoverySections(
    parseDiscoveryPayload(bundle.intelligence?.discovery),
    bundle.intelligence?.discoveryItems,
    { readerLocation }
  );
  const cards = selectHomepageRecommendationCards(allocation.recommendations, {
    city: place?.city,
    readerLocation,
    editionDate: bundle.editionDate,
  });
  const pool = prepareFoodDrinkPool(allocation.recommendations, { readerLocation });
  const warnings: EditionHealthWarning[] = [];

  if (cards.length === 0) {
    warnings.push(warn("food_empty", "critical", "Food & Drinks section is empty", "food_drinks"));
  } else if (cards.length < 4) {
    warnings.push(
      warn("food_few", "warning", `Only ${cards.length} Food & Drinks picks found`, "food_drinks")
    );
  }

  const chains = pool.filter((d) => isLikelyChainName(d.item.title)).length;
  if (chains >= 3) {
    warnings.push(
      warn("food_many_chains", "warning", `${chains} chain restaurants in pool`, "food_drinks")
    );
  } else if (chains >= 2) {
    warnings.push(
      warn("food_chain_count", "info", `${chains} chain restaurants surfaced`, "food_drinks")
    );
  }

  const missingImages = missingImageDiscoveryItems(pool);
  if (missingImages > 0) {
    warnings.push(
      warn(
        "food_missing_images",
        "warning",
        `Restaurant images missing (${missingImages})`,
        "food_drinks"
      )
    );
  }

  const missingMaps = missingMapDiscoveryItems(pool);
  if (missingMaps > pool.length * 0.35 && pool.length > 0) {
    warnings.push(
      warn(
        "food_missing_maps",
        "warning",
        `${missingMaps} Food & Drinks listings missing map coordinates`,
        "food_drinks"
      )
    );
  }

  const apiStatus = inferProviderStatus("foursquare", apiErrors, editorNotes);

  return {
    id: "food_drinks",
    label: SECTION_LABELS.food_drinks,
    itemCount: cards.length,
    qualityScore: sectionScore({
      itemCount: cards.length,
      target: TARGETS.foodDrinks,
      warnings,
    }),
    warnings,
    apiStatus,
    cacheStatus,
  };
}

function analyzeStoryOf(
  bundle: CachedEditionBundle,
  cacheStatus: DevEditionDiagnostics["cacheStatus"]
): EditionHealthSectionReport {
  const section = bundle.sections.find(
    (s) =>
      s.section_type === STORY_OF_SECTION_TYPE ||
      s.section_type === LEGACY_YOUR_CITY_SECTION_TYPE
  );
  const warnings: EditionHealthWarning[] = [];
  const body = section?.body?.trim() ?? "";
  const words = wordCount(body);
  const sourceNote = parseStoryOfSourceNote(section?.source_note ?? null);
  const itemCount = section && words > 0 ? 1 : 0;

  if (!section || words === 0) {
    warnings.push(
      warn("story_of_missing", "warning", "The Story of Your City is missing", "story_of")
    );
  } else if (words < TARGETS.storyOfWords) {
    warnings.push(
      warn(
        "story_of_short",
        "warning",
        `Story of article below target length (${words} words)`,
        "story_of"
      )
    );
  }

  if (section && !sourceNote?.cityImage?.url?.trim()) {
    warnings.push(
      warn("story_of_image", "warning", "Story of city historical image missing", "story_of")
    );
  }

  if (section && !section.source_note?.trim()) {
    warnings.push(
      warn("story_of_attribution", "info", "Story of source attribution missing", "story_of")
    );
  }

  return {
    id: "story_of",
    label: SECTION_LABELS.story_of,
    itemCount,
    qualityScore: sectionScore({ itemCount, target: 1, emptyAllowed: true, warnings }),
    warnings,
    apiStatus: "unknown",
    cacheStatus,
  };
}

function analyzeBanditsPick(
  bundle: CachedEditionBundle,
  cacheStatus: DevEditionDiagnostics["cacheStatus"]
): EditionHealthSectionReport {
  const pick = banditsPick(bundle.bandit);
  const warnings: EditionHealthWarning[] = [];
  const bodyWords = wordsInParagraphs(pick?.story.body ?? null);
  const itemCount = pick ? 1 : 0;

  if (!pick) {
    warnings.push(warn("bandits_pick_missing", "critical", "Bandit's Pick missing", "bandits_pick"));
  } else {
    if (bodyWords < TARGETS.banditsPickWords) {
      warnings.push(
        warn(
          "bandits_pick_short",
          "warning",
          `Bandit's Pick article below target length (${bodyWords} words)`,
          "bandits_pick"
        )
      );
    }
    if (!pick.story.imageUrl?.trim()) {
      warnings.push(
        warn("bandits_pick_image", "warning", "Bandit's Pick image missing", "bandits_pick")
      );
    }
  }

  return {
    id: "bandits_pick",
    label: SECTION_LABELS.bandits_pick,
    itemCount,
    qualityScore: sectionScore({ itemCount, target: 1, warnings }),
    warnings,
    apiStatus: "unknown",
    cacheStatus,
  };
}

function analyzeTodayInHistory(
  bundle: CachedEditionBundle,
  cacheStatus: DevEditionDiagnostics["cacheStatus"]
): EditionHealthSectionReport {
  const section = bundle.sections.find((s) => s.section_type === "today_in_history");
  const warnings: EditionHealthWarning[] = [];
  const body = section?.body?.trim() ?? "";
  const words = wordCount(body);
  const itemCount = section && words > 0 ? 1 : 0;

  if (!section || words === 0) {
    warnings.push(
      warn("history_missing", "critical", "Today in History section is empty", "today_in_history")
    );
  } else if (words < TARGETS.historyWords) {
    warnings.push(
      warn(
        "history_short",
        "warning",
        `Historical article too short (${words} words)`,
        "today_in_history"
      )
    );
  }

  if (section && !section.source_note?.trim()) {
    warnings.push(
      warn("history_attribution", "info", "Today in History source attribution missing", "today_in_history")
    );
  }

  return {
    id: "today_in_history",
    label: SECTION_LABELS.today_in_history,
    itemCount,
    qualityScore: sectionScore({ itemCount, target: 1, warnings }),
    warnings,
    apiStatus: "unknown",
    cacheStatus,
  };
}

function analyzeLocalNews(
  bundle: CachedEditionBundle,
  cacheStatus: DevEditionDiagnostics["cacheStatus"],
  editorNotes: string[]
): EditionHealthSectionReport {
  const lead = bundle.leadStory;
  const topStories = bundle.topStories ?? [];
  const itemCount = (lead?.headline?.trim() ? 1 : 0) + topStories.length;
  const warnings: EditionHealthWarning[] = [];

  if (!lead?.headline?.trim()) {
    warnings.push(warn("news_no_lead", "critical", "Lead story missing", "local_news"));
  } else {
    const leadWords =
      wordsInParagraphs(lead.body ?? null) + wordCount(lead.summary);
    if (leadWords < TARGETS.leadStoryWords) {
      warnings.push(
        warn("news_lead_short", "info", `Lead story summary is thin (${leadWords} words)`, "local_news")
      );
    }
    if (lead.selection?.strategy === "fallback") {
      warnings.push(warn("news_fallback", "warning", "News fallback used", "local_news"));
    }
    if (!lead.heroImage?.uri?.trim()) {
      warnings.push(warn("news_lead_image", "warning", "Lead story image missing", "local_news"));
    }
  }

  if (topStories.length === 0) {
    warnings.push(warn("news_no_top", "warning", "No top stories on the front page", "local_news"));
  }

  const notesHay = editorNotes.join(" ").toLowerCase();
  if (/wire.*fail|news.*fail|story editor.*fail/i.test(notesHay)) {
    warnings.push(warn("news_api_fail", "warning", "News pipeline reported failures", "local_news"));
  }

  let apiStatus: EditionHealthApiStatus = "unknown";
  if (lead?.selection?.strategy === "fallback") apiStatus = "degraded";
  else if (lead?.headline?.trim()) apiStatus = "ok";

  return {
    id: "local_news",
    label: SECTION_LABELS.local_news,
    itemCount,
    qualityScore: sectionScore({ itemCount, target: 4, warnings }),
    warnings,
    apiStatus,
    cacheStatus,
  };
}

function resolveHistoryAroundTown(bundle: CachedEditionBundle) {
  const fromIntelligence = bundle.intelligence?.historyAroundTown ?? null;
  if (fromIntelligence?.carousel?.length) return fromIntelligence;

  const section = bundle.sections.find((s) => s.section_type === "history_around_town");
  if (!section?.body?.trim()) return null;
  try {
    return parseHistoryAroundTownPayload(JSON.parse(section.body));
  } catch {
    return null;
  }
}

function analyzeHistoricalCarousel(
  bundle: CachedEditionBundle,
  cacheStatus: DevEditionDiagnostics["cacheStatus"]
): EditionHealthSectionReport {
  const parsed = resolveHistoryAroundTown(bundle);
  const carousel = parsed?.carousel ?? [];
  const warnings: EditionHealthWarning[] = [];

  if (carousel.length === 0) {
    warnings.push(
      warn(
        "history_carousel_empty",
        "warning",
        "Historical Carousel is empty",
        "historical_carousel"
      )
    );
  } else if (carousel.length < TARGETS.historyCarousel) {
    warnings.push(
      warn(
        "history_carousel_few",
        "info",
        `Only ${carousel.length} History Around Town cards`,
        "historical_carousel"
      )
    );
  }

  const missingImages = carousel.filter((p) => !p.heroImageUrl?.trim()).length;
  if (missingImages > 0) {
    warnings.push(
      warn(
        "history_carousel_images",
        "warning",
        `Historical carousel images missing (${missingImages})`,
        "historical_carousel"
      )
    );
  }

  const shortStories = carousel.filter(
    (p) =>
      wordCount(p.teaser) + wordsInParagraphs(p.theStory ?? null) < 80
  ).length;
  if (shortStories > 0) {
    warnings.push(
      warn(
        "history_carousel_short",
        "info",
        `${shortStories} historical cards have thin copy`,
        "historical_carousel"
      )
    );
  }

  return {
    id: "historical_carousel",
    label: SECTION_LABELS.historical_carousel,
    itemCount: carousel.length,
    qualityScore: sectionScore({
      itemCount: carousel.length,
      target: TARGETS.historyCarousel,
      emptyAllowed: true,
      warnings,
    }),
    warnings,
    apiStatus: carousel.length > 0 ? "ok" : "unknown",
    cacheStatus,
  };
}

function buildGenerationStats(
  bundle: CachedEditionBundle,
  diagnostics: DevEditionDiagnostics,
  apiErrors: string[],
  editorNotes: string[],
  globalWarnings: EditionHealthWarning[]
): EditionGenerationStats {
  const discovery = parseDiscoveryPayload(bundle.intelligence?.discovery);
  const candidateCount = discovery?.selectionMeta?.candidateCount ?? null;
  const selectedCount = discovery?.selectionMeta?.selectedCount ?? null;
  const enrichQueue = discovery?.selectionMeta?.enrichQueue?.length ?? null;

  let filteredCount: number | null = null;
  if (candidateCount != null && selectedCount != null) {
    filteredCount = Math.max(0, candidateCount - selectedCount);
  }

  let rejectedCount: number | null = null;
  if (candidateCount != null && selectedCount != null && enrichQueue != null) {
    rejectedCount = Math.max(0, candidateCount - selectedCount - enrichQueue);
  }

  const duplicateMerges = parseIntFromNotes(editorNotes, /(\d+)\s+duplicate/i);

  const providers = ["ticketmaster", "eventbrite", "foursquare", "serpapi", "morning"];
  const apiCallsByProvider: Record<string, EditionHealthApiStatus> = {};
  for (const provider of providers) {
    apiCallsByProvider[provider] = inferProviderStatus(provider, apiErrors, editorNotes);
  }

  if (diagnostics.generationTimeMs != null) {
    if (diagnostics.generationTimeMs >= TARGETS.verySlowGenerationMs) {
      globalWarnings.push(
        warn(
          "generation_very_slow",
          "critical",
          `Very slow generation (${Math.round(diagnostics.generationTimeMs / 1000)}s)`
        )
      );
    } else if (diagnostics.generationTimeMs >= TARGETS.slowGenerationMs) {
      globalWarnings.push(
        warn(
          "generation_slow",
          "warning",
          `Slow generation (${Math.round(diagnostics.generationTimeMs / 1000)}s)`
        )
      );
    }
  }

  if (apiErrors.length > 0) {
    globalWarnings.push(
      warn("api_errors", "warning", `${apiErrors.length} API error(s) during generation`)
    );
  }

  if (diagnostics.cacheStatus === "network") {
    globalWarnings.push(warn("cache_miss", "info", "Edition loaded from network (cache miss)"));
  }

  const completeness = assessEditionCompleteness({
    sections: bundle.sections,
    intelligence: bundle.intelligence,
    bandit: bundle.bandit,
    leadStory: bundle.leadStory,
    expectStoryOf: true,
  });
  for (const missing of completeness.missing) {
    globalWarnings.push(
      warn(`completeness_${missing}`, "warning", `Edition completeness: missing ${missing}`)
    );
  }

  return {
    generationTimeMs: diagnostics.generationTimeMs,
    apiCallsByProvider,
    cacheStatus: diagnostics.cacheStatus,
    importedCount: candidateCount,
    filteredCount,
    publishedCount: selectedCount,
    rejectedCount,
    duplicateMerges,
    radiusMiles: diagnostics.radiusMiles,
    localTimeZone: diagnostics.timeZone,
    editionDate: diagnostics.editionDate,
    localDate: diagnostics.localDate,
    editionGeneratedAt: diagnostics.editionGeneratedAt,
  };
}

function parseIntFromNotes(notes: string[], pattern: RegExp): number | null {
  for (const note of notes) {
    const match = note.match(pattern);
    if (match?.[1]) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function buildEditionHealthReport(input: {
  bundle: CachedEditionBundle;
  diagnostics: DevEditionDiagnostics;
  place: KindredPlace | null;
}): EditionHealthReport {
  const { bundle, diagnostics, place } = input;
  const apiErrors = diagnostics.apiErrors ?? [];
  const editorNotes = collectEditorNotes(bundle);
  const cacheStatus = diagnostics.cacheStatus;
  const globalWarnings: EditionHealthWarning[] = [];

  const rawSections: EditionHealthSectionReport[] = [
    analyzeMasterpiece(bundle, cacheStatus, apiErrors, editorNotes),
    analyzeLocalEvents(bundle, place, cacheStatus, apiErrors, editorNotes),
    analyzeActivities(bundle, place, cacheStatus, apiErrors, editorNotes),
    analyzeFoodDrinks(bundle, place, cacheStatus, apiErrors, editorNotes),
    analyzeStoryOf(bundle, cacheStatus),
    analyzeBanditsPick(bundle, cacheStatus),
    analyzeTodayInHistory(bundle, cacheStatus),
    analyzeLocalNews(bundle, cacheStatus, editorNotes),
    analyzeHistoricalCarousel(bundle, cacheStatus),
  ];
  const sections = rawSections.map((section) => ({
    ...section,
    warnings: dedupeSectionWarnings(section.id, section.warnings),
  }));

  const stats = buildGenerationStats(
    bundle,
    diagnostics,
    apiErrors,
    editorNotes,
    globalWarnings
  );

  const warnings = dedupeWarnings([
    ...globalWarnings,
    ...sections.flatMap((s) => s.warnings),
  ]);

  const overallScore = clampScore(
    sections.reduce((sum, s) => sum + s.qualityScore, 0) / sections.length
  );

  return {
    analyzedAt: new Date().toISOString(),
    overallScore,
    overallGrade: gradeFromScore(overallScore),
    sections,
    warnings,
    stats,
  };
}

function dedupeSectionWarnings(
  sectionId: string,
  warnings: EditionHealthWarning[]
): EditionHealthWarning[] {
  const seen = new Set<string>();
  const out: EditionHealthWarning[] = [];
  for (const w of warnings) {
    const key = `${sectionId}:${w.id}:${w.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

function dedupeWarnings(warnings: EditionHealthWarning[]): EditionHealthWarning[] {
  const seen = new Set<string>();
  const out: EditionHealthWarning[] = [];
  for (const w of warnings) {
    const key = `${w.id}:${w.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export function healthScoreEmoji(score: number): string {
  if (score >= 80) return "🟢";
  if (score >= 60) return "🟡";
  return "🔴";
}

export function healthApiStatusLabel(status: EditionHealthApiStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "degraded":
      return "Degraded";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

export function compareEditionHealthReports(
  current: EditionHealthReport,
  previous: EditionHealthReport
): {
  overallDelta: number;
  sectionDeltas: Array<{ id: EditionHealthSectionId; label: string; delta: number }>;
  newWarnings: string[];
  resolvedWarnings: string[];
} {
  const previousWarningIds = new Set(previous.warnings.map((w) => w.id));
  const currentWarningIds = new Set(current.warnings.map((w) => w.id));

  return {
    overallDelta: current.overallScore - previous.overallScore,
    sectionDeltas: current.sections.map((section) => {
      const prev = previous.sections.find((s) => s.id === section.id);
      return {
        id: section.id,
        label: section.label,
        delta: section.qualityScore - (prev?.qualityScore ?? 0),
      };
    }),
    newWarnings: current.warnings
      .filter((w) => !previousWarningIds.has(w.id))
      .map((w) => w.message),
    resolvedWarnings: previous.warnings
      .filter((w) => !currentWarningIds.has(w.id))
      .map((w) => w.message),
  };
}

export function serializeEditionHealthExport(input: {
  label: string;
  place: KindredPlace;
  editionDate: string;
  diagnostics: DevEditionDiagnostics;
  health: EditionHealthReport;
}): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      label: input.label,
      place: input.place,
      editionDate: input.editionDate,
      diagnostics: input.diagnostics,
      health: input.health,
    },
    null,
    2
  );
}
