// Kindred — debug-local-events
// One-shot server/provider probe for getLocalEvents. Returns stage counts and
// a sanitized SerpAPI sample — never exposes the API key.

import {
  getLocalEvents,
  probeLocalEventsPipeline,
  buildLocalEventsBody,
  type LocalEvent,
  type LocalEventLocation,
} from "../_shared/localEvents/provider.ts";
import { runLocalEventsPipeline } from "../_shared/localEvents/pipeline.ts";
import { fetchEventbriteSearchCandidates } from "../_shared/localEvents/sources/eventbriteSearch.ts";
import { attachEventHorizon } from "../_shared/localEvents/horizon.ts";
import {
  computeKindredEventEditorialScore,
} from "../_shared/localEvents/editorialScore.ts";
import {
  computeEventConfidence,
  shouldPublishEditorialConfidence,
} from "../_shared/editorial/confidence.ts";
import { LOCAL_EVENT_PUBLISH_MIN_SCORE } from "../_shared/editorial/publishing.ts";
import { refreshEventsSection } from "../_shared/liveRefresh.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isUsHolidayOrEve } from "../_shared/calendar/holidays.ts";

type ProbeRequest = {
  location?: Partial<LocalEventLocation>;
  editionDate?: string;
  cityQuery?: string;
  htichips?: string | null;
  backfillEditionId?: string;
  backfillUserId?: string;
};

Deno.serve(async (req) => {
  try {
    let body: ProbeRequest = {};
    try {
      body = (await req.json()) as ProbeRequest;
    } catch {
      // optional body — default to Gilbert
    }

    const location: LocalEventLocation = {
      lat: Number(body.location?.lat ?? 33.274823),
      lon: Number(body.location?.lon ?? -111.776872),
      city: String(body.location?.city ?? body.cityQuery ?? "Gilbert"),
      region: body.location?.region ?? "AZ",
      state: body.location?.state ?? "AZ",
    };

    if (body.cityQuery?.trim()) {
      location.city = body.cityQuery.trim();
    }

    const editionDate =
      typeof body.editionDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(body.editionDate)
        ? body.editionDate
        : "2026-07-14";

    const [y, m, d] = editionDate.split("-").map(Number);
    const dateObj = new Date(y, (m ?? 1) - 1, d ?? 1);
    const dow = dateObj.getDay();
    const isBusyDay =
      dow === 0 || dow === 6 || isUsHolidayOrEve(dateObj);

    const [probe, productionEvents, pipeline, eventbriteRaw] = await Promise.all([
      probeLocalEventsPipeline(location, {
        isBusyDay,
        htichips: body.htichips,
      }),
      getLocalEvents(location, { isBusyDay, now: dateObj }),
      runLocalEventsPipeline(location, { isBusyDay, now: dateObj }),
      fetchEventbriteSearchCandidates(location),
    ]);

    const summarize = (events: LocalEvent[]) =>
      events.map((e) => ({
        name: e.name,
        startDateTime: e.startDateTime,
        startDateIso: e.startDateIso ?? null,
        venue: e.venue,
        city: e.city,
        category: e.category ?? null,
        horizonBucket: e.horizonBucket ?? null,
        editorialScore: e.editorialScore?.total ?? null,
        sourceName: e.sourceName,
      }));

    const diagnoseEvent = (event: LocalEvent) => {
      const withHorizon = attachEventHorizon(event, dateObj);
      const score = computeKindredEventEditorialScore(withHorizon, {
        now: dateObj,
        horizonBucket: withHorizon.horizonBucket,
        readerCity: location.city,
      });
      const confidence = computeEventConfidence(withHorizon);
      const exclusionReasons: string[] = [];

      if (withHorizon.horizonBucket === "beyond") {
        exclusionReasons.push("date_beyond_30_day_horizon");
      }
      if (score.total < LOCAL_EVENT_PUBLISH_MIN_SCORE) {
        exclusionReasons.push(
          `editorial_score_below_threshold (${score.total} < ${LOCAL_EVENT_PUBLISH_MIN_SCORE})`
        );
      }
      if (!shouldPublishEditorialConfidence(confidence)) {
        exclusionReasons.push(`confidence_gate_${confidence.action}`);
      }

      const rankedMatch = (pipeline.meta.rankedPoolTitles ?? []).some(
        (title) => title.toLowerCase() === withHorizon.name.toLowerCase()
      );
      const publishedMatch = productionEvents.some(
        (e) => e.name.toLowerCase() === withHorizon.name.toLowerCase()
      );

      if (rankedMatch && !publishedMatch) {
        exclusionReasons.push("ranking_allocation_category_or_bucket_cap");
      }

      return {
        ...summarize([withHorizon])[0],
        editorialScore: score.total,
        confidenceAction: confidence.action,
        qualified: rankedMatch,
        published: publishedMatch,
        exclusionReasons,
      };
    };

    let backfill: { ok: boolean; changed: boolean; count: number; error?: string } | null =
      null;
    if (body.backfillEditionId && body.backfillUserId) {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (url && key) {
        const admin = createClient(url, key);
        backfill = await refreshEventsSection(admin, {
          editionId: body.backfillEditionId,
          userId: body.backfillUserId,
          editionDate,
          location,
        });
      }
    }

    const productionBody = buildLocalEventsBody(productionEvents);
    const persistedEvents = JSON.parse(productionBody) as {
      events: Array<{
        name: string;
        editorialRank?: number;
        editorialScore?: number;
      }>;
    };

    const persistenceValidation = {
      /** Same entry point generate-edition and refresh-live-data use. */
      qualifiedViaGetLocalEvents: productionEvents.length,
      serializedInEditionBody: persistedEvents.events?.length ?? 0,
      pipelineDiscovered: pipeline.meta.candidateCount,
      pipelineInHorizon: pipeline.meta.discoveredInHorizon,
      pipelineQualified: pipeline.meta.scoredAboveThreshold,
      pipelineReturnedCount: pipeline.meta.publishedCount,
      noSecondServerAllocation: pipeline.meta.publishedCount === pipeline.meta.scoredAboveThreshold,
      editorialOrderPreserved:
        productionEvents.length === (persistedEvents.events?.length ?? 0) &&
        productionEvents.every(
          (event, index) =>
            persistedEvents.events?.[index]?.name === event.name &&
            persistedEvents.events?.[index]?.editorialRank === index + 1
        ),
      topThreeEditorialOrder: productionEvents.slice(0, 3).map((e, i) => ({
        rank: i + 1,
        name: e.name,
        editorialScore:
          e.editorialScore?.total ??
          persistedEvents.events?.[i]?.editorialScore ??
          null,
      })),
      homepageRenderCap: 8,
      seeAllAvailable: persistedEvents.events?.length ?? 0,
    };

    return Response.json({
      ok: true,
      editionDate,
      isBusyDay,
      probe,
      pipeline: pipeline.meta,
      eventbriteOnlyReport: pipeline.meta.eventbriteOnly ?? null,
      productionEventCount: productionEvents.length,
      publishedEvents: summarize(productionEvents),
      discoveredEvents: summarize(pipeline.events),
      rankedPool: pipeline.meta.rankedPoolTitles ?? [],
      eventbriteDiscovered: summarize(eventbriteRaw),
      eventbriteWithDates: eventbriteRaw.filter((e) => e.startDateIso).length,
      eventbriteDiagnostics: eventbriteRaw.map(diagnoseEvent),
      persistenceValidation,
      backfill,
    });
  } catch (err) {
    console.error("[debug-local-events] failure", err);
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
});
