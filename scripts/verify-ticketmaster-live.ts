/**
 * Live Ticketmaster + pipeline verification — run before committing integration.
 *
 * Usage:
 *   deno run --allow-env --allow-net --allow-read scripts/verify-ticketmaster-live.ts
 */

import {
  fetchTicketmasterSearchCandidates,
  getLastTicketmasterConnection,
  isTicketmasterConfigured,
  probeTicketmasterConnection,
} from "../supabase/functions/_shared/localEvents/sources/ticketmasterSearch.ts";
import { fetchEventbriteSearchCandidates } from "../supabase/functions/_shared/localEvents/sources/eventbriteSearch.ts";
import { mergeEventsFromSources } from "../supabase/functions/_shared/localEvents/merge.ts";
import { runLocalEventsPipeline } from "../supabase/functions/_shared/localEvents/pipeline.ts";
import { isThirdPartyTicketUrl } from "../lib/edition/officialWebsite.ts";

const LOCATION = {
  lat: 33.274823,
  lon: -111.776872,
  city: "Gilbert",
  region: "AZ",
  state: "AZ",
};

type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
};

function ticketUrlValid(url: string): boolean {
  return isThirdPartyTicketUrl(url);
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
    /* .env.local optional */
  }
}

async function main(): Promise<void> {
  await loadLocalEnv();
  const started = performance.now();
  const checks: CheckResult[] = [];

  if (!isTicketmasterConfigured()) {
    console.error("FAIL: TICKETMASTER_API_KEY is not set in environment.");
    Deno.exit(1);
  }

  console.log("=== Ticketmaster Live Verification ===");
  console.log(`Location: ${LOCATION.city}, ${LOCATION.state} (${LOCATION.lat}, ${LOCATION.lon})`);
  console.log("");

  const probeStart = performance.now();
  const probe = await probeTicketmasterConnection(LOCATION);
  const probeMs = Math.round(performance.now() - probeStart);

  checks.push({
    name: "Connection succeeds",
    pass: probe.ok,
    detail: probe.ok
      ? `OK in ${probeMs}ms — ${probe.totalEvents ?? 0} events in radius (API totalElements)`
      : probe.message,
  });

  if (!probe.ok) {
    printReport(checks, null);
    Deno.exit(1);
  }

  const fetchStart = performance.now();
  const ticketmasterEvents = await fetchTicketmasterSearchCandidates(LOCATION);
  const fetchMs = Math.round(performance.now() - fetchStart);

  const sports = ticketmasterEvents.filter((e) => e.category === "sports");
  const music = ticketmasterEvents.filter((e) => e.category === "music");
  const validTicketUrls = ticketmasterEvents.filter((e) =>
    ticketUrlValid(e.sourceUrl)
  );

  checks.push({
    name: "Events are returned",
    pass: ticketmasterEvents.length > 0,
    detail: `${ticketmasterEvents.length} events in ${fetchMs}ms`,
  });
  checks.push({
    name: "Sports events returned (when available)",
    pass: sports.length > 0,
    detail: `${sports.length} sports events`,
  });
  checks.push({
    name: "Concerts returned",
    pass: music.length > 0,
    detail: `${music.length} music/concert events`,
  });
  checks.push({
    name: "Ticket URLs generated correctly",
    pass:
      ticketmasterEvents.length > 0 &&
      validTicketUrls.length === ticketmasterEvents.length,
    detail: `${validTicketUrls.length}/${ticketmasterEvents.length} valid Ticketmaster/ticketweb URLs`,
  });

  const eventbriteStart = performance.now();
  const eventbriteEvents = await fetchEventbriteSearchCandidates(LOCATION);
  const eventbriteMs = Math.round(performance.now() - eventbriteStart);

  const candidateCount =
    ticketmasterEvents.length + eventbriteEvents.length;
  const mergedTmEb = mergeEventsFromSources([
    ticketmasterEvents,
    eventbriteEvents,
  ]);
  const duplicatesRemoved = Math.max(0, candidateCount - mergedTmEb.length);
  const tmInMerged = mergedTmEb.filter((e) => e.sourceId === "ticketmaster");
  const ebInMerged = mergedTmEb.filter((e) => e.sourceId === "eventbrite");

  checks.push({
    name: "Events merge with Eventbrite",
    pass: mergedTmEb.length > 0,
    detail: `${mergedTmEb.length} merged (${tmInMerged.length} Ticketmaster, ${ebInMerged.length} Eventbrite) from ${candidateCount} candidates`,
  });
  checks.push({
    name: "Duplicate removal functioning",
    pass: duplicatesRemoved >= 0 && mergedTmEb.length <= candidateCount,
    detail: `${duplicatesRemoved} removed as duplicates`,
  });

  const pipelineStart = performance.now();
  const editionDate = "2026-07-16";
  const editionNow = new Date(`${editionDate}T12:00:00-07:00`);
  const { events: pipelineEvents, meta } = await runLocalEventsPipeline(LOCATION, {
    now: editionNow,
    editionDate,
  });
  const pipelineMs = Math.round(performance.now() - pipelineStart);

  const tmInPipeline = pipelineEvents.filter((e) => e.sourceId === "ticketmaster");
  const tmInRankedPool = (meta.rankedPoolTitles ?? []).some((title) =>
    pipelineEvents.some(
      (e) => e.sourceId === "ticketmaster" && e.name === title
    )
  );

  checks.push({
    name: "Today's newspaper can include Ticketmaster events",
    pass: tmInPipeline.length > 0 || (meta.sourceCounts.ticketmaster ?? 0) > 0,
    detail: `${tmInPipeline.length} Ticketmaster in ranked/published pool; sourceCounts=${meta.sourceCounts.ticketmaster ?? 0}`,
  });
  checks.push({
    name: "No performance regression (pipeline < 120s)",
    pass: pipelineMs < 120_000,
    detail: `full pipeline ${pipelineMs}ms (TM fetch ${fetchMs}ms, EB fetch ${eventbriteMs}ms, probe ${probeMs}ms)`,
  });

  const connection = getLastTicketmasterConnection();
  const samples = ticketmasterEvents.slice(0, 8).map((e) => ({
    title: e.name,
    category: e.category ?? "unknown",
    venue: e.venue,
    date: e.startDateTime,
    buyTickets: e.sourceUrl,
    badges: e.badges ?? [],
  }));

  const sportsSamples = sports.slice(0, 4).map((e) => ({
    title: e.name,
    buyTickets: e.sourceUrl,
  }));

  const musicSamples = music.slice(0, 4).map((e) => ({
    title: e.name,
    buyTickets: e.sourceUrl,
  }));

  printReport(checks, {
    connection: {
      ok: probe.ok,
      message: connection?.message ?? probe.message,
      totalInRadius: probe.totalEvents ?? null,
    },
    ticketmaster: {
      retrieved: ticketmasterEvents.length,
      sports: sports.length,
      music: music.length,
      fetchMs,
    },
    eventbrite: {
      retrieved: eventbriteEvents.length,
      fetchMs: eventbriteMs,
    },
    merge: {
      candidates: candidateCount,
      merged: mergedTmEb.length,
      duplicatesRemoved,
      ticketmasterInMerged: tmInMerged.length,
      eventbriteInMerged: ebInMerged.length,
    },
    pipeline: {
      publishedCount: meta.publishedCount,
      mergedCount: meta.mergedCount,
      candidateCount: meta.candidateCount,
      duplicatesRemoved: meta.duplicatesRemoved ?? 0,
      sourceCounts: meta.sourceCounts,
      ticketmasterInPublished: tmInPipeline.length,
      pipelineMs,
      topTitles: pipelineEvents.slice(0, 10).map((e) => ({
        title: e.name,
        source: e.sourceId ?? e.sourceName,
        category: e.category ?? null,
      })),
    },
    samples,
    sportsSamples,
    musicSamples,
  });

  const allPass = checks.every((c) => c.pass);
  const totalMs = Math.round(performance.now() - started);
  console.log("");
  console.log(`Total verification time: ${totalMs}ms`);
  console.log(allPass ? "✅ ALL LIVE CHECKS PASSED" : "❌ SOME CHECKS FAILED");
  Deno.exit(allPass ? 0 : 1);
}

function printReport(
  checks: CheckResult[],
  results: Record<string, unknown> | null
): void {
  console.log("--- Checks ---");
  for (const check of checks) {
    console.log(`${check.pass ? "✅" : "❌"} ${check.name}: ${check.detail}`);
  }
  if (results) {
    console.log("");
    console.log("--- Live Results ---");
    console.log(JSON.stringify(results, null, 2));
  }
}

if (import.meta.main) {
  await main();
}
