/**
 * Staged edition build — one stage per Edge Function invocation.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  resolveEditionLocation,
  type BuildEditionOptions,
  getLocalEvents,
  buildLocalEventsBody,
  enrichEventsWithBanditNotes,
} from "../buildEdition.ts";
import { resolveEditionMarket } from "../markets/editionMarket.ts";
import {
  filterLocalEventsByMarket,
  filterPlacesByMarket,
} from "../markets/editionMarket.ts";
import { editionsConflictTarget } from "../markets/editionIdentity.ts";
import { catalogMetroKeyForMarket } from "../../../../lib/markets/resolveEditionMarket.ts";
import {
  EDITION_BUILD_STAGES,
  OPTIONAL_EDITION_BUILD_STAGES,
  type EditionBuildStage,
  isStageComplete,
  nextEditionBuildStage,
  parseEditionBuildStage,
} from "./editionBuildStages.ts";
import {
  HOMEPAGE_INITIAL_RENDER_COUNT,
  LOCAL_EVENTS_EDITION_SURFACED_MAX,
} from "../editorial/publishing.ts";
import {
  buildStageDiagnostic,
  logEditionBuildStageDiagnostic,
} from "./stageDiagnostics.ts";
import {
  estimateJsonBytes,
  upsertEditionSection,
  upsertEditionSections,
} from "./upsertEditionSection.ts";
import {
  loadUsNationalDailyForCityAttach,
  logNationalDailyAttachedToCity,
} from "../nationalDaily/resolveUsNationalDaily.ts";
import { generateUsNationalDailyForEditionDate } from "../nationalDaily/generateUsNationalDaily.ts";
import { logNationalNewsAttachedToCity } from "../nationalDaily/resolveNationalNews.ts";
import {
  fetchWeatherForecast,
  toLegacyWeatherPayload,
  weatherSourceAttribution,
  buildWeatherIntelligence,
} from "../weather/providers/index.ts";
import {
  formatWeatherSummary,
  resolveTemperatureUnit,
  type TemperatureUnitPreference,
} from "../weather/units.ts";
import { composeHeroWeatherTag } from "../weather/heroWeatherTag.ts";
import { getLocalPlacesForEdition } from "../places/index.ts";
import { allocateLocalEventsByHorizon } from "../localEvents/horizonAllocator.ts";
import { assertEventsVerifiedForPublication } from "../localEvents/eventDateVerification.ts";
import { surfaceLocalEventsForEdition } from "../localEvents/surfaceLocalEventsForEdition.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import { resolveEventTimezone } from "../localEvents/eventTimezone.ts";
import { runDiscoveryDecisions } from "../discovery/index.ts";
import type { DiscoveryPayload } from "../discovery/types.ts";
import { runLocalEditorialDecisions } from "../editor/index.ts";
import { enrichLocalNewsEditorial, buildUnenrichedLocalNews } from "../storyEditor/localNewsBriefing.ts";
import { loadRecentStoryKeys } from "../stories/recentStoryKeys.ts";
import { fetchApprovedCityArticle } from "../storyOf/library.ts";
import { cityArticleSourceNote } from "../storyOf/sourceNote.ts";
import { selectBanditsPick } from "../bandit/selectPick.ts";
import { generateBanditPayload } from "../bandit/index.ts";
import { loadBanditReaderProfile } from "../bandit/index.ts";
import { loadPersonalizationProfile } from "../personalization/index.ts";
import { assessMinimumViableEdition } from "./minimumViableEdition.ts";
import { triggerUserEditionJobWorker } from "./triggerUserEditionJobWorker.ts";
import type { RunUserGenerationJobInput } from "./runUserGenerationJob.ts";
import { filterFamilyFriendlyEvents } from "../localEvents/familyFriendlyFilter.ts";
import { filterEventsForLocalEventsDesk } from "./editionSectionOwnership.ts";
import { allocateDiscoverySections } from "../discovery/sectionAllocation.ts";
import { buildHistoryAroundTownForEdition } from "../historyAroundTown/library.ts";
import { isEditionEarlyPaintEnabled } from "./earlyPaintFeature.ts";
import {
  buildValidationStageDiagnostic,
  buildSectionRepairDiagnostic,
  persistValidationReport,
  persistRepairPlan,
  persistUnresolvedRepair,
  appendJobStageDiagnostic,
  recordOptionalStageFailure,
} from "./editionValidationPersistence.ts";
import { runPublishEditionStage, readLatestValidationReport } from "./publishEdition.ts";
import {
  logTechnicalValidationReport,
  runTechnicalValidation,
  type TechnicalValidationReport,
} from "./technicalValidation.ts";
import {
  mergeValidationIntoBuildState,
  readValidationFromBuildState,
} from "./editionValidationTypes.ts";
import { isBanditsPicksEnabled } from "../bandit/banditsPicksFeature.ts";
import {
  planSectionRepairs,
  isPublicationEligibleForRepairFlow,
} from "./sectionRepair.ts";

export type StagedBuildJobRow = {
  id: string;
  build_stage: string | null;
  completed_stages: string[] | null;
  attempts: number | null;
  edition_id: string | null;
  build_state: Record<string, unknown> | null;
};

export type StageRunResult =
  | {
      ok: true;
      editionId: string;
      stage: EditionBuildStage;
      done: boolean;
      triggeredNext: boolean;
      skipped?: boolean;
    }
  | { ok: false; error: string; stage: EditionBuildStage; optional: boolean };

type BuildState = {
  localEvents?: LocalEvent[];
  foodDrinkEventReroutes?: LocalEvent[];
  localPlaces?: unknown[];
  discovery?: DiscoveryPayload;
  editorial?: Awaited<ReturnType<typeof runLocalEditorialDecisions>>;
};

async function loadJob(
  admin: SupabaseClient,
  jobId: string
): Promise<StagedBuildJobRow | null> {
  const { data } = await admin
    .from("generation_jobs")
    .select("id, build_stage, completed_stages, attempts, edition_id, build_state")
    .eq("id", jobId)
    .maybeSingle();
  return (data as StagedBuildJobRow | null) ?? null;
}

function resolveStage(job: StagedBuildJobRow): EditionBuildStage {
  const fromJob = parseEditionBuildStage(job.build_stage ?? undefined);
  if (fromJob && !isStageComplete(job.completed_stages, fromJob)) {
    return fromJob;
  }
  for (const stage of EDITION_BUILD_STAGES) {
    if (!isStageComplete(job.completed_stages, stage)) return stage;
  }
  return "publish_edition";
}

async function maybeMarkEditionPaintable(
  admin: SupabaseClient,
  editionId: string
): Promise<boolean> {
  if (!isEditionEarlyPaintEnabled()) {
    return false;
  }
  const { data: edition } = await admin
    .from("editions")
    .select("status")
    .eq("id", editionId)
    .maybeSingle();
  if (edition?.status === "ready") return true;

  const { data: sections } = await admin
    .from("edition_sections")
    .select("section_type")
    .eq("edition_id", editionId);

  const mvp = assessMinimumViableEdition(sections ?? []);
  if (!mvp.paintable) return false;

  await admin.from("editions").update({ status: "ready" }).eq("id", editionId);
  return true;
}

async function completeStage(
  admin: SupabaseClient,
  input: {
    jobId: string;
    completedStage: EditionBuildStage;
    editionId: string;
    diagnostic: ReturnType<typeof buildStageDiagnostic>;
    buildState?: Record<string, unknown>;
  }
): Promise<EditionBuildStage | null> {
  const next = nextEditionBuildStage(input.completedStage);
  await admin.rpc("complete_edition_build_stage", {
    p_job_id: input.jobId,
    p_completed_stage: input.completedStage,
    p_next_stage: next,
    p_edition_id: input.editionId,
    p_diagnostic: input.diagnostic,
  });
  if (input.buildState) {
    await admin
      .from("generation_jobs")
      .update({ build_state: input.buildState })
      .eq("id", input.jobId);
  }
  return next;
}

async function runInitializeStage(
  admin: SupabaseClient,
  ctx: StageContext
): Promise<{ editionId: string; itemCount: number }> {
  const { data: edition, error } = await admin
    .from("editions")
    .upsert(
      {
        user_id: ctx.userId,
        edition_date: ctx.editionDate,
        metro_key: ctx.metroKey,
        status: "processing",
      },
      { onConflict: editionsConflictTarget() }
    )
    .select("id")
    .single();

  if (error || !edition?.id) {
    throw new Error(error?.message ?? "edition upsert failed");
  }
  return { editionId: edition.id as string, itemCount: 1 };
}

async function runGenerateNationalStage(
  admin: SupabaseClient,
  ctx: StageContext
): Promise<{ itemCount: number; payloadBytes: number }> {
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
  const newsApiKey = Deno.env.get("NEWS_API_KEY")?.trim();
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY missing — cannot generate national daily");
  }
  if (!newsApiKey) {
    throw new Error("NEWS_API_KEY missing — cannot generate national daily");
  }

  const national = await generateUsNationalDailyForEditionDate(admin, {
    editionDate: ctx.editionDate,
    editionTraceId: ctx.traceId,
    anthropicApiKey,
    newsApiKey,
  });

  const payloadBytes = estimateJsonBytes({
    masterpiece: national.todayMasterpiece,
    history: national.todayInHistory,
    nationalNews: national.nationalNews,
  });

  return { itemCount: 3, payloadBytes };
}

async function runAttachNationalStage(
  admin: SupabaseClient,
  ctx: StageContext
): Promise<{ itemCount: number; payloadBytes: number }> {
  const national = await loadUsNationalDailyForCityAttach(
    admin,
    ctx.editionDate,
    ctx.traceId
  );
  if (!national) {
    throw new Error(
      "Shared U.S. national daily not ready — generate_national_daily must succeed before city attach"
    );
  }

  const morningHero = national.todayMasterpiece?.presentation ?? null;
  const patch: Record<string, unknown> = {
    us_national_daily_id: national.id,
    national_news: national.nationalNews,
    morning_edition: morningHero
      ? {
          morningHero,
          heroArtworkId: national.todayMasterpiece?.artworkId ?? null,
        }
      : null,
  };

  const { error } = await admin
    .from("editions")
    .update(patch)
    .eq("id", ctx.editionId);
  if (error) throw new Error(error.message);

  if (national.todayInHistory) {
    await upsertEditionSection(admin, {
      edition_id: ctx.editionId,
      section_type: "today_in_history",
      position: 4,
      headline: national.todayInHistory.headline,
      body: national.todayInHistory.body,
      source_note: national.todayInHistory.sourceNote,
    });
    console.log("[todayInHistory:sync]", {
      step: "edition_generation",
      traceId: ctx.traceId,
      editionId: ctx.editionId,
      editionDate: ctx.editionDate,
      usNationalDailyId: national.id,
      articleYear: national.todayInHistory.year,
      headline: national.todayInHistory.headline,
      imageUrl: national.todayInHistory.image?.url ?? null,
      imageResolvedAt: national.todayInHistory.image?.resolvedAt ?? null,
    });
  }

  logNationalDailyAttachedToCity({
    traceId: ctx.traceId,
    editionDate: ctx.editionDate,
    nationalDailyId: national.id,
    metroKey: ctx.metroKey,
    masterpieceArtworkId: national.todayMasterpiece?.artworkId ?? null,
  });
  if (national.nationalNews) {
    logNationalNewsAttachedToCity({
      traceId: ctx.traceId,
      editionDate: ctx.editionDate,
      nationalDailyId: national.id,
      packageId: national.nationalNews.packageId,
      metroKey: ctx.metroKey,
      storyCount: national.nationalNews.stories.length,
    });
  }

  await maybeMarkEditionPaintable(admin, ctx.editionId);

  return {
    itemCount: national.nationalNews?.stories.length ?? 0,
    payloadBytes: estimateJsonBytes(patch),
  };
}

async function runWeatherStage(
  admin: SupabaseClient,
  ctx: StageContext
): Promise<{ itemCount: number; payloadBytes: number }> {
  const forecast = await fetchWeatherForecast(
    ctx.location.lat,
    ctx.location.lon,
    admin
  );
  const weather = toLegacyWeatherPayload(forecast);
  const conditionCode =
    weather?.current?.weather_code ?? weather?.daily?.weather_code?.[0] ?? null;
  const summary = formatWeatherSummary({
    city: ctx.location.city,
    currentC: weather?.current?.temperature_2m ?? null,
    highC: weather?.daily?.temperature_2m_max?.[0] ?? null,
    lowC: weather?.daily?.temperature_2m_min?.[0] ?? null,
    unit: ctx.tempUnit,
    conditionCode,
  });
  const intel = buildWeatherIntelligence(forecast, summary);
  const tag = composeHeroWeatherTag({
    editionDate: ctx.editionDate,
    userId: ctx.userId,
    highC: weather?.daily?.temperature_2m_max?.[0] ?? null,
    currentC: weather?.current?.temperature_2m ?? null,
    conditionCode,
    unit: ctx.tempUnit,
  });
  const attribution = weatherSourceAttribution(forecast);

  await upsertEditionSection(admin, {
    edition_id: ctx.editionId,
    section_type: "weather",
    position: 1,
    headline: tag,
    body: summary,
    source_note: attribution,
  });

  const { data: existingEdition } = await admin
    .from("editions")
    .select("editorial_context")
    .eq("id", ctx.editionId)
    .maybeSingle();
  const prevContext =
    existingEdition?.editorial_context &&
    typeof existingEdition.editorial_context === "object"
      ? (existingEdition.editorial_context as Record<string, unknown>)
      : {};

  await admin
    .from("editions")
    .update({
      editorial_context: {
        ...prevContext,
        weatherSummary: summary,
        weatherIntel: intel,
      },
    })
    .eq("id", ctx.editionId);

  await maybeMarkEditionPaintable(admin, ctx.editionId);

  return { itemCount: 1, payloadBytes: estimateJsonBytes({ summary, tag }) };
}

async function runLocalEventsStage(
  admin: SupabaseClient,
  ctx: StageContext,
  buildState: BuildState
): Promise<{ localEvents: LocalEvent[]; itemCount: number; payloadBytes: number }> {
  const eventsLocation = ctx.location;
  const eventTimezone = resolveEventTimezone(eventsLocation);
  const editionDateObj = new Date(
    Number(ctx.editionDate.slice(0, 4)),
    Number(ctx.editionDate.slice(5, 7)) - 1,
    Number(ctx.editionDate.slice(8, 10))
  );

  let raw = await getLocalEvents(eventsLocation, {
    admin,
    catalogMetroKey: ctx.catalogMetroKey,
    editionDate: ctx.editionDate,
    timezone: eventTimezone,
  });

  if (ctx.editionMarket) {
    raw = filterLocalEventsByMarket(raw, ctx.editionMarket, ctx.marketAnchor).kept;
  }

  const familyFiltered = filterFamilyFriendlyEvents(raw);
  if (familyFiltered.filteredCount > 0) {
    console.log("[runStagedEditionBuild] local_events family filter", {
      traceId: ctx.traceId,
      filteredCount: familyFiltered.filteredCount,
      samples: familyFiltered.samples,
    });
  }

  const owned = filterEventsForLocalEventsDesk(familyFiltered.kept);
  if (owned.reroutedFood.length > 0 || owned.excluded.length > 0) {
    console.log("[runStagedEditionBuild] local_events desk ownership", {
      traceId: ctx.traceId,
      kept: owned.kept.length,
      reroutedFood: owned.reroutedFood.length,
      excluded: owned.excluded.length,
      reroutedSamples: owned.reroutedFood.slice(0, 3).map((e) => e.name),
    });
  }

  const allocated = allocateLocalEventsByHorizon(owned.kept, {
    maxTotal: LOCAL_EVENTS_EDITION_SURFACED_MAX,
    now: editionDateObj,
    readerCity: ctx.location.city,
    readerLat: ctx.location.lat,
    readerLon: ctx.location.lon,
  });

  const reservePool = owned.kept.filter(
    (candidate) =>
      !allocated.some(
        (picked) =>
          `${picked.name}|${picked.startDateTime}`.toLowerCase() ===
          `${candidate.name}|${candidate.startDateTime}`.toLowerCase()
      )
  );

  let publishable: LocalEvent[] = [];
  if (allocated.length > 0) {
    publishable = await surfaceLocalEventsForEdition(allocated, reservePool, {
      editionDate: ctx.editionDate,
      allowAiEnrichment: Boolean(Deno.env.get("ANTHROPIC_API_KEY")),
      homepageMinimum: HOMEPAGE_INITIAL_RENDER_COUNT,
      now: editionDateObj,
      readerCity: ctx.location.city,
      readerLat: ctx.location.lat,
      readerLon: ctx.location.lon,
    });
  }

  publishable = assertEventsVerifiedForPublication(publishable, {
    now: new Date(),
    location: eventsLocation,
    eventTimezone,
    editionDate: ctx.editionDate,
  });

  if (publishable.length > 0) {
    await upsertEditionSection(admin, {
      edition_id: ctx.editionId,
      section_type: "local_events",
      position: 3,
      headline: "A Few Things Happening Around Town",
      body: buildLocalEventsBody(publishable, { editionCity: ctx.location.city }),
      source_note: "Curated from trusted local event sources",
    });
    await maybeMarkEditionPaintable(admin, ctx.editionId);
  }

  buildState.localEvents = publishable;
  buildState.foodDrinkEventReroutes = owned.reroutedFood;
  return {
    localEvents: publishable,
    itemCount: publishable.length,
    payloadBytes: estimateJsonBytes(publishable),
  };
}

async function runActivitiesStage(
  admin: SupabaseClient,
  ctx: StageContext,
  buildState: BuildState
): Promise<{ discovery: DiscoveryPayload; itemCount: number; payloadBytes: number }> {
  if (!buildState.localPlaces) {
    let places = await getLocalPlacesForEdition(admin, ctx.location, {
      catalogMetroKey: ctx.catalogMetroKey,
    });
    if (ctx.editionMarket) {
      places = filterPlacesByMarket(places, ctx.editionMarket, ctx.marketAnchor).kept;
    }
    buildState.localPlaces = places;
  }

  const localEventsForDiscovery = (buildState.localEvents ?? []).filter(
    (event) =>
      filterEventsForLocalEventsDesk([event]).kept.length > 0
  );

  const personalization = await loadPersonalizationProfile(admin, ctx.userId, ctx.location);
  const discovery = runDiscoveryDecisions({
    editionDate: ctx.editionDate,
    now: new Date(),
    city: ctx.location.city,
    region: ctx.location.region,
    state: ctx.location.state,
    readerLat: ctx.location.lat,
    readerLon: ctx.location.lon,
    interests: personalization.interests,
    followedTopics: personalization.followedTopics,
    favoriteSources: personalization.favoriteSources,
    weatherSummary: null,
    weatherIntel: null,
    npsParks: [],
    isWeekend: false,
    isSunday: false,
    localEvents: localEventsForDiscovery,
    localPlaces: buildState.localPlaces as Parameters<
      typeof runDiscoveryDecisions
    >[0]["localPlaces"],
    recentKeys: [],
  });

  buildState.discovery = discovery;
  await admin
    .from("editions")
    .update({ discovery })
    .eq("id", ctx.editionId);

  const activityCount = discovery.picks.filter((p) => p.category === "activities").length;
  return {
    discovery,
    itemCount: activityCount,
    payloadBytes: estimateJsonBytes(discovery),
  };
}

async function runFoodDrinksStage(
  admin: SupabaseClient,
  ctx: StageContext,
  buildState: BuildState
): Promise<{ itemCount: number; payloadBytes: number }> {
  let discovery = buildState.discovery;
  if (!discovery) {
    if (!buildState.localPlaces) {
      let places = await getLocalPlacesForEdition(admin, ctx.location, {
        catalogMetroKey: ctx.catalogMetroKey,
      });
      if (ctx.editionMarket) {
        places = filterPlacesByMarket(places, ctx.editionMarket, ctx.marketAnchor).kept;
      }
      buildState.localPlaces = places;
    }

    const personalization = await loadPersonalizationProfile(admin, ctx.userId, ctx.location);
    discovery = runDiscoveryDecisions({
      editionDate: ctx.editionDate,
      now: new Date(),
      city: ctx.location.city,
      region: ctx.location.region,
      state: ctx.location.state,
      readerLat: ctx.location.lat,
      readerLon: ctx.location.lon,
      interests: personalization.interests,
      followedTopics: personalization.followedTopics,
      favoriteSources: personalization.favoriteSources,
      weatherSummary: null,
      weatherIntel: null,
      npsParks: [],
      isWeekend: false,
      isSunday: false,
      localEvents: (buildState.localEvents ?? []).filter(
        (event) => filterEventsForLocalEventsDesk([event]).kept.length > 0
      ),
      localPlaces: buildState.localPlaces as Parameters<
        typeof runDiscoveryDecisions
      >[0]["localPlaces"],
      recentKeys: [],
    });
    buildState.discovery = discovery;
  }

  const allocation = allocateDiscoverySections(discovery);
  const foodItems = allocation.recommendations;

  if (foodItems.length > 0) {
    await upsertEditionSection(admin, {
      edition_id: ctx.editionId,
      section_type: "food_drinks",
      position: 6,
      headline: "Food & Drink",
      body: JSON.stringify({
        version: 1,
        items: foodItems.map((item) => ({
          id: item.item.id,
          title: item.item.title,
          category: item.item.category,
          score: item.score,
        })),
      }),
      source_note: "Kindred Food & Drink desk",
    });
  }

  await admin.from("editions").update({ discovery }).eq("id", ctx.editionId);

  return {
    itemCount: foodItems.length,
    payloadBytes: estimateJsonBytes({ discovery, foodItems }),
  };
}

async function attachHistoryAroundTownToEdition(
  admin: SupabaseClient,
  ctx: StageContext
): Promise<{ placeCount: number; carouselCount: number; payloadBytes: number }> {
  let historyAroundTown = null;
  try {
    historyAroundTown = await buildHistoryAroundTownForEdition(admin, {
      city: ctx.location.city,
      state: ctx.location.state,
      region: ctx.location.region,
      lat: ctx.location.lat,
      lon: ctx.location.lon,
    });
  } catch (err) {
    console.warn("[historyAroundTown:staged] attach failed", {
      editionId: ctx.editionId,
      metroKey: ctx.metroKey,
      message: err instanceof Error ? err.message : String(err),
    });
    return { placeCount: 0, carouselCount: 0, payloadBytes: 0 };
  }

  if (!historyAroundTown) {
    console.warn("[historyAroundTown:staged] no approved places", {
      editionId: ctx.editionId,
      metroKey: ctx.metroKey,
      city: ctx.location.city,
    });
    return { placeCount: 0, carouselCount: 0, payloadBytes: 0 };
  }

  const serialized = JSON.parse(JSON.stringify(historyAroundTown));
  const { error } = await admin
    .from("editions")
    .update({ history_around_town: serialized })
    .eq("id", ctx.editionId);
  if (error) throw new Error(error.message);

  console.log("[historyAroundTown:staged] attached", {
    editionId: ctx.editionId,
    metroKey: historyAroundTown.metroKey,
    places: historyAroundTown.places.length,
    carousel: historyAroundTown.carousel.length,
  });

  return {
    placeCount: historyAroundTown.places.length,
    carouselCount: historyAroundTown.carousel.length,
    payloadBytes: estimateJsonBytes(serialized),
  };
}

async function runStoryOfStage(
  admin: SupabaseClient,
  ctx: StageContext
): Promise<{ itemCount: number; payloadBytes: number }> {
  const historyAroundTown = await attachHistoryAroundTownToEdition(admin, ctx);

  const article = await fetchApprovedCityArticle(admin, ctx.location);
  if (!article) {
    await maybeMarkEditionPaintable(admin, ctx.editionId);
    return {
      itemCount: historyAroundTown.placeCount > 0 ? 1 : 0,
      payloadBytes: historyAroundTown.payloadBytes,
    };
  }

  await upsertEditionSection(admin, {
    edition_id: ctx.editionId,
    section_type: "story_of",
    position: 5,
    headline: article.headline,
    body: article.body,
    source_note: cityArticleSourceNote(article),
  });
  await maybeMarkEditionPaintable(admin, ctx.editionId);

  return {
    itemCount: 1 + (historyAroundTown.placeCount > 0 ? 1 : 0),
    payloadBytes:
      estimateJsonBytes(article.body) + historyAroundTown.payloadBytes,
  };
}

async function runBanditsPickStage(
  admin: SupabaseClient,
  ctx: StageContext,
  buildState: BuildState
): Promise<{ itemCount: number; payloadBytes: number }> {
  const editorial = buildState.editorial;
  const discovery = buildState.discovery;
  if (!editorial || !discovery) {
    return { itemCount: 0, payloadBytes: 0 };
  }

  const personalization = await loadPersonalizationProfile(admin, ctx.userId, ctx.location);
  const reader = await loadBanditReaderProfile(admin, ctx.userId);
  const pickStory = selectBanditsPick({
    scored: editorial.frontPage.scoredCandidates ?? [],
    leadId: editorial.leadStory?.id ?? null,
    frontPageIds: editorial.frontPage.stories.map((s) => s.story.id),
    interests: personalization.interests,
    recentKeys: [],
    localEvents: (buildState.localEvents ?? []).filter(
      (event) => filterEventsForLocalEventsDesk([event]).kept.length > 0
    ),
    discovery: {
      editionDate: ctx.editionDate,
      now: new Date(),
      city: ctx.location.city,
      region: ctx.location.region,
      state: ctx.location.state,
      readerLat: ctx.location.lat,
      readerLon: ctx.location.lon,
      interests: personalization.interests,
      followedTopics: personalization.followedTopics,
      favoriteSources: personalization.favoriteSources,
      weatherSummary: null,
      weatherIntel: null,
      npsParks: [],
      isWeekend: false,
      isSunday: false,
      localPlaces: buildState.localPlaces as Parameters<
        typeof runDiscoveryDecisions
      >[0]["localPlaces"],
      recentKeys: [],
    },
  });

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  let banditPayload = null;
  if (anthropicApiKey) {
    banditPayload = await generateBanditPayload(
      {
        editionDate: ctx.editionDate,
        now: new Date(),
        userId: ctx.userId,
        reader,
        location: {
          city: ctx.location.city,
          region: ctx.location.region,
          state: ctx.location.state,
        },
        weatherSummary: null,
        weather: { currentTempC: null },
        planningNote: null,
        signals: {},
        editorBrief: null,
        personalization: { favoriteSources: [], confidence: 0 },
        discoveryBrief: discovery.editorBrief,
        discoveryPicks: discovery.picks.map((p) => ({
          title: p.title,
          category: p.category,
          why: p.why,
        })),
        pick: pickStory,
      },
      anthropicApiKey
    );
  }

  await admin
    .from("editions")
    .update({
      bandit: banditPayload,
    })
    .eq("id", ctx.editionId);

  return {
    itemCount: pickStory ? 1 : 0,
    payloadBytes: estimateJsonBytes(banditPayload),
  };
}

async function runLocalNewsStage(
  admin: SupabaseClient,
  ctx: StageContext,
  buildState: BuildState
): Promise<{ itemCount: number; payloadBytes: number }> {
  const newsApiKey = Deno.env.get("NEWS_API_KEY");
  if (!newsApiKey) {
    // Optional stage will record this failure — never silently "succeed" empty.
    throw new Error("NEWS_API_KEY missing — Local News desk cannot run");
  }

  const [personalization, recentStoryKeys] = await Promise.all([
    loadPersonalizationProfile(admin, ctx.userId, ctx.location),
    loadRecentStoryKeys(admin, ctx.userId, {
      metroKey: ctx.metroKey,
      excludeEditionDate: ctx.editionDate,
    }),
  ]);
  const editorial = await runLocalEditorialDecisions({
    editionDate: ctx.editionDate,
    newsApiKey,
    ranking: {
      interests: personalization.interests,
      followedTopics: personalization.followedTopics,
      city: ctx.location.city,
      region: ctx.location.region,
      state: ctx.location.state,
      metroKey: ctx.metroKey,
      now: new Date(),
      maxStories: 4,
      recentStoryKeys,
      personalization: {
        favoriteSources: personalization.affinities.favoriteSources,
        followedTopics: personalization.affinities.followedTopics,
        skippedTopics: personalization.affinities.skippedTopics,
        engagedStoryKeys: personalization.affinities.engagedStoryKeys,
        clippedStoryKeys: personalization.affinities.clippedStoryKeys,
        confidence: personalization.affinities.confidence,
      },
    },
  });
  console.log("[localNewsDesk] stage selection", {
    contentType: editorial.leadStory?.contentType ?? null,
    deskBadge: editorial.leadStory?.deskBadge ?? null,
    leadId: editorial.leadStory?.id ?? null,
    publishedAt: editorial.leadStory?.publishedAt ?? null,
  });

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  let enriched: Awaited<ReturnType<typeof enrichLocalNewsEditorial>>;
  try {
    enriched = await enrichLocalNewsEditorial({
      editorial,
      place: {
        city: ctx.location.city,
        region: ctx.location.region,
        state: ctx.location.state,
      },
      editionDate: ctx.editionDate,
      interests: personalization.interests,
      followedTopics: personalization.followedTopics,
      anthropicApiKey,
      recentStoryKeys,
      metroKey: ctx.metroKey,
    });
  } catch (err) {
    enriched = buildUnenrichedLocalNews({
      editorial,
      place: {
        city: ctx.location.city,
        region: ctx.location.region,
        state: ctx.location.state,
      },
      editionDate: ctx.editionDate,
      interests: personalization.interests,
      followedTopics: personalization.followedTopics,
      reason: err instanceof Error ? err.message : String(err),
      recentStoryKeys,
      metroKey: ctx.metroKey,
    });
  }
  console.log("[localNewsDesk] enriched lead", {
    contentType: enriched.leadStory?.contentType ?? null,
    deskBadge: enriched.leadStory?.deskBadge ?? null,
    leadId: enriched.leadStory?.id ?? null,
  });

  buildState.editorial = {
    ...editorial,
    leadStory: enriched.leadStory,
  };

  const { data: existingEdition } = await admin
    .from("editions")
    .select("editorial_context")
    .eq("id", ctx.editionId)
    .maybeSingle();
  const prevContext =
    existingEdition?.editorial_context &&
    typeof existingEdition.editorial_context === "object"
      ? (existingEdition.editorial_context as Record<string, unknown>)
      : {};

  await admin
    .from("editions")
    .update({
      // Always persist lead_story from the local desk (null clears a stale lead).
      lead_story: enriched.leadStory,
      editorial_context: {
        ...prevContext,
        ...enriched.editorialContext,
        ...(typeof prevContext.weatherSummary === "string"
          ? { weatherSummary: prevContext.weatherSummary }
          : {}),
        ...(prevContext.weatherIntel != null
          ? { weatherIntel: prevContext.weatherIntel }
          : {}),
      },
    })
    .eq("id", ctx.editionId);

  return {
    itemCount: enriched.deskStories.length,
    payloadBytes: estimateJsonBytes(enriched.editorialContext),
  };
}

async function runValidateTechnicalStage(
  admin: SupabaseClient,
  ctx: StageContext,
  buildState: BuildState
): Promise<{ report: Awaited<ReturnType<typeof runTechnicalValidation>>; buildState: Record<string, unknown> }> {
  const report = await runTechnicalValidation(admin, {
    editionId: ctx.editionId,
    editionDate: ctx.editionDate,
    metroKey: ctx.metroKey,
    userId: ctx.userId,
    enforcing: true,
  });

  logTechnicalValidationReport({
    ...report,
    editionId: ctx.editionId,
    metroKey: ctx.metroKey,
    traceId: ctx.traceId,
    mode: "enforcing",
  });

  const mergedBuildState = await persistValidationReport(admin, {
    jobId: ctx.jobId,
    buildState: buildState as Record<string, unknown>,
    report,
  });

  return { report, buildState: mergedBuildState };
}

async function attemptSectionRepair(
  admin: SupabaseClient,
  ctx: StageContext,
  buildState: BuildState,
  report: TechnicalValidationReport,
  workerInput: RunUserGenerationJobInput & { jobId: string }
): Promise<
  | { outcome: "requeued"; buildState: Record<string, unknown>; plan: ReturnType<typeof planSectionRepairs> }
  | { outcome: "unresolved"; buildState: Record<string, unknown>; error: string; plan: ReturnType<typeof planSectionRepairs> }
> {
  const validationState = readValidationFromBuildState(buildState as Record<string, unknown>);
  const plan = planSectionRepairs(report, validationState, {
    banditsPickEnabled: isBanditsPicksEnabled(),
  });

  if (!plan.allowed || plan.stages.length === 0) {
    const merged = await persistUnresolvedRepair(admin, {
      jobId: ctx.jobId,
      buildState: buildState as Record<string, unknown>,
      plan,
      report,
    });
    await appendJobStageDiagnostic(admin, {
      jobId: ctx.jobId,
      diagnostic: buildSectionRepairDiagnostic({
        traceId: ctx.traceId,
        plan,
        report,
        requeued: false,
      }),
    });
    return {
      outcome: "unresolved",
      buildState: merged,
      plan,
      error: `validate_technical failed: ${report.blockingFailures.join(", ") || report.overallStatus} — ${plan.unresolvedReason ?? "repair_not_allowed"}`,
    };
  }

  const merged = await persistRepairPlan(admin, {
    jobId: ctx.jobId,
    buildState: buildState as Record<string, unknown>,
    plan,
    report,
  });

  const { error: requeueError } = await admin.rpc("requeue_edition_build_stages", {
    p_job_id: ctx.jobId,
    p_stages: plan.stages,
  });
  if (requeueError) {
    throw new Error(`requeue_edition_build_stages failed: ${requeueError.message}`);
  }

  await appendJobStageDiagnostic(admin, {
    jobId: ctx.jobId,
    diagnostic: buildSectionRepairDiagnostic({
      traceId: ctx.traceId,
      plan,
      report,
      requeued: true,
    }),
  });

  console.log(
    JSON.stringify({
      kind: "edition_section_repair_requeued",
      editionId: ctx.editionId,
      metroKey: ctx.metroKey,
      traceId: ctx.traceId,
      stages: plan.stages,
      stageReasons: plan.stageReasons,
      repairAttempts: readValidationFromBuildState(merged)?.repairAttempts ?? {},
    })
  );

  triggerUserEditionJobWorker(workerInput);

  return { outcome: "requeued", buildState: merged, plan };
}

async function runPublishEditionStageWrapper(
  admin: SupabaseClient,
  ctx: StageContext,
  buildState: BuildState
): Promise<{ itemCount: number; buildState: Record<string, unknown> }> {
  const validationReport = readLatestValidationReport(buildState as Record<string, unknown>);
  if (!validationReport) {
    throw new Error("publish_edition blocked: missing validation report");
  }

  const result = await runPublishEditionStage(admin, {
    jobId: ctx.jobId,
    editionId: ctx.editionId,
    userId: ctx.userId,
    editionDate: ctx.editionDate,
    metroKey: ctx.metroKey,
    traceId: ctx.traceId,
    buildState: buildState as Record<string, unknown>,
    validationReport,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return {
    itemCount: validationReport.deskReports.length,
    buildState: mergeValidationIntoBuildState({}, result.preservedValidation),
  };
}

type StageContext = {
  jobId: string;
  userId: string;
  editionDate: string;
  metroKey: string;
  editionId: string;
  traceId: string | null;
  location: {
    city: string;
    region: string | null;
    state: string | null;
    lat: number;
    lon: number;
  };
  editionMarket: NonNullable<ReturnType<typeof resolveEditionMarket>>;
  catalogMetroKey: string;
  marketAnchor: { lat: number; lon: number; city: string; state: string | null };
  tempUnit: ReturnType<typeof resolveTemperatureUnit>;
};

async function buildStageContext(
  admin: SupabaseClient,
  input: RunUserGenerationJobInput & { jobId: string; job: StagedBuildJobRow },
  opts?: { requireEdition?: boolean }
): Promise<StageContext | { error: string }> {
  const requireEdition = opts?.requireEdition ?? true;
  const location = await resolveEditionLocation(
    admin,
    input.userId,
    input.locationHint ?? null
  );
  if (!location) {
    return { error: "No location set. Choose a home city or enable current location." };
  }

  const editionMarket = resolveEditionMarket(location);
  if (!editionMarket || editionMarket.metroKey !== input.metroKey) {
    return { error: "Location/market mismatch for staged build" };
  }

  let editionId = input.job.edition_id;
  if (!editionId) {
    const { data } = await admin
      .from("editions")
      .select("id")
      .eq("user_id", input.userId)
      .eq("edition_date", input.editionDate)
      .eq("metro_key", input.metroKey)
      .maybeSingle();
    editionId = data?.id ?? null;
  }
  if (!editionId && requireEdition) {
    return { error: "Edition row missing — run initialize_edition first" };
  }
  if (!editionId) {
    return { error: "Edition row missing" };
  }

  const tempUnit = resolveTemperatureUnit(input.temperatureUnitPreference ?? "auto", {
    state: location.state,
    region: location.region,
  });

  return {
    jobId: input.jobId,
    userId: input.userId,
    editionDate: input.editionDate,
    metroKey: input.metroKey,
    editionId,
    traceId: input.editionTraceId ?? null,
    location,
    editionMarket,
    catalogMetroKey: catalogMetroKeyForMarket(editionMarket),
    marketAnchor: {
      lat: location.lat,
      lon: location.lon,
      city: location.city,
      state: location.state ?? null,
    },
    tempUnit,
  };
}

export async function runEditionBuildStage(
  admin: SupabaseClient,
  input: RunUserGenerationJobInput & { jobId: string }
): Promise<StageRunResult> {
  const job = await loadJob(admin, input.jobId);
  if (!job) {
    return { ok: false, error: "Job not found", stage: "initialize_edition", optional: false };
  }

  const stage = resolveStage(job);
  const optional = OPTIONAL_EDITION_BUILD_STAGES.has(stage);
  const started = performance.now();

  await admin
    .from("generation_jobs")
    .update({
      build_stage: stage,
      stage_started_at: new Date().toISOString(),
    })
    .eq("id", input.jobId);

  const buildState: BuildState = {
    ...(job.build_state as BuildState | null),
  };

  let ctx: StageContext | null = null;
  if (stage !== "initialize_edition") {
    const ctxResult = await buildStageContext(admin, { ...input, job });
    if ("error" in ctxResult) {
      return { ok: false, error: ctxResult.error, stage, optional: false };
    }
    ctx = ctxResult;
  }

  try {
    let itemCount = 0;
    let payloadBytes = 0;
    let editionId = job.edition_id ?? ctx?.editionId ?? "";
    let lastValidationReport: TechnicalValidationReport | null = null;

    switch (stage) {
      case "initialize_edition": {
        const location = await resolveEditionLocation(
          admin,
          input.userId,
          input.locationHint ?? null
        );
        if (!location) {
          throw new Error(
            "No location set. Choose a home city or enable current location."
          );
        }
        const editionMarket = resolveEditionMarket(location);
        if (!editionMarket || editionMarket.metroKey !== input.metroKey) {
          throw new Error("Location/market mismatch for staged build");
        }
        const tempUnit = resolveTemperatureUnit(
          input.temperatureUnitPreference ?? "auto",
          { state: location.state, region: location.region }
        );
        const initCtx: StageContext = {
          jobId: input.jobId,
          userId: input.userId,
          editionDate: input.editionDate,
          metroKey: input.metroKey,
          editionId: "",
          traceId: input.editionTraceId ?? null,
          location,
          editionMarket,
          catalogMetroKey: catalogMetroKeyForMarket(editionMarket),
          marketAnchor: {
            lat: location.lat,
            lon: location.lon,
            city: location.city,
            state: location.state ?? null,
          },
          tempUnit,
        };
        const init = await runInitializeStage(admin, initCtx);
        editionId = init.editionId;
        itemCount = init.itemCount;
        break;
      }
      case "generate_national_daily": {
        const r = await runGenerateNationalStage(admin, ctx!);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        break;
      }
      case "attach_national_daily": {
        const r = await runAttachNationalStage(admin, ctx!);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        break;
      }
      case "weather": {
        const r = await runWeatherStage(admin, ctx!);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        break;
      }
      case "local_events": {
        const r = await runLocalEventsStage(admin, ctx!, buildState);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        break;
      }
      case "activities": {
        const r = await runActivitiesStage(admin, ctx!, buildState);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        break;
      }
      case "food_drinks": {
        const r = await runFoodDrinksStage(admin, ctx!, buildState);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        break;
      }
      case "story_of": {
        const r = await runStoryOfStage(admin, ctx!);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        break;
      }
      case "local_news": {
        const r = await runLocalNewsStage(admin, ctx!, buildState);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        break;
      }
      case "bandits_pick": {
        const r = await runBanditsPickStage(admin, ctx!, buildState);
        itemCount = r.itemCount;
        payloadBytes = r.payloadBytes;
        if (ctx && Deno.env.get("EDITION_VALIDATION_DRY_RUN_AT_GENERATION_END") === "true") {
          const dryReport = await runTechnicalValidation(admin, {
            editionId: ctx.editionId,
            editionDate: ctx.editionDate,
            metroKey: ctx.metroKey,
            userId: ctx.userId,
            enforcing: false,
            skipExternalChecks: true,
          });
          logTechnicalValidationReport({
            ...dryReport,
            editionId: ctx.editionId,
            metroKey: ctx.metroKey,
            traceId: ctx.traceId,
            mode: "dry_run",
          });
          const mergedDry = await persistValidationReport(admin, {
            jobId: ctx.jobId,
            buildState: buildState as Record<string, unknown>,
            report: { ...dryReport, enforcing: false },
          });
          Object.assign(buildState, mergedDry);
        }
        break;
      }
      case "validate_technical": {
        const r = await runValidateTechnicalStage(admin, ctx!, buildState);
        Object.assign(buildState, r.buildState);
        lastValidationReport = r.report;

        if (isPublicationEligibleForRepairFlow(r.report)) {
          itemCount = r.report.deskReports.length;
          payloadBytes = null;
          break;
        }

        const repair = await attemptSectionRepair(
          admin,
          ctx!,
          buildState,
          r.report,
          input
        );
        Object.assign(buildState, repair.buildState);

        if (repair.outcome === "requeued") {
          const diagnostic = buildStageDiagnostic({
            traceId: input.editionTraceId ?? null,
            stage,
            elapsedMs: Math.round(performance.now() - started),
            itemCount: r.report.deskReports.length,
            payloadBytes: null,
            success: true,
            retryCount: job.attempts ?? 0,
          });
          logEditionBuildStageDiagnostic({
            ...diagnostic,
            sectionRepairRequeued: true,
            repairStages: repair.plan.stages,
          });
          return {
            ok: true,
            editionId: ctx!.editionId,
            stage,
            done: false,
            triggeredNext: true,
          };
        }

        throw new Error(repair.error);
      }
      case "publish_edition": {
        lastValidationReport =
          readLatestValidationReport(buildState as Record<string, unknown>) ?? null;
        const r = await runPublishEditionStageWrapper(admin, ctx!, buildState);
        Object.assign(buildState, r.buildState);
        itemCount = r.itemCount;
        break;
      }
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }

    const validationExtra =
      stage === "validate_technical" && lastValidationReport
        ? buildValidationStageDiagnostic({
            traceId: input.editionTraceId ?? null,
            report: lastValidationReport,
            publicationAllowed: isPublicationEligibleForRepairFlow(lastValidationReport),
          })
        : stage === "publish_edition" && lastValidationReport
          ? buildValidationStageDiagnostic({
              traceId: input.editionTraceId ?? null,
              report: lastValidationReport,
              publicationAllowed: true,
            })
          : stage === "publish_edition"
            ? buildValidationStageDiagnostic({
                traceId: input.editionTraceId ?? null,
                report: readLatestValidationReport(buildState as Record<string, unknown>)!,
                publicationAllowed: true,
              })
            : null;

    const diagnostic = buildStageDiagnostic({
      traceId: input.editionTraceId ?? null,
      stage,
      elapsedMs: Math.round(performance.now() - started),
      itemCount,
      payloadBytes,
      success: true,
      retryCount: job.attempts ?? 0,
    });
    logEditionBuildStageDiagnostic(diagnostic);

    if (stage === "publish_edition") {
      await completeStage(admin, {
        jobId: input.jobId,
        completedStage: stage,
        editionId,
        diagnostic: validationExtra
          ? { ...diagnostic, ...(validationExtra as Record<string, unknown>) }
          : diagnostic,
        buildState: buildState as Record<string, unknown>,
      });
      return {
        ok: true,
        editionId,
        stage,
        done: true,
        triggeredNext: false,
      };
    }

    const next = await completeStage(admin, {
      jobId: input.jobId,
      completedStage: stage,
      editionId,
      diagnostic: validationExtra
        ? { ...diagnostic, ...(validationExtra as Record<string, unknown>) }
        : diagnostic,
      buildState: buildState as Record<string, unknown>,
    });

    if (next) {
      triggerUserEditionJobWorker(input);
    }

    return {
      ok: true,
      editionId,
      stage,
      done: false,
      triggeredNext: Boolean(next),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const diagnostic = buildStageDiagnostic({
      traceId: input.editionTraceId ?? null,
      stage,
      elapsedMs: Math.round(performance.now() - started),
      success: false,
      failure: message,
      retryCount: job.attempts ?? 0,
    });
    logEditionBuildStageDiagnostic(diagnostic);

    if (optional) {
      const failureBuildState = await recordOptionalStageFailure(admin, {
        jobId: input.jobId,
        buildState: {
          ...(job.build_state as Record<string, unknown> | null),
          ...(buildState as Record<string, unknown>),
        },
        record: {
          stage,
          failureType: "optional_stage_error",
          errorSummary: message.slice(0, 500),
          attemptNumber: job.attempts ?? 0,
          markedComplete: true,
          eligibleForValidation: true,
          at: new Date().toISOString(),
        },
      });
      const optionalDiagnostic = {
        ...diagnostic,
        optionalStageFailure: true,
        optionalStageEligibleForValidation: true,
      };
      await admin.rpc("complete_edition_build_stage", {
        p_job_id: input.jobId,
        p_completed_stage: stage,
        p_next_stage: nextEditionBuildStage(stage),
        p_edition_id: job.edition_id,
        p_diagnostic: optionalDiagnostic,
      });
      await admin
        .from("generation_jobs")
        .update({ build_state: failureBuildState })
        .eq("id", input.jobId);
      triggerUserEditionJobWorker(input);
      return {
        ok: true,
        editionId: job.edition_id ?? "",
        stage,
        done: false,
        triggeredNext: true,
        skipped: true,
      };
    }

    await admin
      .from("generation_jobs")
      .update({
        status: "failed",
        last_error: message,
        stage_started_at: null,
      })
      .eq("id", input.jobId);

    return { ok: false, error: message, stage, optional: false };
  }
}

export async function runStagedEditionBuild(
  admin: SupabaseClient,
  input: RunUserGenerationJobInput & { jobId: string }
): Promise<
  | { ok: true; editionId: string; metroKey: string }
  | { ok: false; error: string }
> {
  let job = await loadJob(admin, input.jobId);
  if (!job) return { ok: false, error: "Job not found" };

  while (true) {
    const result = await runEditionBuildStage(admin, input);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    if (result.done) {
      return { ok: true, editionId: result.editionId, metroKey: input.metroKey };
    }
    job = await loadJob(admin, input.jobId);
    if (!job || job.build_stage === null) {
      const editionId = job?.edition_id ?? result.editionId;
      if (editionId) {
        return { ok: true, editionId, metroKey: input.metroKey };
      }
      return { ok: false, error: "Staged build ended without finalize" };
    }
    // One stage per Edge invocation — return after first stage when chaining via worker.
    return { ok: true, editionId: result.editionId, metroKey: input.metroKey };
  }
}
