/**
 * Edition Quality Engine V1 — objective editorial quality scoring.
 * Evaluates completed editions after generation, before publication.
 * Non-blocking: append-only diagnostics; never gates publish.
 */

import { citiesMatch } from "../location/locationKey.ts";
import { haversineKm, milesToKm } from "../markets/geo.ts";
import { KINDRED_LOCAL_RADIUS_MILES } from "./editorialStandard.ts";
import {
  extractNationalFingerprint,
  type NationalFingerprint,
} from "./nationwideAudit.ts";
import { localLeadAgeBand } from "./localNewsFreshness.ts";
import type { EditionSection } from "./types.ts";
import type { LeadStory } from "./LeadStory.ts";
import type { NationalNewsPackage } from "./nationalNewsTypes.ts";
import type { MorningHeroExperience } from "./heroArtwork/types.ts";

const PLACEHOLDER_COPY_PATTERNS: RegExp[] = [
  /editorial quality worthy of a magazine desk/i,
  /matches what you tend to care about/i,
  /hand-selected for today'?s paper/i,
  /magazine desk energy/i,
];

function isPlaceholderCopy(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  if (text.trim().length < 12) return true;
  return PLACEHOLDER_COPY_PATTERNS.some((re) => re.test(text));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasSubstance(text: string | null | undefined, minWords = 18): boolean {
  if (!text?.trim()) return false;
  if (isPlaceholderCopy(text)) return false;
  return wordCount(text) >= minWords;
}

function normalizeProseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type QualityDiscoveryItem = {
  id?: string;
  title?: string;
  dek?: string;
  category?: string;
  url?: string | null;
  officialWebsite?: string | null;
  lat?: number | null;
  lon?: number | null;
  place?: { city?: string | null; state?: string | null; region?: string | null } | null;
  source?: { url?: string | null; name?: string };
  editorialImage?: {
    url?: string;
    orientation?: "portrait" | "landscape" | "square";
  } | null;
};

function parseDiscoverySurfaces(discovery: unknown): Record<string, { items?: QualityDiscoveryItem[] }> {
  if (!discovery || typeof discovery !== "object") return {};
  const surfaces = (discovery as { surfaces?: Record<string, { items?: QualityDiscoveryItem[] }> }).surfaces;
  return surfaces && typeof surfaces === "object" ? surfaces : {};
}

export const EDITION_QUALITY_VERSION = 1 as const;

export type EditionQualityCategory =
  | "editorial_completeness"
  | "image_quality"
  | "local_relevance"
  | "national_consistency"
  | "freshness"
  | "user_experience";

export type EditionQualityTier =
  | "excellent"
  | "very_good"
  | "good"
  | "needs_improvement"
  | "review_recommended";

export type QualityFindingSeverity = "high" | "medium" | "low";

export type QualityFinding = {
  category: EditionQualityCategory;
  severity: QualityFindingSeverity;
  code: string;
  section?: string;
  message: string;
};

export type EditionQualityLocation = {
  city: string;
  state: string | null;
  region: string | null;
  lat: number;
  lon: number;
  metroKey: string;
  catalogMetroKey?: string;
};

export type EditionQualityInput = {
  editionId: string;
  metroKey: string;
  editionDate: string;
  location: EditionQualityLocation;
  sections: EditionSection[];
  leadStory: LeadStory | null;
  nationalNews: NationalNewsPackage | null;
  bandit: unknown;
  discovery: unknown;
  morningHero: MorningHeroExperience | null;
  usNationalDailyId: string | null;
  editorialContext: unknown;
  historyAroundTown: unknown;
  expectStoryOf?: boolean;
  nationalReference?: NationalFingerprint | null;
  traceId?: string | null;
  now?: Date;
};

export type EditionQualityReport = {
  version: typeof EDITION_QUALITY_VERSION;
  recordedAt: string;
  editionId: string;
  metroKey: string;
  editionDate: string;
  traceId: string | null;
  overallScore: number;
  tier: EditionQualityTier;
  categoryScores: Record<EditionQualityCategory, number>;
  sectionScores: Record<string, number>;
  missingContentReport: QualityFinding[];
  duplicateReport: QualityFinding[];
  imageReport: QualityFinding[];
  freshnessReport: QualityFinding[];
  localRelevanceReport: QualityFinding[];
  suggestedImprovements: string[];
  durationMs: number;
  blocksPublication: false;
};

export type EditionQualityState = {
  version: typeof EDITION_QUALITY_VERSION;
  reports: EditionQualityReport[];
  latest: EditionQualityReport | null;
};

const CATEGORY_WEIGHTS: Record<EditionQualityCategory, number> = {
  editorial_completeness: 0.2,
  image_quality: 0.15,
  local_relevance: 0.2,
  national_consistency: 0.15,
  freshness: 0.15,
  user_experience: 0.15,
};

const PLACEHOLDER_IMAGE_PATTERNS: RegExp[] = [
  /placeholder/i,
  /via\.placeholder\.com/i,
  /picsum\.photos/i,
  /dummyimage\.com/i,
  /placehold\.co/i,
];

const BROKEN_IMAGE_PATTERNS: RegExp[] = [
  /^$/,
  /^null$/i,
  /^undefined$/i,
  /^#$/,
  /^about:blank$/i,
];

const FOOD_SURFACE_KEYS = /restaurants|coffee|bakeries|breweries|wineries|food/i;
const ACTIVITY_SURFACE_KEYS =
  /activities|museums|parks|beaches|hiking|hidden_gems|escape|bowling|mini_golf/i;

const HOMEPAGE_SECTIONS = [
  "greeting",
  "weather",
  "local_events",
  "local_news",
  "national_news",
  "story_of",
  "today_in_history",
] as const;

function qf(
  category: EditionQualityCategory,
  severity: QualityFindingSeverity,
  code: string,
  message: string,
  section?: string
): QualityFinding {
  return { category, severity, code, message, section };
}

export function emptyEditionQualityState(): EditionQualityState {
  return { version: EDITION_QUALITY_VERSION, reports: [], latest: null };
}

export function readEditionQualityFromBuildState(
  buildState: Record<string, unknown> | null | undefined
): EditionQualityState | null {
  const raw = buildState?.editionQuality;
  if (!raw || typeof raw !== "object") return null;
  return raw as EditionQualityState;
}

export function mergeEditionQualityIntoBuildState(
  buildState: Record<string, unknown> | null | undefined,
  quality: EditionQualityState
): Record<string, unknown> {
  return { ...(buildState ?? {}), editionQuality: quality };
}

export function appendEditionQualityReport(
  state: EditionQualityState | null | undefined,
  report: EditionQualityReport
): EditionQualityState {
  const base = state ?? emptyEditionQualityState();
  return { ...base, reports: [...base.reports, report], latest: report };
}

export function scoreQualityTier(score: number): EditionQualityTier {
  if (score >= 95) return "excellent";
  if (score >= 90) return "very_good";
  if (score >= 80) return "good";
  if (score >= 70) return "needs_improvement";
  return "review_recommended";
}

export function scoreCategoryFindings(findings: QualityFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "high") score -= 8;
    else if (f.severity === "medium") score -= 4;
    else score -= 2;
  }
  return Math.max(0, Math.min(100, score));
}

export function computeOverallQualityScore(
  categoryScores: Record<EditionQualityCategory, number>
): number {
  let weighted = 0;
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    weighted += (categoryScores[category as EditionQualityCategory] ?? 0) * weight;
  }
  return Math.round(Math.max(0, Math.min(100, weighted)));
}

function parseLocalEvents(sections: EditionSection[]) {
  const row = sections.find((s) => s.section_type === "local_events");
  if (!row?.body) return [];
  try {
    const parsed = JSON.parse(row.body) as { events?: unknown[] };
    return Array.isArray(parsed.events)
      ? (parsed.events as Array<{
          name?: string;
          city?: string;
          venue?: string;
          startDate?: string;
          lat?: number;
          lon?: number;
        }>)
      : [];
  } catch {
    return [];
  }
}

function discoverySurfaces(discovery: unknown) {
  return parseDiscoverySurfaces(discovery);
}

function discoveryItemsForPattern(
  discovery: unknown,
  surfacePattern: RegExp
): QualityDiscoveryItem[] {
  const surfaces = discoverySurfaces(discovery);
  const items: QualityDiscoveryItem[] = [];
  for (const [key, surface] of Object.entries(surfaces)) {
    if (!surfacePattern.test(key)) continue;
    for (const item of surface?.items ?? []) {
      if (item && typeof item === "object") items.push(item);
    }
  }
  return items;
}

function allDiscoveryItems(discovery: unknown): QualityDiscoveryItem[] {
  const surfaces = discoverySurfaces(discovery);
  const items: QualityDiscoveryItem[] = [];
  for (const surface of Object.values(surfaces)) {
    for (const item of surface?.items ?? []) {
      if (item && typeof item === "object") items.push(item);
    }
  }
  return items;
}

function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function collectImageUris(input: EditionQualityInput): Array<{ uri: string; context: string }> {
  const uris: Array<{ uri: string; context: string }> = [];
  const push = (uri: string | null | undefined, context: string) => {
    if (uri?.trim()) uris.push({ uri: uri.trim(), context });
  };

  push(input.morningHero?.hostedUrl ?? input.morningHero?.imageUrl, "masterpiece");
  push(input.leadStory?.heroImage?.uri, "local_news");

  for (const story of input.nationalNews?.stories ?? []) {
    push(story.image?.url, `national_news:${story.id ?? story.headline}`);
  }

  const history = input.sections.find((s) => s.section_type === "today_in_history");
  if (history?.body) {
    try {
      const parsed = JSON.parse(history.body) as {
        imageUrl?: string;
        heroImage?: { uri?: string };
      };
      push(parsed.heroImage?.uri, "today_in_history");
      push(parsed.imageUrl, "today_in_history");
    } catch {
      /* prose-only */
    }
  }

  for (const item of allDiscoveryItems(input.discovery)) {
    push(item.editorialImage?.url, `discovery:${item.title}`);
  }

  return uris;
}

function checkEditorialCompleteness(input: EditionQualityInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const cat = "editorial_completeness" as const;
  const sectionTypes = new Set(input.sections.map((s) => s.section_type));

  for (const required of HOMEPAGE_SECTIONS) {
    if (required === "story_of" && input.expectStoryOf === false) continue;
    if (!sectionTypes.has(required)) {
      findings.push(
        qf(cat, "high", "missing_section", `Missing section: ${required}`, required)
      );
    }
  }

  if (!input.leadStory?.headline?.trim()) {
    findings.push(qf(cat, "high", "missing_lead_headline", "Local News lead missing headline", "local_news"));
  } else if (!hasSubstance(input.leadStory.summary ?? input.leadStory.dek, 20)) {
    findings.push(qf(cat, "medium", "thin_local_news", "Local News summary lacks depth", "local_news"));
  }

  if (!input.nationalNews?.stories?.length) {
    findings.push(qf(cat, "high", "missing_national_news", "National News package empty", "national_news"));
  }

  const activities = discoveryItemsForPattern(input.discovery, ACTIVITY_SURFACE_KEYS);
  if (activities.length === 0) {
    findings.push(qf(cat, "high", "missing_activities", "No activities in discovery", "activities"));
  }

  const food = discoveryItemsForPattern(input.discovery, FOOD_SURFACE_KEYS);
  if (food.length === 0) {
    findings.push(qf(cat, "high", "missing_food_drinks", "No Food & Drinks in discovery", "food_drinks"));
  }

  for (const section of input.sections) {
    if (!section.headline?.trim() && !section.body?.trim()) {
      findings.push(
        qf(cat, "high", "blank_section", `Blank section: ${section.section_type}`, section.section_type)
      );
    }
    if (section.body && isPlaceholderCopy(section.body)) {
      findings.push(
        qf(cat, "medium", "placeholder_copy", `Placeholder copy in ${section.section_type}`, section.section_type)
      );
    }
    if (
      ["story_of", "today_in_history", "local_news"].includes(section.section_type) &&
      section.body &&
      !hasSubstance(section.body, 18)
    ) {
      findings.push(
        qf(cat, "medium", "thin_body", `Thin editorial body in ${section.section_type}`, section.section_type)
      );
    }
  }

  return findings;
}

function checkImageQuality(input: EditionQualityInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const cat = "image_quality" as const;
  const uris = collectImageUris(input);
  const seen = new Map<string, string>();

  if (uris.length === 0) {
    findings.push(qf(cat, "medium", "no_images", "No editorial images found in edition"));
  }

  for (const { uri, context } of uris) {
    if (BROKEN_IMAGE_PATTERNS.some((re) => re.test(uri))) {
      findings.push(qf(cat, "high", "broken_image", `Broken image URI in ${context}`, "images"));
    }
    if (PLACEHOLDER_IMAGE_PATTERNS.some((re) => re.test(uri))) {
      findings.push(qf(cat, "high", "placeholder_image", `Placeholder image in ${context}`, "images"));
    }
    const prev = seen.get(uri);
    if (prev && prev !== context) {
      findings.push(
        qf(cat, "medium", "duplicate_image", `Same image in ${prev} and ${context}`, "images")
      );
    }
    seen.set(uri, context);
  }

  for (const item of allDiscoveryItems(input.discovery)) {
    if (!item.editorialImage?.url && item.title?.trim()) {
      findings.push(
        qf(cat, "low", "missing_item_image", `No image for discovery item: ${item.title}`, "images")
      );
    }
    const orientation = item.editorialImage?.orientation;
    if (orientation && !["portrait", "landscape", "square"].includes(orientation)) {
      findings.push(
        qf(cat, "low", "invalid_orientation", `Invalid image orientation for ${item.title}`, "images")
      );
    }
  }

  return findings;
}

function checkLocalRelevance(input: EditionQualityInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const cat = "local_relevance" as const;
  const { location } = input;
  const radiusKm = milesToKm(KINDRED_LOCAL_RADIUS_MILES);

  if (input.leadStory?.headline && input.location.state) {
    const statePattern = new RegExp(`\\b${input.location.state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const leadText = `${input.leadStory.headline} ${input.leadStory.summary ?? ""}`;
    if (!statePattern.test(leadText) && !citiesMatch(leadText, input.location.city)) {
      findings.push(
        qf(cat, "low", "local_news_geo_hint_missing", `Local News may lack ${input.location.city}/${input.location.state} context`, "local_news")
      );
    }
  }

  for (const ev of parseLocalEvents(input.sections)) {
    if (ev.city && !citiesMatch(ev.city, location.city)) {
      findings.push(
        qf(cat, "medium", "event_city_mismatch", `Event "${ev.name}" city ${ev.city} may not match ${location.city}`, "local_events")
      );
    }
    if (ev.lat != null && ev.lon != null && Number.isFinite(ev.lat) && Number.isFinite(ev.lon)) {
      const km = haversineKm(location.lat, location.lon, ev.lat, ev.lon);
      if (km > radiusKm) {
        findings.push(
          qf(cat, "high", "event_out_of_radius", `Event "${ev.name}" is ${Math.round(km)}km away (limit ${KINDRED_LOCAL_RADIUS_MILES}mi)`, "local_events")
        );
      }
    }
  }

  for (const item of [
    ...discoveryItemsForPattern(input.discovery, ACTIVITY_SURFACE_KEYS),
    ...discoveryItemsForPattern(input.discovery, FOOD_SURFACE_KEYS),
  ]) {
    const itemCity = item.place?.city;
    if (itemCity && !citiesMatch(itemCity, location.city)) {
      findings.push(
        qf(cat, "medium", "discovery_city_mismatch", `"${item.title}" city ${itemCity} ≠ ${location.city}`, item.category)
      );
    }
  }

  const storyOf = input.sections.find((s) => s.section_type === "story_of");
  if (storyOf?.body && location.city) {
    const cityPattern = new RegExp(location.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (!cityPattern.test(storyOf.body) && !cityPattern.test(storyOf.headline ?? "")) {
      findings.push(
        qf(cat, "medium", "story_of_city_missing", `Story of Your City may not reference ${location.city}`, "story_of")
      );
    }
  }

  return findings;
}

function checkNationalConsistency(input: EditionQualityInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const cat = "national_consistency" as const;

  if (!input.usNationalDailyId?.trim()) {
    findings.push(qf(cat, "high", "missing_national_daily_id", "Missing us_national_daily_id", "national_news"));
  }

  if (!input.morningHero?.artworkId?.trim()) {
    findings.push(qf(cat, "medium", "missing_masterpiece", "Today's Masterpiece not attached", "masterpiece"));
  }

  const history = input.sections.find((s) => s.section_type === "today_in_history");
  if (!history?.body?.trim()) {
    findings.push(qf(cat, "medium", "missing_today_in_history", "Today in History section empty", "today_in_history"));
  }

  if (input.nationalReference) {
    const local = extractNationalFingerprint(
      {
        us_national_daily_id: input.usNationalDailyId,
        morning_edition: input.morningHero ? { morningHero: input.morningHero } : null,
        national_news: input.nationalNews,
        lead_story: input.leadStory,
      },
      input.sections.map((s) => ({
        section_type: s.section_type,
        headline: s.headline,
        body: s.body,
      }))
    );
    const ref = input.nationalReference;
    if (ref.usNationalDailyId && local.usNationalDailyId !== ref.usNationalDailyId) {
      findings.push(qf(cat, "high", "national_daily_mismatch", "National daily ID differs from reference", "national_news"));
    }
    if (ref.masterpieceArtworkId && local.masterpieceArtworkId !== ref.masterpieceArtworkId) {
      findings.push(qf(cat, "high", "masterpiece_mismatch", "Masterpiece differs from national reference", "masterpiece"));
    }
    if (ref.historyHeadline && local.historyHeadline !== ref.historyHeadline) {
      findings.push(qf(cat, "high", "history_mismatch", "Today in History differs from national reference", "today_in_history"));
    }
    if (
      ref.nationalNewsStoryIds.length &&
      local.nationalNewsStoryIds.join("|") !== ref.nationalNewsStoryIds.join("|")
    ) {
      findings.push(qf(cat, "high", "national_news_mismatch", "National News story set differs from reference", "national_news"));
    }
  }

  return findings;
}

function checkFreshness(input: EditionQualityInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const cat = "freshness" as const;
  const now = input.now ?? new Date();
  const refDate = new Date(`${input.editionDate}T12:00:00`);

  for (const ev of parseLocalEvents(input.sections)) {
    if (!ev.startDate) continue;
    const start = new Date(ev.startDate);
    if (!Number.isNaN(start.getTime()) && start < new Date(refDate.getTime() - 86400000)) {
      findings.push(
        qf(cat, "high", "expired_event", `Expired event: ${ev.name} (${ev.startDate})`, "local_events")
      );
    }
  }

  const leadAge = localLeadAgeBand(input.leadStory?.publishedAt ?? null, now);
  if (leadAge === "stale") {
    findings.push(qf(cat, "high", "stale_local_news", "Local News lead is older than freshness window", "local_news"));
  } else if (leadAge === "unknown") {
    findings.push(qf(cat, "low", "unknown_news_age", "Local News publish date unknown", "local_news"));
  }

  const weather = input.sections.find((s) => s.section_type === "weather");
  if (weather?.body && isPlaceholderCopy(weather.body)) {
    findings.push(qf(cat, "medium", "stale_weather", "Weather section may be stale or placeholder", "weather"));
  }

  const editionDay = input.editionDate.slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  if (editionDay < today) {
    findings.push(
      qf(cat, "medium", "stale_edition_date", `Edition date ${editionDay} is before today ${today}`, "general")
    );
  }

  return findings;
}

function checkUserExperience(input: EditionQualityInput): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const cat = "user_experience" as const;
  const titles = new Map<string, string>();

  for (const item of allDiscoveryItems(input.discovery)) {
    const title = item.title?.trim();
    if (!title) {
      findings.push(qf(cat, "medium", "empty_card_title", "Discovery card missing title"));
      continue;
    }
    if (!item.dek?.trim() && wordCount(title) < 3) {
      findings.push(qf(cat, "low", "empty_description", `Thin description for "${title}"`));
    }

    const key = normalizeProseKey(title);
    const prev = titles.get(key);
    if (prev && prev !== item.category) {
      findings.push(qf(cat, "medium", "duplicate_card", `Duplicate card across surfaces: ${title}`, item.category));
    }
    titles.set(key, item.category);

    const url = item.url ?? item.officialWebsite ?? item.source?.url;
    if (url && !isValidHttpUrl(url)) {
      findings.push(qf(cat, "high", "malformed_url", `Malformed URL for "${title}"`, item.category));
    }

    if (item.lat != null && (item.lat < -90 || item.lat > 90)) {
      findings.push(qf(cat, "high", "invalid_coordinates", `Invalid latitude for "${title}"`, item.category));
    }
    if (item.lon != null && (item.lon < -180 || item.lon > 180)) {
      findings.push(qf(cat, "high", "invalid_coordinates", `Invalid longitude for "${title}"`, item.category));
    }
  }

  const events = parseLocalEvents(input.sections);
  if (events.length === 0) {
    findings.push(qf(cat, "high", "empty_local_events", "Local Events homepage section empty", "local_events"));
  }

  return findings;
}

function buildSuggestedImprovements(findings: QualityFinding[]): string[] {
  return findings
    .filter((f) => f.severity === "high" || f.severity === "medium")
    .slice(0, 15)
    .map((f) => {
      const prefix = f.section ? `${f.section}: ` : "";
      return `${prefix}${f.message}`;
    });
}

function buildSectionScores(allFindings: QualityFinding[]): Record<string, number> {
  const bySection = new Map<string, QualityFinding[]>();
  for (const f of allFindings) {
    const key = f.section ?? f.category;
    const list = bySection.get(key) ?? [];
    list.push(f);
    bySection.set(key, list);
  }
  const scores: Record<string, number> = {};
  for (const [section, findings] of bySection) {
    scores[section] = scoreCategoryFindings(findings);
  }
  return scores;
}

export function evaluateEditionQuality(input: EditionQualityInput): EditionQualityReport {
  const started = performance.now();

  const byCategory: Record<EditionQualityCategory, QualityFinding[]> = {
    editorial_completeness: checkEditorialCompleteness(input),
    image_quality: checkImageQuality(input),
    local_relevance: checkLocalRelevance(input),
    national_consistency: checkNationalConsistency(input),
    freshness: checkFreshness(input),
    user_experience: checkUserExperience(input),
  };

  const allFindings = Object.values(byCategory).flat();
  const categoryScores = Object.fromEntries(
    Object.entries(byCategory).map(([category, findings]) => [
      category,
      scoreCategoryFindings(findings),
    ])
  ) as Record<EditionQualityCategory, number>;

  const overallScore = computeOverallQualityScore(categoryScores);
  const durationMs = Math.round(performance.now() - started);

  return {
    version: EDITION_QUALITY_VERSION,
    recordedAt: new Date().toISOString(),
    editionId: input.editionId,
    metroKey: input.metroKey,
    editionDate: input.editionDate,
    traceId: input.traceId ?? null,
    overallScore,
    tier: scoreQualityTier(overallScore),
    categoryScores,
    sectionScores: buildSectionScores(allFindings),
    missingContentReport: allFindings.filter((f) => f.code.startsWith("missing") || f.code.includes("blank") || f.code.includes("empty")),
    duplicateReport: allFindings.filter((f) => f.code.includes("duplicate")),
    imageReport: byCategory.image_quality,
    freshnessReport: byCategory.freshness,
    localRelevanceReport: byCategory.local_relevance,
    suggestedImprovements: buildSuggestedImprovements(allFindings),
    durationMs,
    blocksPublication: false,
  };
}

export function buildEditionQualityDiagnostic(
  report: EditionQualityReport
): Record<string, unknown> {
  return {
    kind: "edition_quality",
    recordedAt: report.recordedAt,
    editionId: report.editionId,
    metroKey: report.metroKey,
    editionDate: report.editionDate,
    overallScore: report.overallScore,
    tier: report.tier,
    durationMs: report.durationMs,
    findingCount:
      report.missingContentReport.length +
      report.duplicateReport.length +
      report.imageReport.length +
      report.freshnessReport.length +
      report.localRelevanceReport.length,
    blocksPublication: false,
  };
}

export function formatEditionQualityReport(report: EditionQualityReport): string {
  const lines = [
    `# Edition Quality Report — ${report.metroKey} (${report.editionDate})`,
    "",
    `Overall score: **${report.overallScore}/100** (${report.tier.replace(/_/g, " ")})`,
    `Evaluation time: ${report.durationMs}ms`,
    `Blocks publication: no`,
    "",
    "## Category scores",
    ...Object.entries(report.categoryScores).map(
      ([cat, score]) => `- ${cat.replace(/_/g, " ")}: ${score}`
    ),
    "",
    "## Suggested improvements",
    ...(report.suggestedImprovements.length
      ? report.suggestedImprovements.map((s) => `- ${s}`)
      : ["- None"]),
  ];
  return lines.join("\n");
}
