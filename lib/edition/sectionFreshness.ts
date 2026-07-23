/**
 * Section-level freshness policies — when metro/national content may be reused
 * vs regenerated. Shared between server edition build and client diagnostics.
 */

import { isMetroCacheVersionCurrent } from "./metroCacheVersion.ts";

export type SectionFreshnessScope = "metro" | "national" | "none";

export type SectionFreshnessCadence =
  | "daily_calendar"
  | "weekly_sunday"
  | "monthly_30d"
  | "evergreen"
  | "national_daily"
  | "source_expiry"
  | "api_only";

/** Desk identifiers aligned with edition build stages and cache rows. */
export type FreshnessSectionType =
  | "local_events"
  | "food_drinks"
  | "activities"
  | "history_around_town"
  | "story_of"
  | "today_masterpiece"
  | "today_in_history"
  | "weather"
  | "local_deals";

export type SectionFreshnessPolicy = {
  section: FreshnessSectionType;
  scope: SectionFreshnessScope;
  cadence: SectionFreshnessCadence;
  /** Whether this desk may invoke Claude during ordinary edition build. */
  usesClaude: boolean;
};

export const SECTION_FRESHNESS_POLICIES: Record<
  FreshnessSectionType,
  SectionFreshnessPolicy
> = {
  local_events: {
    section: "local_events",
    scope: "metro",
    cadence: "daily_calendar",
    usesClaude: true,
  },
  food_drinks: {
    section: "food_drinks",
    scope: "metro",
    cadence: "weekly_sunday",
    usesClaude: false,
  },
  activities: {
    section: "activities",
    scope: "metro",
    cadence: "weekly_sunday",
    usesClaude: false,
  },
  history_around_town: {
    section: "history_around_town",
    scope: "metro",
    cadence: "monthly_30d",
    usesClaude: false,
  },
  story_of: {
    section: "story_of",
    scope: "metro",
    cadence: "evergreen",
    usesClaude: false,
  },
  today_masterpiece: {
    section: "today_masterpiece",
    scope: "national",
    cadence: "national_daily",
    usesClaude: true,
  },
  today_in_history: {
    section: "today_in_history",
    scope: "national",
    cadence: "national_daily",
    usesClaude: true,
  },
  weather: {
    section: "weather",
    scope: "none",
    cadence: "api_only",
    usesClaude: false,
  },
  local_deals: {
    section: "local_deals",
    scope: "metro",
    cadence: "source_expiry",
    usesClaude: false,
  },
};

export type MetroSectionCacheRecord = {
  id: string;
  scope: "metro" | "national";
  metro_key: string | null;
  section_type: FreshnessSectionType;
  edition_date: string | null;
  national_content_date: string | null;
  payload: unknown;
  generated_at: string;
  refresh_after: string;
  expires_at: string | null;
  generation_status: "complete" | "partial" | "failed";
  validation_status: "valid" | "invalid" | "pending";
  content_version: number;
};

export type SectionFreshnessDecision = {
  section: FreshnessSectionType;
  scope: SectionFreshnessScope;
  metroKey: string | null;
  nationalContentDate: string | null;
  existingContentFound: boolean;
  contentStillValid: boolean;
  claudeGenerationTriggered: boolean;
  reason: string;
  previousGeneratedAt: string | null;
  nextRefreshAfter: string | null;
  forceRefresh: boolean;
};

function parseIsoDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Most recent Sunday 00:00 UTC on or before `now`. */
export function mostRecentSundayUtc(now: Date): Date {
  const day = startOfUtcDay(now);
  day.setUTCDate(day.getUTCDate() - day.getUTCDay());
  return day;
}

/** Next Sunday 00:00 UTC strictly after `now`. */
export function nextSundayUtc(now: Date): Date {
  const recent = mostRecentSundayUtc(now);
  const next = new Date(recent);
  next.setUTCDate(next.getUTCDate() + 7);
  return next;
}

/** Cache period anchor for weekly-Sunday desks (YYYY-MM-DD of the Sunday). */
export function weeklySundayPeriodKey(now: Date = new Date()): string {
  return formatIsoDate(mostRecentSundayUtc(now));
}

/** Compute refresh_after for a newly saved cache row. */
export function computeRefreshAfter(
  policy: SectionFreshnessPolicy,
  generatedAt: Date,
  editionDate: string
): Date {
  switch (policy.cadence) {
    case "daily_calendar":
    case "national_daily": {
      const anchor = parseIsoDate(editionDate);
      const next = new Date(anchor);
      next.setUTCDate(next.getUTCDate() + 1);
      return next;
    }
    case "weekly_sunday":
      return nextSundayUtc(generatedAt);
    case "monthly_30d": {
      const expires = new Date(generatedAt);
      expires.setUTCDate(expires.getUTCDate() + 30);
      return expires;
    }
    case "evergreen": {
      const far = new Date(generatedAt);
      far.setUTCFullYear(far.getUTCFullYear() + 10);
      return far;
    }
    case "source_expiry":
    case "api_only":
    default:
      return new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);
  }
}

/** Edition-date anchor stored on cache rows for lookup. */
export function cacheEditionDateForPolicy(
  policy: SectionFreshnessPolicy,
  editionDate: string,
  now: Date = new Date()
): string {
  if (policy.cadence === "weekly_sunday") {
    return weeklySundayPeriodKey(now);
  }
  if (policy.cadence === "monthly_30d") {
    return editionDate.slice(0, 7) + "-01";
  }
  if (policy.cadence === "evergreen") {
    return "evergreen";
  }
  return editionDate;
}

export function isMetroSectionCacheValid(
  record: Pick<
    MetroSectionCacheRecord,
    | "generated_at"
    | "refresh_after"
    | "generation_status"
    | "validation_status"
    | "content_version"
  >,
  now: Date = new Date()
): boolean {
  if (record.generation_status !== "complete") return false;
  if (record.validation_status !== "valid") return false;
  if (!isMetroCacheVersionCurrent(record.content_version)) return false;
  const refreshAfter = new Date(record.refresh_after);
  if (Number.isNaN(refreshAfter.getTime())) return false;
  return now.getTime() < refreshAfter.getTime();
}

export function isSectionForceRefreshRequested(
  section: FreshnessSectionType,
  forceRefreshSections: readonly string[] | null | undefined
): boolean {
  if (!forceRefreshSections?.length) return false;
  const normalized = forceRefreshSections.map((s) => s.trim().toLowerCase());
  return (
    normalized.includes(section) ||
    normalized.includes("all") ||
    normalized.includes("*")
  );
}

export function buildFreshnessDecision(input: {
  section: FreshnessSectionType;
  metroKey: string | null;
  nationalContentDate: string | null;
  record: MetroSectionCacheRecord | null;
  forceRefresh: boolean;
  claudeGenerationTriggered: boolean;
  reason: string;
  now?: Date;
}): SectionFreshnessDecision {
  const policy = SECTION_FRESHNESS_POLICIES[input.section];
  const stillValid =
    Boolean(input.record) &&
    !input.forceRefresh &&
    isMetroSectionCacheValid(input.record!, input.now);

  return {
    section: input.section,
    scope: policy.scope,
    metroKey: input.metroKey,
    nationalContentDate: input.nationalContentDate,
    existingContentFound: Boolean(input.record),
    contentStillValid: stillValid,
    claudeGenerationTriggered: input.claudeGenerationTriggered,
    reason: input.reason,
    previousGeneratedAt: input.record?.generated_at ?? null,
    nextRefreshAfter: input.record?.refresh_after ?? null,
    forceRefresh: input.forceRefresh,
  };
}
