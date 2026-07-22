/**
 * Edition Pipeline V2 — deterministic technical validation (Phase 1).
 * Zero AI. Reuses assessPersistedEditionBuild and finalPublicationGate.
 *
 * Publication severity (Kindred V1):
 * - BLOCKING FAIL: local_events, activities, food_drinks
 * - WARNING (publish allowed): weather, story_of, local_news, national_news
 * - NON-BLOCKING: masterpiece, today_in_history, history_around_town, bandits_pick
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  assessPersistedEditionBuild,
  assessPersistedEditionRow,
  type EditionSectionRow,
} from "../editionCompleteness.ts";
import { parseDiscoveryPayload } from "../discovery/discoveryPayload.ts";
import { allocateDiscoverySections } from "../discovery/sectionAllocation.ts";
import type { DiscoveryItem, DiscoveryPayload, RankedDiscoveryItem } from "../discovery/types.ts";
import {
  gateDiscoveryPayloadForPublication,
  gateLocalEventsForPublication,
} from "./finalPublicationGate.ts";
import { isBanditsPicksEnabled } from "../bandit/banditsPicksFeature.ts";
import { isNewsSectionsEnabled } from "./newsSectionsFeature.ts";
import { eventHasPublishableEditorial } from "../localEvents/banditNotes.ts";
import { filterVerifiedEventsForEdition } from "../localEvents/eventDateVerification.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import { isPlaceholderCopy } from "../contentQuality.ts";
import type { LeadStory } from "../leadStory/types.ts";
import type { LocalNewsContentType } from "../../../../lib/edition/localNewsDesk.ts";
import { parseWeatherSnapshot } from "../weather/weatherSnapshot.ts";
import {
  validateSummaryConditionPhrase,
  validateSummaryCurrentTemp,
  validateWeatherSnapshot,
  WEATHER_PUBLISH_MAX_AGE_MS,
} from "../weather/weatherValidation.ts";
import { isMorningHeroDetailComplete } from "../heroArtwork/presentation.ts";
import { isEditoriallyExcludedListing } from "../localEvents/familyFriendlyFilter.ts";
import { meetsDiscoveryConfidenceGate } from "../editorial/confidencePayload.ts";
import {
  EDITION_VALIDATION_VERSION,
  type DeskValidationCheck,
  type DeskValidationReport,
  type DeskValidationStatus,
  type TechnicalValidationReport,
} from "./editionValidationTypes.ts";
import {
  deskStatusForPublicationIssues,
  recordDeskPublicationOutcome,
} from "./publicationSeverity.ts";
import {
  aggregateUrlProbeStatus,
  isStructurallyValidHttpUrl,
  isValidLatitude,
  isValidLongitude,
  probeUrlsBounded,
  type UrlProbeResult,
} from "./urlValidation.ts";

export type EditionValidationSnapshot = {
  editionId: string;
  editionDate: string;
  metroKey: string;
  userId: string;
  editionStatus: string;
  sections: EditionSectionRow[];
  discovery: DiscoveryPayload | null;
  leadStory: LeadStory | null;
  nationalNews: unknown;
  usNationalDailyId: string | null;
  morningEdition: unknown;
  historyAroundTown: unknown;
  bandit: unknown;
  editorialContext: Record<string, unknown> | null;
  expectStoryOf: boolean;
};

const APPROVED_LOCAL_NEWS_FALLBACK_TYPES: ReadonlySet<LocalNewsContentType> = new Set([
  "local_news",
  "sports",
  "weather",
  "community",
]);

function deskReport(
  desk: DeskValidationReport["desk"],
  status: DeskValidationStatus,
  checks: DeskValidationCheck[],
  reasons: string[],
  relatedBuildStages: string[]
): DeskValidationReport {
  return { desk, status, checks, reasons, relatedBuildStages };
}

function parseLocalEvents(body: string | null | undefined): LocalEvent[] {
  if (!body?.trim()) return [];
  try {
    const parsed = JSON.parse(body) as { events?: unknown[] };
    return Array.isArray(parsed.events)
      ? (parsed.events.filter((e) => e && typeof e === "object") as LocalEvent[])
      : [];
  } catch {
    return [];
  }
}

function eventIdentityKey(event: LocalEvent): string {
  const name = (event.name ?? "").trim().toLowerCase();
  const start = (event.startDateTime ?? "").trim().toLowerCase();
  const venue = (event.venue ?? "").trim().toLowerCase();
  return `${name}|${start}|${venue}`;
}

function discoveryItemKey(item: DiscoveryItem): string {
  return `${item.id}|${item.title}`.trim().toLowerCase();
}

function discoveryListingHay(item: DiscoveryItem): string {
  return [item.title, item.dek, item.address, ...(item.venueCategories ?? [])]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");
}

function validateDiscoveryItems(
  items: RankedDiscoveryItem[],
  deskLabel: string
): { checks: DeskValidationCheck[]; reasons: string[]; status: DeskValidationStatus } {
  const checks: DeskValidationCheck[] = [];
  const reasons: string[] = [];
  if (!items.length) {
    checks.push({ id: `${deskLabel}_populated`, status: "FAIL", message: "empty_pool" });
    return { checks, reasons: ["empty_pool"], status: "FAIL" };
  }
  checks.push({ id: `${deskLabel}_populated`, status: "PASS" });

  const seen = new Set<string>();
  for (const row of items) {
    const key = discoveryItemKey(row.item);
    if (seen.has(key)) {
      checks.push({ id: `${deskLabel}_dedupe`, status: "FAIL", message: key });
      reasons.push(`duplicate_identity:${row.item.title}`);
    }
    seen.add(key);

    if (isEditoriallyExcludedListing(discoveryListingHay(row.item)).excluded) {
      checks.push({ id: `${deskLabel}_family_safe`, status: "FAIL", message: row.item.title });
      reasons.push(`prohibited_listing:${row.item.title}`);
    }
    if (!meetsDiscoveryConfidenceGate(row.item)) {
      checks.push({ id: `${deskLabel}_confidence`, status: "FAIL", message: row.item.title });
      reasons.push(`low_confidence:${row.item.title}`);
    }
    if (row.item.lat != null && !isValidLatitude(row.item.lat)) {
      checks.push({ id: `${deskLabel}_coords`, status: "FAIL", message: "invalid_lat" });
      reasons.push("invalid_latitude");
    }
    if (row.item.lon != null && !isValidLongitude(row.item.lon)) {
      checks.push({ id: `${deskLabel}_coords`, status: "FAIL", message: "invalid_lon" });
      reasons.push("invalid_longitude");
    }
    if (row.item.url && !isStructurallyValidHttpUrl(row.item.url)) {
      checks.push({ id: `${deskLabel}_url`, status: "FAIL", message: row.item.url });
      reasons.push("malformed_item_url");
    }
  }

  if (reasons.length) return { checks, reasons, status: "FAIL" };
  return { checks, reasons: [], status: "PASS" };
}

function validateLocalNewsDesk(lead: LeadStory | null): DeskValidationReport {
  const checks: DeskValidationCheck[] = [];
  const reasons: string[] = [];

  if (!lead) {
    checks.push({ id: "local_news_present", status: "WARNING", message: "missing_lead_story" });
    return deskReport("local_news", "WARNING", checks, ["missing_lead_story"], ["local_news"]);
  }

  checks.push({ id: "local_news_present", status: "PASS" });

  const headline = lead.headline?.trim() ?? "";
  const summary = lead.summary?.trim() ?? "";
  if (!headline || isPlaceholderCopy(headline)) {
    checks.push({ id: "local_news_headline", status: "WARNING", message: "empty_or_placeholder" });
    reasons.push("empty_or_placeholder_headline");
  } else {
    checks.push({ id: "local_news_headline", status: "PASS" });
  }
  if (!summary || isPlaceholderCopy(summary)) {
    checks.push({ id: "local_news_summary", status: "WARNING", message: "empty_or_placeholder" });
    reasons.push("empty_or_placeholder_summary");
  } else {
    checks.push({ id: "local_news_summary", status: "PASS" });
  }

  const contentType = lead.contentType ?? null;
  if (contentType && !APPROVED_LOCAL_NEWS_FALLBACK_TYPES.has(contentType)) {
    checks.push({ id: "local_news_fallback_type", status: "WARNING", message: contentType });
    reasons.push(`unsupported_content_type:${contentType}`);
  } else if (contentType && contentType !== "local_news") {
    checks.push({
      id: "local_news_fallback_type",
      status: "WARNING",
      message: `approved_fallback:${contentType}`,
    });
    reasons.push(`approved_fallback:${contentType}`);
  } else {
    checks.push({ id: "local_news_fallback_type", status: "PASS" });
  }

  const overall: DeskValidationStatus = reasons.length ? "WARNING" : "PASS";

  return deskReport("local_news", overall, checks, reasons, ["local_news"]);
}

export async function runTechnicalValidationOnSnapshot(input: {
  snapshot: EditionValidationSnapshot;
  enforcing: boolean;
  editionDate: string;
  now?: Date;
  skipExternalChecks?: boolean;
}): Promise<TechnicalValidationReport> {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const { snapshot } = input;
  const now = input.now ?? new Date();
  const deskReports: DeskValidationReport[] = [];
  const blockingFailures: string[] = [];
  const warnings: string[] = [];
  const urlsToProbe: { url: string; required: boolean }[] = [];

  // Edition-level
  const editionChecks: DeskValidationCheck[] = [];
  if (!snapshot.editionId) {
    editionChecks.push({ id: "edition_row", status: "FAIL", message: "missing_edition" });
    blockingFailures.push("edition_row_missing");
  } else {
    editionChecks.push({ id: "edition_row", status: "PASS" });
  }
  if (snapshot.editionStatus === "failed") {
    editionChecks.push({ id: "edition_status", status: "FAIL", message: "corrupt_status" });
    blockingFailures.push("edition_status_failed");
  } else {
    editionChecks.push({ id: "edition_status", status: "PASS" });
  }

  const completeness = assessPersistedEditionBuild({
    sections: snapshot.sections,
    discovery: snapshot.discovery,
    hasBanditsPick: isBanditsPicksEnabled()
      ? Boolean(
          snapshot.bandit &&
            typeof snapshot.bandit === "object" &&
            (snapshot.bandit as { pick?: { story?: { headline?: string } } }).pick?.story
              ?.headline
        )
      : true,
    expectStoryOf: snapshot.expectStoryOf,
    hasMorningHero: Boolean(
      snapshot.morningEdition &&
        typeof snapshot.morningEdition === "object" &&
        (snapshot.morningEdition as { morningHero?: { hostedUrl?: string } }).morningHero
          ?.hostedUrl?.trim()
    ),
    morningEdition: snapshot.morningEdition,
  });

  editionChecks.push({
    id: "completeness_assessment",
    status: completeness.complete ? "PASS" : "WARNING",
    message: completeness.complete ? undefined : completeness.reasons.join("; "),
  });
  if (!completeness.complete) {
    for (const reason of completeness.reasons) {
      warnings.push(`completeness:${reason}`);
    }
  }

  deskReports.push(
    deskReport("edition", editionChecks.some((c) => c.status === "FAIL") ? "FAIL" : "PASS", editionChecks, [], [
      "initialize_edition",
    ])
  );

  // Local Events — blocking
  const localEventsSection = snapshot.sections.find((s) => s.section_type === "local_events");
  const events = parseLocalEvents(localEventsSection?.body);
  const scheduleGate = filterVerifiedEventsForEdition(events, {
    editionDate: snapshot.editionDate,
    now,
  });
  const eventGate = gateLocalEventsForPublication(events, {
    editionDate: snapshot.editionDate,
    now,
  });

  const localEventChecks: DeskValidationCheck[] = [];
  const localEventReasons: string[] = [];
  if (!localEventsSection) {
    localEventChecks.push({ id: "section_exists", status: "FAIL" });
    localEventReasons.push("missing_local_events_section");
  } else {
    localEventChecks.push({ id: "section_exists", status: "PASS" });
  }
  if (!events.length) {
    localEventChecks.push({ id: "events_populated", status: "FAIL" });
    localEventReasons.push("no_events");
  } else {
    localEventChecks.push({ id: "events_populated", status: "PASS" });
  }

  const seenEvents = new Set<string>();
  for (const event of events) {
    const key = eventIdentityKey(event);
    if (seenEvents.has(key)) {
      localEventChecks.push({ id: "dedupe", status: "FAIL", message: key });
      localEventReasons.push(`duplicate_event:${event.name}`);
    }
    seenEvents.add(key);
    if (event.lat != null && !isValidLatitude(event.lat)) {
      localEventChecks.push({ id: "coords", status: "FAIL" });
      localEventReasons.push("invalid_event_latitude");
    }
    if (event.lon != null && !isValidLongitude(event.lon)) {
      localEventChecks.push({ id: "coords", status: "FAIL" });
      localEventReasons.push("invalid_event_longitude");
    }
    if (event.sourceUrl && !isStructurallyValidHttpUrl(event.sourceUrl)) {
      localEventChecks.push({ id: "url", status: "FAIL" });
      localEventReasons.push("malformed_event_url");
    }
  }

  if (scheduleGate.rejected.length) {
    localEventChecks.push({
      id: "upcoming_schedule",
      status: "FAIL",
      message: `${scheduleGate.rejected.length}_expired_or_unverified`,
    });
    localEventReasons.push("expired_or_unverified_events");
  } else {
    localEventChecks.push({ id: "upcoming_schedule", status: "PASS" });
  }

  if (events.length && eventGate.events.length === 0) {
    localEventChecks.push({
      id: "publication_gate",
      status: "FAIL",
      message: `${eventGate.report.rejected.length}_rejected`,
    });
    localEventReasons.push("no_publishable_events");
  } else if (eventGate.report.rejected.length) {
    localEventChecks.push({
      id: "publication_gate",
      status: "WARNING",
      message: `${eventGate.report.rejected.length}_rejected`,
    });
    warnings.push("local_events:publication_gate_partial_rejection");
  } else {
    localEventChecks.push({ id: "publication_gate", status: "PASS" });
  }

  const localEventsStatus = recordDeskPublicationOutcome({
    desk: "local_events",
    status: deskStatusForPublicationIssues("local_events", localEventReasons.length > 0),
    reasons: localEventReasons,
    blockingFailures,
    warnings,
  });
  deskReports.push(
    deskReport("local_events", localEventsStatus, localEventChecks, localEventReasons, ["local_events"])
  );

  // Discovery gates (activities + food source data)
  const discovery = snapshot.discovery;
  let discoveryGateReport = null;
  if (discovery) {
    const gated = gateDiscoveryPayloadForPublication(discovery);
    discoveryGateReport = gated.report;
    if (gated.report.rejectedFamily || gated.report.rejectedConfidence) {
      warnings.push(
        `discovery_gate:family=${gated.report.rejectedFamily}:confidence=${gated.report.rejectedConfidence}`
      );
    }
  }

  const allocation = allocateDiscoverySections(discovery);
  const activitiesValidation = validateDiscoveryItems(allocation.activities, "activities");
  const activitiesStatus = recordDeskPublicationOutcome({
    desk: "activities",
    status: activitiesValidation.status,
    reasons: activitiesValidation.reasons,
    blockingFailures,
    warnings,
  });
  deskReports.push(
    deskReport(
      "activities",
      activitiesStatus,
      activitiesValidation.checks,
      activitiesValidation.reasons,
      ["activities"]
    )
  );

  const foodSection = snapshot.sections.find((s) => s.section_type === "food_drinks");
  const foodChecks: DeskValidationCheck[] = [];
  const foodReasons: string[] = [];
  if (!foodSection) {
    foodChecks.push({ id: "section_exists", status: "FAIL" });
    foodReasons.push("missing_food_drinks_section");
  } else {
    foodChecks.push({ id: "section_exists", status: "PASS" });
  }
  const foodItemsValidation = validateDiscoveryItems(allocation.recommendations, "food_drinks");
  foodChecks.push(...foodItemsValidation.checks);
  foodReasons.push(...foodItemsValidation.reasons);
  const foodStatus = recordDeskPublicationOutcome({
    desk: "food_drinks",
    status: deskStatusForPublicationIssues("food_drinks", foodReasons.length > 0),
    reasons: foodReasons,
    blockingFailures,
    warnings,
  });
  deskReports.push(
    deskReport("food_drinks", foodStatus, foodChecks, foodReasons, ["food_drinks"])
  );

  // Weather — warning desk (publish allowed)
  const weatherSection = snapshot.sections.find((s) => s.section_type === "weather");
  const weatherChecks: DeskValidationCheck[] = [];
  const weatherReasons: string[] = [];
  const weatherSummary =
    typeof snapshot.editorialContext?.weatherSummary === "string"
      ? snapshot.editorialContext.weatherSummary
      : weatherSection?.body ?? "";
  if (!weatherSection?.body?.trim()) {
    weatherChecks.push({ id: "section_body", status: "WARNING" });
    weatherReasons.push("empty_weather_section");
  } else {
    weatherChecks.push({ id: "section_body", status: "PASS" });
  }
  if (!weatherSummary?.trim()) {
    weatherChecks.push({ id: "weather_summary", status: "WARNING" });
    weatherReasons.push("empty_weather_summary");
  } else {
    weatherChecks.push({ id: "weather_summary", status: "PASS" });
  }

  const weatherSnapshot = parseWeatherSnapshot(
    (snapshot.editorialContext as { weatherSnapshot?: unknown } | null)
      ?.weatherSnapshot
  );
  if (weatherSnapshot) {
    const freshness = validateWeatherSnapshot(weatherSnapshot, {
      maxAgeMs: WEATHER_PUBLISH_MAX_AGE_MS,
    });
    if (!freshness.ok) {
      weatherChecks.push({ id: "weather_snapshot_fresh", status: "FAIL" });
      weatherReasons.push(...freshness.reasons);
    } else {
      weatherChecks.push({ id: "weather_snapshot_fresh", status: "PASS" });
    }

    const currentMatch = /^Current\s+([\d.]+)°/i.exec(weatherSummary ?? "");
    const summaryCurrentF = currentMatch ? Number(currentMatch[1]) : null;
    const currentValidation = validateSummaryCurrentTemp(
      summaryCurrentF,
      weatherSnapshot
    );
    if (!currentValidation.ok) {
      weatherChecks.push({ id: "weather_current_match", status: "FAIL" });
      weatherReasons.push(...currentValidation.reasons);
    } else {
      weatherChecks.push({ id: "weather_current_match", status: "PASS" });
    }

    const conditionPhrase = /;\s*([^;.]+)\.?$/i.exec(weatherSummary ?? "")?.[1]
      ?.trim();
    const conditionValidation = validateSummaryConditionPhrase(
      conditionPhrase ?? null,
      weatherSnapshot
    );
    if (!conditionValidation.ok) {
      weatherChecks.push({ id: "weather_condition_match", status: "FAIL" });
      weatherReasons.push(...conditionValidation.reasons);
    } else {
      weatherChecks.push({ id: "weather_condition_match", status: "PASS" });
    }
  } else if (weatherSection?.body?.trim()) {
    weatherChecks.push({ id: "weather_snapshot", status: "WARNING" });
    weatherReasons.push("missing_weather_snapshot");
  }

  const weatherHasBlockingFailure = weatherReasons.some((r) =>
    [
      "stale_weather_observation",
      "summary_current_mismatch",
      "summary_condition_mismatch",
      "high_below_low",
      "current_outside_daily_range",
      "missing_current_temperature",
    ].includes(r)
  );
  const weatherStatus = recordDeskPublicationOutcome({
    desk: "weather",
    status: weatherHasBlockingFailure
      ? "FAIL"
      : deskStatusForPublicationIssues("weather", weatherReasons.length > 0),
    reasons: weatherReasons,
    blockingFailures,
    warnings,
  });
  deskReports.push(deskReport("weather", weatherStatus, weatherChecks, weatherReasons, ["weather"]));

  // Story of — warning desk; History Around Town — non-blocking delight
  const storySection = snapshot.sections.find(
    (s) => s.section_type === "story_of" || s.section_type === "your_city"
  );
  const storyChecks: DeskValidationCheck[] = [];
  const storyReasons: string[] = [];
  if (snapshot.expectStoryOf && !storySection) {
    storyChecks.push({ id: "story_of_section", status: "WARNING" });
    storyReasons.push("missing_story_of");
  } else if (storySection) {
    storyChecks.push({ id: "story_of_section", status: "PASS" });
    if (!storySection.headline?.trim() || !storySection.body?.trim()) {
      storyChecks.push({ id: "story_of_content", status: "WARNING" });
      storyReasons.push("empty_story_of_content");
    } else {
      storyChecks.push({ id: "story_of_content", status: "PASS" });
    }
  } else {
    storyChecks.push({ id: "story_of_section", status: "WARNING", message: "no_approved_city_article" });
    storyReasons.push("optional_missing");
  }

  const history = snapshot.historyAroundTown as {
    places?: unknown[];
    carousel?: unknown[];
  } | null;
  const historyChecks: DeskValidationCheck[] = [];
  const historyReasons: string[] = [];
  const historyPlaces = Array.isArray(history?.places) ? history!.places!.length : 0;
  const historyCarousel = Array.isArray(history?.carousel) ? history!.carousel!.length : 0;
  if (historyPlaces === 0 && historyCarousel === 0) {
    historyChecks.push({ id: "history_payload", status: "WARNING" });
    historyReasons.push("history_around_town_empty");
  } else {
    historyChecks.push({ id: "history_payload", status: "PASS" });
  }
  const storyStatus = recordDeskPublicationOutcome({
    desk: "story_of",
    status: deskStatusForPublicationIssues("story_of", storyReasons.length > 0),
    reasons: storyReasons,
    blockingFailures,
    warnings,
  });
  deskReports.push(
    deskReport("story_of", storyStatus, storyChecks, storyReasons, ["story_of"])
  );
  const historyStatus = recordDeskPublicationOutcome({
    desk: "history_around_town",
    status: deskStatusForPublicationIssues("history_around_town", historyReasons.length > 0),
    reasons: historyReasons,
    blockingFailures,
    warnings,
  });
  deskReports.push(
    deskReport("history_around_town", historyStatus, historyChecks, historyReasons, ["story_of"])
  );

  // Local News — warning desk (fallback-aware, never blocks publish)
  if (isNewsSectionsEnabled()) {
    const localNewsReport = validateLocalNewsDesk(snapshot.leadStory);
    const localNewsStatus = recordDeskPublicationOutcome({
      desk: "local_news",
      status: localNewsReport.status,
      reasons: localNewsReport.reasons,
      blockingFailures,
      warnings,
    });
    deskReports.push({ ...localNewsReport, status: localNewsStatus });
  } else {
    deskReports.push(
      deskReport("local_news", "SKIPPED", [], [], ["local_news"])
    );
  }

  // National News — warning desk
  if (isNewsSectionsEnabled()) {
    const nationalChecks: DeskValidationCheck[] = [];
    const nationalReasons: string[] = [];
    if (!snapshot.usNationalDailyId) {
      nationalChecks.push({ id: "national_daily_attach", status: "WARNING" });
      nationalReasons.push("missing_us_national_daily_id");
    } else {
      nationalChecks.push({ id: "national_daily_attach", status: "PASS" });
    }
    const nationalPackage = snapshot.nationalNews as { stories?: unknown[] } | null;
    if (!nationalPackage?.stories?.length) {
      nationalChecks.push({ id: "national_news_payload", status: "WARNING" });
      nationalReasons.push("empty_national_news");
    } else {
      nationalChecks.push({ id: "national_news_payload", status: "PASS" });
    }
    const nationalStatus = recordDeskPublicationOutcome({
      desk: "national_news",
      status: deskStatusForPublicationIssues("national_news", nationalReasons.length > 0),
      reasons: nationalReasons,
      blockingFailures,
      warnings,
    });
    deskReports.push(
      deskReport("national_news", nationalStatus, nationalChecks, nationalReasons, [
        "attach_national_daily",
      ])
    );
  } else {
    deskReports.push(
      deskReport("national_news", "SKIPPED", [], [], ["attach_national_daily"])
    );
  }

  const tihSection = snapshot.sections.find((s) => s.section_type === "today_in_history");
  const tihChecks: DeskValidationCheck[] = [];
  const tihReasons: string[] = [];
  if (!tihSection?.headline?.trim() || !tihSection.body?.trim()) {
    tihChecks.push({ id: "today_in_history", status: "WARNING" });
    tihReasons.push("empty_today_in_history");
  } else {
    tihChecks.push({ id: "today_in_history", status: "PASS" });
  }
  const tihStatus = recordDeskPublicationOutcome({
    desk: "today_in_history",
    status: deskStatusForPublicationIssues("today_in_history", tihReasons.length > 0),
    reasons: tihReasons,
    blockingFailures,
    warnings,
  });
  deskReports.push(
    deskReport("today_in_history", tihStatus, tihChecks, tihReasons, ["attach_national_daily"])
  );

  const masterpieceChecks: DeskValidationCheck[] = [];
  const masterpieceReasons: string[] = [];
  const morningHero = snapshot.morningEdition as {
    morningHero?: { hostedUrl?: string; detail?: unknown };
  } | null;
  const hostedUrl = morningHero?.morningHero?.hostedUrl?.trim() ?? "";
  if (!hostedUrl) {
    masterpieceChecks.push({ id: "masterpiece_hosted_url", status: "WARNING" });
    masterpieceReasons.push("missing_masterpiece_image");
  } else {
    masterpieceChecks.push({ id: "masterpiece_hosted_url", status: "PASS" });
    urlsToProbe.push({ url: hostedUrl, required: false });
  }
  if (
    morningHero?.morningHero?.detail &&
    !isMorningHeroDetailComplete(
      morningHero.morningHero.detail as Parameters<typeof isMorningHeroDetailComplete>[0]
    )
  ) {
    masterpieceChecks.push({ id: "masterpiece_detail", status: "WARNING", message: "incomplete_detail" });
    warnings.push("masterpiece:incomplete_detail");
  } else if (morningHero?.morningHero?.detail) {
    masterpieceChecks.push({ id: "masterpiece_detail", status: "PASS" });
  }
  const masterpieceStatus = recordDeskPublicationOutcome({
    desk: "masterpiece",
    status: deskStatusForPublicationIssues("masterpiece", masterpieceReasons.length > 0),
    reasons: masterpieceReasons,
    blockingFailures,
    warnings,
  });
  deskReports.push(
    deskReport("masterpiece", masterpieceStatus, masterpieceChecks, masterpieceReasons, [
      "attach_national_daily",
    ])
  );

  // Bandit's Pick — SKIPPED when disabled
  if (!isBanditsPicksEnabled()) {
    deskReports.push(
      deskReport("bandits_pick", "SKIPPED", [{ id: "feature_flag", status: "SKIPPED" }], [], [
        "bandits_pick",
      ])
    );
  }

  // Bounded URL probes
  let externalChecks = { attempted: 0, durationMs: 0, warnings: 0, failures: 0 };
  if (urlsToProbe.length && !input.skipExternalChecks) {
    const probe = await probeUrlsBounded(
      urlsToProbe.map((u) => u.url),
      { required: true }
    );
    externalChecks = {
      attempted: probe.attempted,
      durationMs: probe.durationMs,
      warnings: probe.warnings,
      failures: probe.failures,
    };
    const agg = aggregateUrlProbeStatus(probe.results, false);
    if (agg.status === "FAIL" || agg.status === "WARNING") {
      warnings.push("masterpiece:image_url_probe_warning", ...agg.reasons.map((r) => `masterpiece:${r}`));
      const mp = deskReports.find((d) => d.desk === "masterpiece");
      if (mp && mp.status === "PASS") {
        mp.status = "WARNING";
      }
    }
  }

  let overallStatus: TechnicalValidationReport["overallStatus"] = "PASS";
  if (blockingFailures.length) {
    overallStatus = "FAIL";
  } else if (warnings.length) {
    overallStatus = "WARNING";
  }

  const completedAt = new Date().toISOString();
  return {
    version: EDITION_VALIDATION_VERSION,
    startedAt,
    completedAt,
    durationMs: Math.round(performance.now() - t0),
    enforcing: input.enforcing,
    overallStatus,
    deskReports,
    blockingFailures,
    warnings,
    externalChecks,
    completeness: {
      complete: completeness.complete,
      reasons: completeness.reasons,
    },
  };
}

export async function loadEditionValidationSnapshot(
  admin: SupabaseClient,
  input: {
    editionId: string;
    editionDate: string;
    metroKey: string;
    userId: string;
  }
): Promise<EditionValidationSnapshot | null> {
  const { data: edition, error } = await admin
    .from("editions")
    .select(
      "id, status, discovery, lead_story, national_news, us_national_daily_id, morning_edition, history_around_town, bandit, editorial_context, metro_key, edition_date, user_id"
    )
    .eq("id", input.editionId)
    .maybeSingle();

  if (error || !edition) return null;
  if (edition.metro_key !== input.metroKey) return null;

  const { data: sections } = await admin
    .from("edition_sections")
    .select("section_type, headline, body")
    .eq("edition_id", input.editionId);

  const { data: cityArticle } = await admin
    .from("kindred_city_articles")
    .select("metro_key")
    .eq("metro_key", input.metroKey)
    .eq("approval_status", "approved")
    .maybeSingle();

  return {
    editionId: edition.id,
    editionDate: input.editionDate,
    metroKey: input.metroKey,
    userId: input.userId,
    editionStatus: edition.status,
    sections: sections ?? [],
    discovery: parseDiscoveryPayload(edition.discovery),
    leadStory: edition.lead_story as LeadStory | null,
    nationalNews: edition.national_news,
    usNationalDailyId: edition.us_national_daily_id ?? null,
    morningEdition: edition.morning_edition,
    historyAroundTown: edition.history_around_town,
    bandit: edition.bandit,
    editorialContext:
      edition.editorial_context && typeof edition.editorial_context === "object"
        ? (edition.editorial_context as Record<string, unknown>)
        : null,
    expectStoryOf: Boolean(cityArticle?.metro_key),
  };
}

export async function runTechnicalValidation(
  admin: SupabaseClient,
  input: {
    editionId: string;
    editionDate: string;
    metroKey: string;
    userId: string;
    enforcing: boolean;
    skipExternalChecks?: boolean;
  }
): Promise<TechnicalValidationReport> {
  const snapshot = await loadEditionValidationSnapshot(admin, input);
  if (!snapshot) {
    const startedAt = new Date().toISOString();
    return {
      version: EDITION_VALIDATION_VERSION,
      startedAt,
      completedAt: startedAt,
      durationMs: 0,
      enforcing: input.enforcing,
      overallStatus: "FAIL",
      deskReports: [],
      blockingFailures: ["edition_snapshot_missing"],
      warnings: [],
      externalChecks: { attempted: 0, durationMs: 0, warnings: 0, failures: 0 },
    };
  }
  return runTechnicalValidationOnSnapshot({
    snapshot,
    enforcing: input.enforcing,
    editionDate: input.editionDate,
    skipExternalChecks: input.skipExternalChecks,
  });
}

export function isPublicationEligible(
  report: TechnicalValidationReport
): boolean {
  return report.overallStatus === "PASS" || report.overallStatus === "WARNING";
}

export function logTechnicalValidationReport(report: TechnicalValidationReport & {
  traceId?: string | null;
  editionId?: string;
  metroKey?: string;
  mode?: "dry_run" | "enforcing";
}): void {
  console.log(
    JSON.stringify({
      kind: "edition_technical_validation",
      traceId: report.traceId ?? null,
      editionId: report.editionId ?? null,
      metroKey: report.metroKey ?? null,
      mode: report.mode ?? (report.enforcing ? "enforcing" : "dry_run"),
      overallStatus: report.overallStatus,
      durationMs: report.durationMs,
      blockingFailures: report.blockingFailures,
      warnings: report.warnings,
      deskStatuses: report.deskReports.map((d) => ({ desk: d.desk, status: d.status })),
      externalChecks: report.externalChecks,
    })
  );
}
