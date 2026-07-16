#!/usr/bin/env node
/**
 * Static startup-path analysis — baseline helper (no runtime required).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const home = read("app/home.tsx");
const layout = read("app/_layout.tsx");
const location = read("lib/location/kindredLocation.ts");
const launchSession = read("lib/auth/launchSession.ts");

const loadPrefsCallsInHome =
  (home.match(/loadPrefs|resolveActivePlace|getLocationPrefs|getActiveLocation|isFirstRunPending/g) ?? [])
    .length;
const getSessionDirectInHome = (home.match(/supabase\.auth\.getSession/g) ?? []).length;
const getLaunchSessionInHome = (home.match(/getLaunchSessionOrFetch/g) ?? []).length;
const getSessionInLayout = (layout.match(/supabase\.auth\.getSession/g) ?? []).length;
const writePrefsInvalidates = location.includes("invalidateLaunchPrefsCache");
const launchSessionPrimed = launchSession.includes("primeLaunchSession");
const sectionsPrefetch = home.includes("prefetchedSectionsPromise");
const focusSkipInitial = home.includes("initialFocusLocationHandledRef");
const jobPollLightweight = home.includes("pollBackgroundJobProgress");

const loadPrefsCallSites = [
  "home mount: resolveActivePlace → loadPrefs",
  "useLocationFirstRun: isFirstRunPending → loadPrefs",
  "home loadEdition: resolveActivePlace (skipped when activeLocationRef set)",
];

console.log(JSON.stringify({
  analyzedAt: new Date().toISOString(),
  phase: "static_path_analysis_batch2",
  note: "Runtime metrics require device run — look for [perf:metrics] BASELINE_REPORT in Metro logs",
  batch2Optimizations: {
    launchSessionDedup: launchSessionPrimed,
    sectionsParallelPrefetch: sectionsPrefetch,
    skipInitialFocusLocationRead: focusSkipInitial,
    lightweightJobPolling: jobPollLightweight,
  },
  homeLocationRelatedReferences: loadPrefsCallsInHome,
  loadPrefsCallSitesAtLaunch: loadPrefsCallSites,
  loadPrefsExpectedAfterBatch1: {
    fullPipelineExecutions: 1,
    asyncStorageReads: 1,
    cacheHitsMin: 2,
  },
  loadPrefsExpectedAfterBatch2: {
    fullPipelineExecutions: 1,
    asyncStorageReads: 1,
    cacheHitsMin: 2,
    resolveActivePlaceAtLaunch: "1 (mount only; loadEdition reuses ref; focus skipped on first paint)",
  },
  getSessionCalls: {
    layoutDirect: getSessionInLayout,
    homeDirect: getSessionDirectInHome,
    homeLaunchSession: getLaunchSessionInHome,
    startupExpectedAfterBatch2: {
      directGetSession: 1,
      launchSessionCacheHits: 1,
      totalSessionReads: 2,
      duplicateStartupReadsRemoved: 1,
    },
  },
  launchPrefsCacheInvalidationWired: writePrefsInvalidates,
  expectedSupabaseQueriesColdMiss: [
    "profiles.interests (layout boot)",
    "editions.maybeSingle (home)",
    "edition_sections.select (home — may overlap editions query on cache hit)",
  ],
  expectedSupabaseQueriesRepeatLaunchCacheHit: [
    "profiles.interests (layout boot, if not warm)",
    "editions.maybeSingle (home)",
    "edition_sections.select (parallel with editions when cached editionId matches)",
  ],
  expectedEdgeFunctionsOnHappyPath: 0,
  ttfmcMarks: ["home_cache_paint (cache hit)", "home_first_paint (network path)"],
}, null, 2));
