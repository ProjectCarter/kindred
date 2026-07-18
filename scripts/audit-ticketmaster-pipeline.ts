/**
 * End-to-end Ticketmaster pipeline audit — Sports focus.
 *
 * Usage:
 *   ~/.deno/bin/deno run --allow-env --allow-net --allow-read scripts/audit-ticketmaster-pipeline.ts
 */

import {
  fetchTicketmasterSearchCandidates,
  getLastTicketmasterConnection,
  isTicketmasterConfigured,
  mapTicketmasterCategory,
  parseTicketmasterEvent,
  probeTicketmasterConnection,
} from "../supabase/functions/_shared/localEvents/sources/ticketmasterSearch.ts";
import { mergeEventsFromSources } from "../supabase/functions/_shared/localEvents/merge.ts";
import { normalizeEvents } from "../supabase/functions/_shared/localEvents/normalize.ts";
import { applyEventImageRightsBatch } from "../supabase/functions/_shared/localEvents/sourceRights.ts";
import { attachEventHorizon } from "../supabase/functions/_shared/localEvents/horizon.ts";
import { filterVerifiedEventsForEdition } from "../supabase/functions/_shared/localEvents/eventDateVerification.ts";
import {
  rankLocalEventsForEdition,
  scoreLocalEventWithBreakdown,
} from "../supabase/functions/_shared/localEvents/ranking.ts";
import { filterFamilyFriendlyEvents } from "../supabase/functions/_shared/localEvents/familyFriendlyFilter.ts";
import { gatherFromAllSources } from "../supabase/functions/_shared/localEvents/sources/registry.ts";
import { runLocalEventsPipeline } from "../supabase/functions/_shared/localEvents/pipeline.ts";
import { LOCAL_EVENT_PUBLISH_MIN_SCORE } from "../supabase/functions/_shared/editorial/publishing.ts";
import {
  computeEventConfidence,
  shouldPublishEditorialConfidence,
} from "../supabase/functions/_shared/editorial/confidence.ts";
import { isEventDateVerified } from "../supabase/functions/_shared/localEvents/eventDateVerification.ts";
import { isThirdPartyTicketUrl } from "../lib/edition/officialWebsite.ts";
import { haversineKm } from "../supabase/functions/_shared/discovery/geo.ts";
import {
  KINDRED_LOCAL_RADIUS_KM,
  KINDRED_LOCAL_RADIUS_MILES,
} from "../supabase/functions/_shared/editorial/editorialStandard.ts";
import { EVENT_HORIZON_DAYS } from "../supabase/functions/_shared/localEvents/horizon.ts";
import { SERPAPI_CANDIDATE_CAP } from "../supabase/functions/_shared/editorial/publishing.ts";
import type { LocalEvent, LocalEventCategory } from "../supabase/functions/_shared/localEvents/provider.ts";

const LOCATION = {
  lat: 33.274823,
  lon: -111.776872,
  city: "Gilbert",
  region: "AZ",
  state: "AZ",
};

const SPORTS_TEAMS =
  /diamondbacks|d-backs|cardinals|mercury|suns|phoenix rising|rising fc|coyotes|spring training|mlb|nfl|nba|wnba|mls|nhl/i;

const TM_SPORTS_SEGMENT = "KZFzniwnSyZfZ7v7nE";
const TM_BASE = "https://app.ticketmaster.com/discovery/v2/events.json";

type CategoryKey = "music" | "sports" | "arts" | "family" | "other";

function categoryBucket(category: LocalEventCategory | null | undefined): CategoryKey {
  if (category === "music") return "music";
  if (category === "sports") return "sports";
  if (category === "family") return "family";
  if (category === "arts" || category === "comedy") return "arts";
  return "other";
}

function countByCategory(events: LocalEvent[]): Record<CategoryKey, number> {
  const counts: Record<CategoryKey, number> = {
    music: 0,
    sports: 0,
    arts: 0,
    family: 0,
    other: 0,
  };
  for (const event of events) {
    counts[categoryBucket(event.category)]++;
  }
  return counts;
}

async function loadLocalEnv(): Promise<void> {
  if (Deno.env.get("TICKETMASTER_API_KEY")?.trim()) return;
  try {
    const raw = await Deno.readTextFile(".env.local");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!Deno.env.get(key)) Deno.env.set(key, value);
    }
  } catch {
    /* optional */
  }
}

async function fetchRawSportsApiPage(): Promise<{
  ok: boolean;
  status: number;
  totalElements: number;
  rawCount: number;
  error: string | null;
}> {
  const apiKey = Deno.env.get("TICKETMASTER_API_KEY")?.trim();
  if (!apiKey) {
    return { ok: false, status: 0, totalElements: 0, rawCount: 0, error: "no_api_key" };
  }

  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + EVENT_HORIZON_DAYS);
  const toIso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

  const url = new URL(TM_BASE);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("latlong", `${LOCATION.lat},${LOCATION.lon}`);
  url.searchParams.set("radius", String(KINDRED_LOCAL_RADIUS_MILES));
  url.searchParams.set("unit", "miles");
  url.searchParams.set("countryCode", "US");
  url.searchParams.set("size", "100");
  url.searchParams.set("page", "0");
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("startDateTime", toIso(now));
  url.searchParams.set("endDateTime", toIso(end));
  url.searchParams.set("includeTBA", "no");
  url.searchParams.set("includeTBD", "no");
  url.searchParams.set("source", "ticketmaster");
  url.searchParams.set("segmentId", TM_SPORTS_SEGMENT);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  let data: {
    _embedded?: { events?: unknown[] };
    page?: { totalElements?: number };
    fault?: { faultstring?: string };
    errors?: Array<{ detail?: string }>;
  } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail =
      data?.fault?.faultstring ||
      data?.errors?.[0]?.detail ||
      res.statusText ||
      "request_failed";
    return {
      ok: false,
      status: res.status,
      totalElements: 0,
      rawCount: 0,
      error: `${res.status} ${detail}`,
    };
  }

  const rawCount = data?._embedded?.events?.length ?? 0;
  return {
    ok: true,
    status: res.status,
    totalElements: data?.page?.totalElements ?? rawCount,
    rawCount,
    error: null,
  };
}

function traceSportsThroughPipeline(
  tmSports: LocalEvent[],
  allTm: LocalEvent[],
  now: Date,
  editionDate: string
): Array<{ name: string; sourceUrl: string; finalStage: string; reasons: string[] }> {
  const traces: Array<{
    name: string;
    sourceUrl: string;
    finalStage: string;
    reasons: string[];
  }> = [];

  const familyFiltered = filterFamilyFriendlyEvents(allTm);
  const tmAfterFamily = familyFiltered.kept.filter((e) => e.sourceId === "ticketmaster");
  const sportsAfterFamily = tmAfterFamily.filter((e) => e.category === "sports");

  const merged = mergeEventsFromSources([tmAfterFamily]);
  const sportsMerged = merged.filter(
    (e) => e.sourceId === "ticketmaster" && e.category === "sports"
  );

  const normalized = normalizeEvents(merged);
  const withRights = applyEventImageRightsBatch(normalized);
  const inHorizon = withRights
    .slice(0, SERPAPI_CANDIDATE_CAP)
    .map((e) => attachEventHorizon(e, now))
    .filter((e) => e.horizonBucket !== "beyond");
  const sportsInHorizon = inHorizon.filter(
    (e) => e.sourceId === "ticketmaster" && e.category === "sports"
  );

  const dateVerified = filterVerifiedEventsForEdition(inHorizon, {
    now,
    location: LOCATION,
    editionDate,
  });
  const sportsDateVerified = dateVerified.verified.filter(
    (e) => e.sourceId === "ticketmaster" && e.category === "sports"
  );
  const dateRejectedSports = dateVerified.rejected.filter(
    (e) => e.category === "sports" || tmSports.some((s) => s.sourceUrl === e.sourceUrl)
  );

  const ranked = rankLocalEventsForEdition(dateVerified.verified, {
    now,
    readerCity: LOCATION.city,
  });
  const sportsRanked = ranked.filter(
    (e) => e.sourceId === "ticketmaster" && e.category === "sports"
  );

  for (const sport of tmSports) {
    const reasons: string[] = [];
    let finalStage = "imported";

    const inFamily = sportsAfterFamily.some((e) => e.sourceUrl === sport.sourceUrl);
    if (!inFamily) {
      const sample = familyFiltered.samples.find((s) =>
        sport.name.toLowerCase().includes(s.name.toLowerCase().slice(0, 12))
      );
      reasons.push(
        sample
          ? `family_friendly_filter (${sample.signal}: ${sample.category})`
          : "family_friendly_filter"
      );
      finalStage = "discarded";
      traces.push({ name: sport.name, sourceUrl: sport.sourceUrl, finalStage, reasons });
      continue;
    }

    const inMerged = sportsMerged.some((e) => e.sourceUrl === sport.sourceUrl);
    if (!inMerged) {
      reasons.push("duplicate_merge (matched by Eventbrite or another source with higher trust)");
      finalStage = "discarded";
      traces.push({ name: sport.name, sourceUrl: sport.sourceUrl, finalStage, reasons });
      continue;
    }

    const inHorizonRow = sportsInHorizon.find((e) => e.sourceUrl === sport.sourceUrl);
    if (!inHorizonRow) {
      const withH = attachEventHorizon(
        withRights.find((e) => e.sourceUrl === sport.sourceUrl) ?? sport,
        now
      );
      reasons.push(
        withH.horizonBucket === "beyond"
          ? `date_horizon_beyond_${EVENT_HORIZON_DAYS}_days`
          : "candidate_cap_or_missing_from_horizon_pool"
      );
      finalStage = "discarded";
      traces.push({ name: sport.name, sourceUrl: sport.sourceUrl, finalStage, reasons });
      continue;
    }

    const dateReject = dateRejectedSports.find((r) => r.sourceUrl === sport.sourceUrl);
    if (dateReject) {
      reasons.push(`date_verification (${dateReject.reason})`);
      finalStage = "discarded";
      traces.push({ name: sport.name, sourceUrl: sport.sourceUrl, finalStage, reasons });
      continue;
    }

    const verifiedRow = sportsDateVerified.find((e) => e.sourceUrl === sport.sourceUrl);
    if (!verifiedRow) {
      reasons.push("date_verification (not in verified pool)");
      finalStage = "discarded";
      traces.push({ name: sport.name, sourceUrl: sport.sourceUrl, finalStage, reasons });
      continue;
    }

    const scored = scoreLocalEventWithBreakdown(verifiedRow, {
      now,
      horizonBucket: verifiedRow.horizonBucket,
      readerCity: LOCATION.city,
    });
    if (!isEventDateVerified(scored.event)) {
      reasons.push("date_not_verified_at_rank_gate");
      finalStage = "discarded";
    } else if (scored.score.total < LOCAL_EVENT_PUBLISH_MIN_SCORE) {
      reasons.push(
        `editorial_score_below_threshold (${scored.score.total} < ${LOCAL_EVENT_PUBLISH_MIN_SCORE})`
      );
      finalStage = "discarded";
    } else {
      const confidence = computeEventConfidence(scored.event);
      if (!shouldPublishEditorialConfidence(confidence)) {
        reasons.push(`confidence_gate (${confidence.action})`);
        finalStage = "discarded";
      }
    }

    const imported = sportsRanked.some((e) => e.sourceUrl === sport.sourceUrl);
    if (!imported && finalStage !== "discarded") {
      reasons.push("ranking_sort_excluded");
      finalStage = "discarded";
    }

    if (imported) {
      finalStage = "imported";
      reasons.push("passed_all_gates");
    }

    traces.push({ name: sport.name, sourceUrl: sport.sourceUrl, finalStage, reasons });
  }

  return traces;
}

async function main(): Promise<void> {
  await loadLocalEnv();

  const editionDate = "2026-07-17";
  const now = new Date(`${editionDate}T12:00:00-07:00`);

  console.log("=".repeat(72));
  console.log("TICKETMASTER PIPELINE AUDIT — Gilbert, AZ (Sports focus)");
  console.log("=".repeat(72));
  console.log(`Location: ${LOCATION.city}, ${LOCATION.state} (${LOCATION.lat}, ${LOCATION.lon})`);
  console.log(`Radius: ${KINDRED_LOCAL_RADIUS_MILES} mi · Horizon: ${EVENT_HORIZON_DAYS} days`);
  console.log(`Edition date: ${editionDate}`);
  console.log("");

  const apiKeyConfigured = isTicketmasterConfigured();
  console.log("## API Status");
  console.log(`- API key configured: ${apiKeyConfigured ? "YES" : "NO"}`);

  if (!apiKeyConfigured) {
    console.log("\nAUDIT STOPPED — TICKETMASTER_API_KEY not set.");
    Deno.exit(1);
  }

  const probe = await probeTicketmasterConnection(LOCATION);
  const rawSportsApi = await fetchRawSportsApiPage();
  console.log(`- Connection probe: ${probe.ok ? "SUCCESS" : "FAILED"}`);
  console.log(`- Probe message: ${probe.message}`);
  console.log(`- Probe HTTP status: ${probe.statusCode ?? "n/a"}`);
  console.log(`- Rate limited: ${probe.rateLimited ? "YES" : "NO"}`);
  console.log(`- Total events in radius (unsegmented probe): ${probe.totalEvents ?? 0}`);
  console.log(`- Raw Sports segment API call: ${rawSportsApi.ok ? "SUCCESS" : "FAILED"}`);
  if (rawSportsApi.error) console.log(`- Sports segment error: ${rawSportsApi.error}`);
  console.log(
    `- Sports segment totalElements (API): ${rawSportsApi.totalElements} · page 0 returned: ${rawSportsApi.rawCount}`
  );
  console.log("");

  const allTm = await fetchTicketmasterSearchCandidates(LOCATION, { now });
  const connection = getLastTicketmasterConnection();
  const tmSports = allTm.filter((e) => e.category === "sports");
  const tmMusic = allTm.filter((e) => e.category === "music");
  const tmArts = allTm.filter(
    (e) => e.category === "arts" || e.category === "comedy"
  );
  const tmFamily = allTm.filter((e) => e.category === "family");
  const teamSports = allTm.filter((e) => SPORTS_TEAMS.test(e.name));

  console.log("## Ticketmaster Fetch (after connector parse + radius filter)");
  console.log(`- Total events returned: ${allTm.length}`);
  console.log(`- Music: ${tmMusic.length}`);
  console.log(`- Sports: ${tmSports.length}`);
  console.log(`- Arts/Theatre/Comedy: ${tmArts.length}`);
  console.log(`- Family: ${tmFamily.length}`);
  console.log(`- Other: ${allTm.length - tmMusic.length - tmSports.length - tmArts.length - tmFamily.length}`);
  console.log(`- Major-team keyword matches: ${teamSports.length}`);
  console.log("");

  if (teamSports.length) {
    console.log("### Major-team events retrieved from Ticketmaster");
    for (const e of teamSports.slice(0, 20)) {
      const dist =
        e.lat != null && e.lon != null
          ? `${haversineKm(LOCATION.lat, LOCATION.lon, e.lat, e.lon).toFixed(1)} km`
          : "no coords";
      console.log(`  · ${e.name} @ ${e.venue} (${e.startDateTime}) [${dist}]`);
    }
    console.log("");
  }

  const { events: pipelineEvents, meta } = await runLocalEventsPipeline(LOCATION, {
    now,
    editionDate,
  });
  const tmPipeline = pipelineEvents.filter((e) => e.sourceId === "ticketmaster");
  const tmPipelineSports = tmPipeline.filter((e) => e.category === "sports");
  const pipelineCounts = countByCategory(tmPipeline);

  console.log("## Full Pipeline (all sources → final ranked pool)");
  console.log(`- Candidates gathered (all sources): ${meta.candidateCount}`);
  console.log(`- Ticketmaster in sourceCounts: ${meta.sourceCounts.ticketmaster ?? 0}`);
  console.log(`- Family filter removed: ${meta.familyFilteredCount ?? 0}`);
  console.log(`- After dedupe: ${meta.mergedCount}`);
  console.log(`- Duplicates removed: ${meta.duplicatesRemoved ?? 0}`);
  console.log(`- Within 30-day horizon: ${meta.discoveredInHorizon}`);
  console.log(`- Date verification rejected: ${meta.rejectedByDateVerification}`);
  console.log(`- Final published/ranked count: ${meta.publishedCount}`);
  console.log("");

  console.log("## Final imported counts by category (Ticketmaster only)");
  console.log(`- Music: ${pipelineCounts.music}`);
  console.log(`- Sports: ${pipelineCounts.sports}`);
  console.log(`- Arts: ${pipelineCounts.arts}`);
  console.log(`- Family: ${pipelineCounts.family}`);
  console.log(`- Other: ${pipelineCounts.other}`);
  console.log(`- Total Ticketmaster in final pool: ${tmPipeline.length}`);
  console.log("");

  console.log("## Final imported counts by category (all sources)");
  const allCounts = countByCategory(pipelineEvents);
  for (const [k, v] of Object.entries(allCounts)) {
    console.log(`- ${k}: ${v}`);
  }
  console.log("");

  const sportsTraces = traceSportsThroughPipeline(tmSports, allTm, now, editionDate);
  const discardedSports = sportsTraces.filter((t) => t.finalStage === "discarded");
  const importedSports = sportsTraces.filter((t) => t.finalStage === "imported");

  console.log("## Sports Event Disposition");
  console.log(`- Sports retrieved from Ticketmaster: ${tmSports.length}`);
  console.log(`- Sports imported to final pool: ${importedSports.length}`);
  console.log(`- Sports discarded: ${discardedSports.length}`);
  console.log("");

  if (discardedSports.length) {
    console.log("### Exact discard reasons (every discarded Sports event)");
    for (const row of discardedSports) {
      console.log(`- ${row.name}`);
      console.log(`  URL: ${row.sourceUrl}`);
      console.log(`  Reason: ${row.reasons.join("; ")}`);
    }
    console.log("");
  } else if (tmSports.length === 0) {
    console.log("### No Sports events reached the connector — checking raw API parse failures");
    // Re-fetch sports segment and attempt parse on each raw row
    const apiKey = Deno.env.get("TICKETMASTER_API_KEY")!.trim();
    const end = new Date(now);
    end.setDate(end.getDate() + EVENT_HORIZON_DAYS);
    const toIso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
    const url = new URL(TM_BASE);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("latlong", `${LOCATION.lat},${LOCATION.lon}`);
    url.searchParams.set("radius", String(KINDRED_LOCAL_RADIUS_MILES));
    url.searchParams.set("unit", "miles");
    url.searchParams.set("countryCode", "US");
    url.searchParams.set("size", "100");
    url.searchParams.set("page", "0");
    url.searchParams.set("sort", "date,asc");
    url.searchParams.set("startDateTime", toIso(now));
    url.searchParams.set("endDateTime", toIso(end));
    url.searchParams.set("includeTBA", "no");
    url.searchParams.set("includeTBD", "no");
    url.searchParams.set("source", "ticketmaster");
    url.searchParams.set("segmentId", TM_SPORTS_SEGMENT);
    const res = await fetch(url.toString());
    const data = await res.json() as {
      _embedded?: {
        events?: Array<{
          name?: string;
          url?: string;
          dates?: { start?: { dateTBA?: boolean; dateTBD?: boolean; localDate?: string } };
          classifications?: Array<{ segment?: { name?: string } }>;
          _embedded?: { venues?: Array<{ name?: string; location?: { latitude?: string; longitude?: string } }> };
        }>;
      };
    };
    const rawEvents = data._embedded?.events ?? [];
    console.log(`Raw Sports API rows on page 0: ${rawEvents.length}`);
    for (const row of rawEvents.slice(0, 30)) {
      const name = row.name?.trim() ?? "(unnamed)";
      const parsed = parseTicketmasterEvent(row as Parameters<typeof parseTicketmasterEvent>[0], LOCATION.city);
      let reason = "parsed_ok";
      if (!parsed) {
        const urlOk = row.url?.trim() && isThirdPartyTicketUrl(row.url.trim());
        if (row.dates?.start?.dateTBA || row.dates?.start?.dateTBD) reason = "date_tba_tbd";
        else if (!urlOk) reason = "invalid_or_missing_ticket_url";
        else if (!row.dates?.start?.localDate) reason = "missing_start_date";
        else reason = "parse_rejected_other";
      } else if (parsed.category !== "sports") {
        reason = `misclassified_as_${parsed.category ?? "unknown"}`;
      } else {
        const lat = Number(row._embedded?.venues?.[0]?.location?.latitude);
        const lon = Number(row._embedded?.venues?.[0]?.location?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const km = haversineKm(LOCATION.lat, LOCATION.lon, lat, lon);
          if (km > KINDRED_LOCAL_RADIUS_KM) {
            reason = `outside_radius (${km.toFixed(1)} km > ${KINDRED_LOCAL_RADIUS_KM.toFixed(1)} km)`;
          }
        }
      }
      const segment = row.classifications?.[0]?.segment?.name ?? "?";
      const venue = row._embedded?.venues?.[0]?.name ?? "?";
      console.log(`- ${name}`);
      console.log(`  Segment: ${segment} · Venue: ${venue}`);
      console.log(`  Connector outcome: ${reason}`);
    }
    console.log("");
  }

  if (importedSports.length) {
    console.log("### Sports events that DID import");
    for (const row of importedSports) {
      console.log(`- ${row.name}`);
    }
    console.log("");
  }

  console.log("## Top 15 events in final pool (all sources)");
  for (const e of pipelineEvents.slice(0, 15)) {
    console.log(
      `  · [${e.sourceId ?? e.sourceName}] ${e.category ?? "?"} — ${e.name}`
    );
  }

  console.log("");
  console.log("## Diagnosis Summary");
  if (!probe.ok) {
    console.log("ROOT CAUSE: Ticketmaster API connection failed — no events can import.");
  } else if (rawSportsApi.totalElements === 0) {
    console.log(
      "ROOT CAUSE: Ticketmaster Sports segment returned 0 events within 25 mi / 30 days for Gilbert."
    );
    console.log(
      "  Major Phoenix teams (Diamondbacks, Cardinals, Mercury, Rising) play at venues 20–30+ mi away;"
    );
    console.log(
      "  home schedules may also fall outside the 30-day horizon or off-season."
    );
  } else if (tmSports.length === 0 && rawSportsApi.rawCount > 0) {
    console.log(
      "ROOT CAUSE: Sports events returned by API but filtered out during connector parse/radius dedupe."
    );
  } else if (tmSports.length > 0 && importedSports.length === 0) {
    console.log(
      "ROOT CAUSE: Sports events retrieved but removed by downstream pipeline filters (see discard reasons above)."
    );
  } else if (importedSports.length > 0) {
    console.log(
      `Sports events ARE importing (${importedSports.length}). If not visible on homepage, check edition cache / UI render cap (8 cards), not Ticketmaster.`
    );
  } else {
    console.log("No Sports events found at any stage.");
  }

  console.log("");
  console.log(`Connection diagnostics: ${JSON.stringify(connection)}`);
}

if (import.meta.main) {
  await main();
}
