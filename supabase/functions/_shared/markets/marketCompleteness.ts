import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCatalogBootstrapState } from "../catalog/catalogBootstrap.ts";
import { libraryMetroKeysForLocation } from "../../../../lib/markets/libraryMetroKeys.ts";

export type MarketCompletenessSection = {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
  detail?: string | null;
};

export type MarketCompletenessReport = {
  complete: boolean;
  foundationComplete: boolean;
  needsAttention: boolean;
  sections: MarketCompletenessSection[];
  deficiencies: string[];
  assessedAt: string;
};

export type UsMarketRow = {
  id: string;
  slug: string;
  metro_key: string;
  market_name: string;
  primary_city: string;
  state_code: string;
  country_code: string;
  latitude: number;
  longitude: number;
  default_radius_miles: number;
  fallback_radius_miles: number;
  status: string;
};

const MIN_EVENTS = 5;
const MIN_ACTIVITIES = 12;
const MIN_FOOD = 8;
const MIN_BANDIT_CANDIDATES = 12;
const MIN_MAP_SAMPLE = 8;
const MIN_MAP_COORD_RATE = 0.85;
const MIN_EDITORIAL_RATE = 0.6;
const MIN_HERO_ARTWORK = 1;

function pushSection(
  sections: MarketCompletenessSection[],
  deficiencies: string[],
  section: MarketCompletenessSection
): void {
  sections.push(section);
  if (section.required && !section.complete) {
    deficiencies.push(section.detail ?? section.label);
  }
}

export async function hasApprovedStoryOf(
  admin: SupabaseClient,
  market: UsMarketRow
): Promise<boolean> {
  const metroKeys = libraryMetroKeysForLocation({
    city: market.primary_city,
    state: market.state_code,
    lat: market.latitude,
    lon: market.longitude,
  });

  for (const key of metroKeys) {
    const { count } = await admin
      .from("kindred_city_articles")
      .select("id", { count: "exact", head: true })
      .eq("metro_key", key)
      .eq("approval_status", "approved");
    if ((count ?? 0) > 0) return true;
  }
  return false;
}

async function countEligibleActivities(
  admin: SupabaseClient,
  metroKey: string
): Promise<number> {
  const { count } = await admin
    .from("activities_catalog")
    .select("id", { count: "exact", head: true })
    .eq("metro_key", metroKey)
    .in("lifecycle", ["verified", "active", "featured"]);
  return count ?? 0;
}

async function countTable(
  admin: SupabaseClient,
  table: string,
  metroKey: string,
  extra?: Record<string, string>
): Promise<number> {
  let q = admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("metro_key", metroKey);
  for (const [k, v] of Object.entries(extra ?? {})) {
    q = q.eq(k, v);
  }
  const { count } = await q;
  return count ?? 0;
}

async function activitiesMapQuality(
  admin: SupabaseClient,
  metroKey: string
): Promise<{ total: number; mapped: number; editorial: number }> {
  const { data } = await admin
    .from("activities_catalog")
    .select("lat, lon, confidence_score, note")
    .eq("metro_key", metroKey)
    .in("lifecycle", ["active", "featured", "verified"])
    .limit(200);

  const rows = data ?? [];
  const total = rows.length;
  const mapped = rows.filter(
    (r) =>
      Number.isFinite(r.lat) &&
      Number.isFinite(r.lon) &&
      Math.abs(r.lat) <= 90 &&
      Math.abs(r.lon) <= 180
  ).length;
  const editorial = rows.filter(
    (r) =>
      (typeof r.confidence_score === "number" && r.confidence_score >= 60) ||
      Boolean(r.note?.trim())
  ).length;
  return { total, mapped, editorial };
}

/**
 * Full U.S. market validation — read-only DB checks, no API calls.
 * All sections are required before status can become `complete`.
 */
export async function assessUsMarketCompleteness(
  admin: SupabaseClient,
  market: UsMarketRow
): Promise<MarketCompletenessReport> {
  const sections: MarketCompletenessSection[] = [];
  const deficiencies: string[] = [];
  const metroKey = market.metro_key;

  const coordsOk =
    Number.isFinite(market.latitude) &&
    Number.isFinite(market.longitude) &&
    Math.abs(market.latitude) <= 90 &&
    Math.abs(market.longitude) <= 180;
  pushSection(sections, deficiencies, {
    id: "coordinates",
    label: "Market anchor coordinates",
    complete: coordsOk,
    required: true,
    detail: coordsOk ? null : "Market anchor coordinates invalid",
  });

  const bootstrap = await getCatalogBootstrapState(admin, metroKey);

  const eventCount = bootstrap.eventsCatalogBootstrapped
    ? await countTable(admin, "events_catalog", metroKey)
    : 0;
  const eventsComplete =
    bootstrap.eventsCatalogBootstrapped && eventCount >= MIN_EVENTS;
  pushSection(sections, deficiencies, {
    id: "local_events",
    label: "Local Events",
    complete: eventsComplete,
    required: true,
    detail: eventsComplete
      ? null
      : bootstrap.eventsCatalogBootstrapped
      ? `Need ≥${MIN_EVENTS} active events (have ${eventCount})`
      : "Events catalog awaiting first successful sync",
  });

  const activityCount = bootstrap.activitiesCatalogBootstrapped
    ? await countEligibleActivities(admin, metroKey)
    : 0;
  const activitiesComplete =
    bootstrap.activitiesCatalogBootstrapped && activityCount >= MIN_ACTIVITIES;
  pushSection(sections, deficiencies, {
    id: "activities",
    label: "Activities",
    complete: activitiesComplete,
    required: true,
    detail: activitiesComplete
      ? null
      : bootstrap.activitiesCatalogBootstrapped
      ? `Need ≥${MIN_ACTIVITIES} publishable activities (have ${activityCount})`
      : "Activities catalog awaiting first successful sync",
  });

  const foodCount = bootstrap.foodDrinkCatalogBootstrapped
    ? await countTable(admin, "food_drink_catalog", metroKey, { status: "active" })
    : 0;
  const foodComplete =
    bootstrap.foodDrinkCatalogBootstrapped && foodCount >= MIN_FOOD;
  pushSection(sections, deficiencies, {
    id: "food_drinks",
    label: "Food & Drinks",
    complete: foodComplete,
    required: true,
    detail: foodComplete
      ? null
      : bootstrap.foodDrinkCatalogBootstrapped
      ? `Need ≥${MIN_FOOD} active venues (have ${foodCount})`
      : "Food & Drinks catalog awaiting first successful sync",
  });

  const storyComplete = await hasApprovedStoryOf(admin, market);
  pushSection(sections, deficiencies, {
    id: "story_of",
    label: "Story of Your City",
    complete: storyComplete,
    required: true,
    detail: storyComplete ? null : "No approved Story of article for this metro",
  });

  const banditCandidates = activityCount;
  const banditComplete = banditCandidates >= MIN_BANDIT_CANDIDATES;
  pushSection(sections, deficiencies, {
    id: "bandits_pick",
    label: "Bandit's Pick candidates",
    complete: banditComplete,
    required: true,
    detail: banditComplete
      ? null
      : `Need ≥${MIN_BANDIT_CANDIDATES} activity candidates (have ${banditCandidates})`,
  });

  pushSection(sections, deficiencies, {
    id: "today_in_history",
    label: "Today in History",
    complete: true,
    required: true,
    detail: "Global desk — available for all U.S. markets",
  });

  const { count: artworkCount } = await admin
    .from("kindred_hero_artwork")
    .select("id", { count: "exact", head: true })
    .eq("validation_status", "approved");
  const artworkComplete = (artworkCount ?? 0) >= MIN_HERO_ARTWORK;
  pushSection(sections, deficiencies, {
    id: "artwork",
    label: "Morning artwork pool",
    complete: artworkComplete,
    required: true,
    detail: artworkComplete
      ? null
      : "Hero artwork library needs at least one ready piece",
  });

  const mapQuality = bootstrap.activitiesCatalogBootstrapped
    ? await activitiesMapQuality(admin, metroKey)
    : { total: 0, mapped: 0, editorial: 0 };
  const mapRate =
    mapQuality.total > 0 ? mapQuality.mapped / mapQuality.total : 0;
  const mapsComplete =
    mapQuality.mapped >= MIN_MAP_SAMPLE && mapRate >= MIN_MAP_COORD_RATE;
  pushSection(sections, deficiencies, {
    id: "maps",
    label: "Verified map coordinates",
    complete: mapsComplete,
    required: true,
    detail: mapsComplete
      ? null
      : `Need ≥${MIN_MAP_SAMPLE} mapped activities at ${Math.round(MIN_MAP_COORD_RATE * 100)}% rate`,
  });

  const editorialRate =
    mapQuality.total > 0 ? mapQuality.editorial / mapQuality.total : 0;
  const editorialComplete =
    mapQuality.total >= MIN_ACTIVITIES && editorialRate >= MIN_EDITORIAL_RATE;
  pushSection(sections, deficiencies, {
    id: "editorial_quality",
    label: "Editorial quality gates",
    complete: editorialComplete,
    required: true,
    detail: editorialComplete
      ? null
      : `Need ≥${Math.round(MIN_EDITORIAL_RATE * 100)}% activities with editorial score or image`,
  });

  pushSection(sections, deficiencies, {
    id: "family_safe",
    label: "Family-safe filtering",
    complete: true,
    required: true,
    detail: "Enforced globally in discovery and events pipelines",
  });

  const requiredSections = sections.filter((s) => s.required);
  const foundationIds = ["local_events", "activities", "food_drinks", "coordinates"];
  const foundationComplete = foundationIds.every(
    (id) => sections.find((s) => s.id === id)?.complete
  );
  const complete = requiredSections.every((s) => s.complete);
  const needsAttention = deficiencies.length > 0;

  return {
    complete,
    foundationComplete,
    needsAttention,
    sections,
    deficiencies,
    assessedAt: new Date().toISOString(),
  };
}

/** Validate one market — no catalog sync, no API spend. */
export async function validateUsMarketOnly(
  admin: SupabaseClient,
  market: UsMarketRow
): Promise<MarketCompletenessReport> {
  return assessUsMarketCompleteness(admin, market);
}

export function marketStatusFromCompleteness(
  report: MarketCompletenessReport,
  currentStatus: string
): string {
  if (currentStatus === "paused" || currentStatus === "building") {
    return currentStatus;
  }
  if (report.complete) return "complete";
  if (report.foundationComplete) return "ready";
  if (report.needsAttention) return "needs_attention";
  return "planned";
}

export function isMarketSupported(report: MarketCompletenessReport): boolean {
  return report.foundationComplete;
}
