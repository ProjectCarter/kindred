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

const loadPrefsCallsInHome =
  (home.match(/loadPrefs|resolveActivePlace|getLocationPrefs|getActiveLocation|isFirstRunPending/g) ?? [])
    .length;
const getSessionInHome = (home.match(/getSession/g) ?? []).length;
const getSessionInLayout = (layout.match(/getSession/g) ?? []).length;
const writePrefsInvalidates = location.includes("invalidateLaunchPrefsCache");

const loadPrefsCallSites = [
  "home mount: resolveActivePlace → loadPrefs",
  "home fetchEdition: resolveActivePlace → loadPrefs",
  "useLocationFirstRun: isFirstRunPending → loadPrefs",
];

console.log(JSON.stringify({
  analyzedAt: new Date().toISOString(),
  phase: "static_path_analysis",
  note: "Runtime metrics require device run — look for [perf:metrics] BASELINE_REPORT in Metro logs",
  homeLocationRelatedReferences: loadPrefsCallsInHome,
  loadPrefsCallSitesAtLaunch: loadPrefsCallSites,
  loadPrefsExpectedBeforeBatch1: {
    fullPipelineExecutions: loadPrefsCallSites.length,
    asyncStorageReads: loadPrefsCallSites.length,
  },
  loadPrefsExpectedAfterBatch1: {
    fullPipelineExecutions: 1,
    asyncStorageReads: 1,
    cacheHitsMin: loadPrefsCallSites.length - 1,
  },
  getSessionCalls: {
    layout: getSessionInLayout,
    home: getSessionInHome,
    total: getSessionInLayout + getSessionInHome,
  },
  launchPrefsCacheInvalidationWired: writePrefsInvalidates,
  expectedSupabaseQueriesColdMiss: [
    "profiles.interests (layout boot)",
    "editions.maybeSingle (home)",
    "edition_sections.select (home, sequential after editions)",
  ],
  expectedEdgeFunctionsOnHappyPath: 0,
  ttfmcMarks: ["home_cache_paint (cache hit)", "home_first_paint (network path)"],
}, null, 2));
