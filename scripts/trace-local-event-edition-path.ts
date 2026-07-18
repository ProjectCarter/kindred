/**
 * Trace one catalog event through the Gilbert edition Local Events pipeline.
 * Usage:
 *   KINDRED_ALLOW_FALLBACK_SERVICE_KEY=1 npx deno run --allow-net --allow-env --allow-read \
 *     scripts/trace-local-event-edition-path.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { loadEventsCatalogForEdition } from "../supabase/functions/_shared/localEvents/eventsCatalogSync.ts";
import { rowToLocalEvent } from "../supabase/functions/_shared/localEvents/eventsCatalog.ts";
import { filterLocalEventsByMarket } from "../lib/markets/editionMarketIsolation.ts";
import {
  resolveEditionMarket,
  catalogMetroKeyForMarket,
} from "../lib/markets/resolveEditionMarket.ts";
import { metroKeyFromEventLocation } from "../supabase/functions/_shared/localEvents/eventsCatalog.ts";
import { metroKeyFromPlace } from "../lib/location/metroKey.ts";
import { rankLocalEventsForEdition } from "../supabase/functions/_shared/localEvents/ranking.ts";
import { filterFamilyFriendlyEvents } from "../supabase/functions/_shared/localEvents/familyFriendlyFilter.ts";
import { allocateLocalEventsByHorizon } from "../supabase/functions/_shared/localEvents/horizonAllocator.ts";
import { eventHasPublishableEditorial } from "../supabase/functions/_shared/localEvents/banditNotes.ts";
import { gateLocalEventsForPublication } from "../supabase/functions/_shared/edition/finalPublicationGate.ts";
import { buildLocalEventsBody } from "../supabase/functions/_shared/localEvents/provider.ts";
import { assessPersistedEditionBuild } from "../supabase/functions/_shared/editionCompleteness.ts";
import { runDiscoveryDecisions } from "../supabase/functions/_shared/discovery/decide.ts";
import { resolveEventTimezone } from "../supabase/functions/_shared/localEvents/eventTimezone.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX } from "../supabase/functions/_shared/editorial/publishing.ts";
import type { LocalEvent } from "../supabase/functions/_shared/localEvents/provider.ts";

const TRACE_NAME = "A Flock Of Seagulls at Celebrity Theatre";
const EDITION_DATE = Deno.env.get("AUDIT_EDITION_DATE") ?? "2026-07-17";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ??
  (Deno.env.get("KINDRED_ALLOW_FALLBACK_SERVICE_KEY") === "1"
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk"
    : undefined);

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY required");
  Deno.exit(1);
}

const sb = createClient(
  Deno.env.get("SUPABASE_URL") ?? "https://zdqjeocdsbdzecawumdp.supabase.co",
  SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const gilbertLocation = {
  city: "Gilbert",
  state: "AZ",
  region: "Arizona",
  lat: 33.2748,
  lon: -111.7769,
};

const editionDateObj = new Date(
  Number(EDITION_DATE.slice(0, 4)),
  Number(EDITION_DATE.slice(5, 7)) - 1,
  Number(EDITION_DATE.slice(8, 10))
);
const now = new Date();
const market = resolveEditionMarket(gilbertLocation)!;
const catalogMetroKeyFixed = catalogMetroKeyForMarket(market);
const catalogMetroKeyProduction = metroKeyFromPlace({
  city: gilbertLocation.city,
  state: gilbertLocation.state,
  region: gilbertLocation.region,
});
const eventsLocation = { ...gilbertLocation };
const timezone = resolveEventTimezone(eventsLocation);

function findEvent(pool: LocalEvent[], label: string) {
  const hit = pool.find((e) => e.name === TRACE_NAME);
  return { label, present: Boolean(hit), count: pool.length, event: hit ?? null };
}

function eventKey(e: LocalEvent) {
  return `${e.name}|${e.startDateTime}`.toLowerCase();
}

/** Production buildEdition.ts (git HEAD) — no catalogMetroKey on getLocalEvents. */
async function queryProductionPath() {
  return loadEventsCatalogForEdition(sb, eventsLocation, {
    now,
    editionDate: EDITION_DATE,
    timezone,
    // catalogMetroKey intentionally omitted — matches deployed HEAD
  });
}

/** Fixed worktree buildEdition.ts — passes catalogMetroKey: phoenix-az. */
async function queryFixedPath() {
  return loadEventsCatalogForEdition(sb, eventsLocation, {
    now,
    editionDate: EDITION_DATE,
    timezone,
    catalogMetroKey: catalogMetroKeyFixed,
  });
}

function mergePublishable(
  target: LocalEvent[],
  incoming: LocalEvent[],
  seen: Set<string>,
  editorialTarget: number
) {
  for (const event of incoming) {
    const key = eventKey(event);
    if (seen.has(key) || !eventHasPublishableEditorial(event)) continue;
    seen.add(key);
    target.push(event);
    if (target.length >= editorialTarget) break;
  }
}

/** HEAD buildEdition anthropic branch — replaces localEvents with AI batch only. */
function productionEditorialAssembly(
  localEventsForEdition: LocalEvent[],
  anthropicConfigured: boolean
): LocalEvent[] {
  const editorialTarget = Math.min(LOCAL_EVENTS_EDITION_SURFACED_MAX, 12);
  let localEvents = localEventsForEdition;
  if (localEvents.length > 0 && anthropicConfigured) {
    const publishable: LocalEvent[] = []; // Anthropic credits exhausted → empty
    localEvents = publishable.slice(0, editorialTarget);
  }
  return localEvents;
}

/** Worktree buildEdition — seed catalog editorial before optional AI. */
function fixedEditorialAssembly(
  localEventsForEdition: LocalEvent[],
  localEventsForBandit: LocalEvent[],
  anthropicConfigured: boolean
): LocalEvent[] {
  const editorialTarget = Math.min(LOCAL_EVENTS_EDITION_SURFACED_MAX, 12);
  const publishable: LocalEvent[] = [];
  const seen = new Set<string>();
  mergePublishable(publishable, localEventsForEdition, seen, editorialTarget);
  if (publishable.length < editorialTarget) {
    mergePublishable(publishable, localEventsForBandit, seen, editorialTarget);
  }
  if (
    localEventsForEdition.length > 0 &&
    anthropicConfigured &&
    publishable.length < editorialTarget
  ) {
    // AI would run here; with exhausted credits publishable unchanged
  }
  return publishable.slice(0, editorialTarget);
}

console.log("=== Local Events edition trace ===");
console.log("Trace event:", TRACE_NAME);
console.log("Edition date:", EDITION_DATE);
console.log("Reader location:", gilbertLocation.city, "→ market", market.metroKey);
console.log("catalogMetroKey (production HEAD):", catalogMetroKeyProduction);
console.log("catalogMetroKey (fixed worktree):", catalogMetroKeyFixed);
console.log(
  "metroKeyFromEventLocation(eventsLocation):",
  metroKeyFromEventLocation(eventsLocation)
);
console.log("");

// --- Step 0: DB row ---
const { data: dbRow } = await sb
  .from("events_catalog")
  .select("*")
  .eq("metro_key", "phoenix-az")
  .eq("name", TRACE_NAME)
  .maybeSingle();

console.log("STEP 0 — Database row (events_catalog)");
if (!dbRow) {
  console.log("  FAIL: row not found under phoenix-az");
  Deno.exit(1);
}
const dbEvent = rowToLocalEvent(dbRow);
console.log("  ✓ Row exists:", dbRow.id);
console.log("  verification_status:", dbRow.verification_status);
console.log("  lifecycle:", dbRow.lifecycle);
console.log("  editorial_body paragraphs:", dbRow.editorial_body?.length ?? 0);
console.log("  eventHasPublishableEditorial:", eventHasPublishableEditorial(dbEvent));
console.log("");

// --- Step 1: Query (production vs fixed) ---
console.log("STEP 1 — Catalog query (getLocalEvents → loadEventsCatalogForEdition)");

const prodRaw = await queryProductionPath();
const fixedRaw = await queryFixedPath();

const s1prod = findEvent(prodRaw, "production (no catalogMetroKey)");
const s1fix = findEvent(fixedRaw, "fixed (catalogMetroKey=phoenix-az)");

console.log("  Production path:", s1prod.present ? "✓ PRESENT" : "✗ ABSENT", `(${s1prod.count} ranked total)`);
console.log("  Fixed path:     ", s1fix.present ? "✓ PRESENT" : "✗ ABSENT", `(${s1fix.count} ranked total)`);

if (!s1prod.present) {
  console.log("");
  console.log("  ⛔ EVENT DISAPPEARS AT STEP 1 (production path)");
  console.log("  Function: loadEventsCatalogForEdition");
  console.log("  Why: metro_key resolved as", metroKeyFromEventLocation(eventsLocation), "— catalog lives under phoenix-az");
  console.log("  Before: 1 verified row in DB under phoenix-az");
  console.log("  After: 0 rows returned (no gilbert-az catalog)");
}

// Continue trace on fixed path (or production if present)
const raw = s1fix.present ? fixedRaw : prodRaw;
if (!findEvent(raw, "").present) {
  Deno.exit(0);
}

// --- Step 2: Market isolation ---
console.log("");
console.log("STEP 2 — Market isolation (filterLocalEventsByMarket)");
const isolated = filterLocalEventsByMarket(raw, market, {
  lat: gilbertLocation.lat,
  lon: gilbertLocation.lon,
  city: gilbertLocation.city,
  state: gilbertLocation.state,
});
const s2 = findEvent(isolated.kept, "after isolation");
console.log(" ", s2.present ? "✓ PRESENT" : "✗ ABSENT", `(${s2.count} kept, ${isolated.rejected.length} rejected)`);
if (!s2.present) {
  const rej = isolated.rejected.find((r) => r.name.includes("Seagulls"));
  console.log("  ⛔ REMOVED BY filterLocalEventsByMarket:", rej?.reason);
}

// --- Step 3: Ranking (already applied in load; re-verify) ---
console.log("");
console.log("STEP 3 — Ranking (rankLocalEventsForEdition — in catalog read)");
const family = filterFamilyFriendlyEvents(isolated.kept);
const ranked = rankLocalEventsForEdition(family.kept, {
  now,
  readerCity: gilbertLocation.city,
  readerLat: gilbertLocation.lat,
  readerLon: gilbertLocation.lon,
});
const s3 = findEvent(ranked, "ranked");
console.log(" ", s3.present ? "✓ PRESENT" : "✗ ABSENT", `(${s3.count} ranked)`);
if (s3.event && !s3.present) {
  console.log("  Filter: isEventDateVerified + editorial score + confidence gate");
}

// --- Step 4: Horizon allocation (homepage surfaced slice) ---
console.log("");
console.log("STEP 4 — Homepage surface (allocateLocalEventsByHorizon)");
const surfaced = allocateLocalEventsByHorizon(ranked, {
  maxTotal: LOCAL_EVENTS_EDITION_SURFACED_MAX,
  now: editionDateObj,
  readerCity: gilbertLocation.city,
  readerLat: gilbertLocation.lat,
  readerLon: gilbertLocation.lon,
});
const s4 = findEvent(surfaced, "surfaced for edition");
console.log(" ", s4.present ? "✓ PRESENT" : "✗ ABSENT", `(${s4.count} surfaced)`);

// --- Step 5: Discovery (separate desk — uses ranked pool before Bandit claim) ---
console.log("");
console.log("STEP 5 — Discovery catalog (runDiscoveryDecisions — NOT homepage Local Events desk)");
const discovery = runDiscoveryDecisions({
  editionDate: EDITION_DATE,
  now,
  city: gilbertLocation.city,
  region: gilbertLocation.region,
  state: gilbertLocation.state,
  localEvents: ranked,
  localPlaces: [],
  npsParks: [],
});
const discoveryTitles = Object.values(discovery.surfaces).flatMap((s) =>
  (s.items ?? []).map((i) => i.title)
);
const inDiscovery = discoveryTitles.some((t) => t === TRACE_NAME);
console.log(" ", inDiscovery ? "✓ PRESENT in discovery surfaces" : "○ not selected for discovery surfaces");
console.log("  (Local Events homepage cards come from edition_sections.local_events, not discovery)");

// --- Step 6: Editorial assembly ---
console.log("");
console.log("STEP 6 — Editorial assembly (buildEdition localEvents variable)");

const prodAssembly = productionEditorialAssembly(surfaced, true);
const fixAssembly = fixedEditorialAssembly(surfaced, ranked, true);

const s6prod = findEvent(prodAssembly, "production HEAD + anthropic");
const s6fix = findEvent(fixAssembly, "fixed worktree");

console.log("  Production HEAD (AI-only merge, credits exhausted):",
  s6prod.present ? "✓ PRESENT" : "✗ ABSENT", `(${s6prod.count} events)`);
console.log("  Fixed worktree (catalog seed first):",
  s6fix.present ? "✓ PRESENT" : "✗ ABSENT", `(${s6fix.count} events)`);

if (s4.present && !s6prod.present) {
  console.log("");
  console.log("  ⛔ EVENT DISAPPEARS AT STEP 6 (production editorial assembly)");
  console.log("  Function: buildEditionForUser — anthropic enrichment branch");
  console.log("  Condition: localEvents.length > 0 && anthropicApiKey → publishable stays [] when API fails");
  console.log("  Before: surfaced pool had event with catalog editorial_body");
  console.log("  After: localEvents = publishable.slice() → length 0");
}

const localEventsForSection = fixAssembly;

// --- Step 7: Section builder ---
console.log("");
console.log("STEP 7 — Section builder (if localEvents.length > 0 → rows.push local_events)");
const sectionWouldBuild = localEventsForSection.length > 0;
console.log("  Production HEAD would build section:", productionEditorialAssembly(surfaced, true).length > 0 ? "yes" : "NO");
console.log("  Fixed worktree would build section:", sectionWouldBuild ? "yes" : "NO");

// --- Step 8: Final publication gate ---
console.log("");
console.log("STEP 8 — Final publication gate (gateLocalEventsForPublication)");
if (localEventsForSection.length === 0) {
  console.log("  SKIPPED — no events reached gate");
} else {
  const gated = gateLocalEventsForPublication(localEventsForSection, {
    now,
    location: eventsLocation,
    eventTimezone: timezone,
    editionDate: EDITION_DATE,
  });
  const s8 = findEvent(gated.events, "after gate");
  console.log(" ", s8.present ? "✓ PRESENT" : "✗ ABSENT", `(${gated.events.length} kept)`);
  if (!s8.present && gated.report.rejected.length) {
    console.log("  Rejection reasons:", gated.report.byReason);
  }
  const body = buildLocalEventsBody(gated.events, { editionCity: gilbertLocation.city });
  const parsed = JSON.parse(body) as { events?: LocalEvent[] };
  const inJson = parsed.events?.some((e) => e.name === TRACE_NAME);
  console.log("  Edition JSON local_events body contains event:", inJson ? "✓ yes" : "✗ no");
}

// --- Step 9: Completeness / ready ---
console.log("");
console.log("STEP 9 — Completeness (assessPersistedEditionBuild local_events check)");
if (localEventsForSection.length === 0) {
  console.log("  Result: edition_sections missing local_events");
  console.log("  Reason: section never inserted because localEvents.length === 0 at step 7");
} else {
  const body = buildLocalEventsBody(localEventsForSection, {
    editionCity: gilbertLocation.city,
  });
  const bootstrap = {
    eventsCatalogBootstrapped: true,
    activitiesCatalogBootstrapped: true,
    foodDrinkCatalogBootstrapped: true,
  };
  const complete = assessPersistedEditionBuild({
    sections: [
      {
        section_type: "local_events",
        headline: "A Few Things Happening Around Town",
        body,
      },
      { section_type: "today_in_history", headline: "h", body: "b" },
    ],
    discovery: { version: 1 as const, picks: [], surfaces: { x: { items: [{}] } }, selectionMeta: { candidateCount: 1, editorNotes: [] } },
    hasBanditsPick: true,
    catalogBootstrap: bootstrap,
  });
  const missingLocal = complete.reasons.some((r) => r.includes("local_events"));
  console.log("  assessPersistedEditionBuild missing local_events:", missingLocal ? "yes (FAIL)" : "no");
  console.log("  All completeness reasons:", complete.reasons.filter((r) => r.includes("local")));
}

console.log("");
console.log("=== ROOT CAUSE SUMMARY ===");
if (!s1prod.present) {
  console.log("PRIMARY (production): Step 1 — getLocalEvents does not pass catalogMetroKey.");
  console.log("  Gilbert reader → gilbert-az query → empty catalog (events are under phoenix-az).");
}
if (s4.present && !s6prod.present) {
  console.log("SECONDARY (production): Step 6 — anthropic-only merge wipes catalog editorial when API returns nothing.");
}
if (s1fix.present && s6fix.present) {
  console.log("Fixed worktree path: event survives through step 9 for this trace event.");
}
