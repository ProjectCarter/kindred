#!/usr/bin/env node
/**
 * Static startup-path analysis — Phase 1 Batch 3 (Instant Edition).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const home = read("app/home.tsx");
const editionCache = read("lib/edition/editionCache.ts");
const instantEdition = read("lib/edition/instantEdition.ts");
const launchSession = read("lib/auth/launchSession.ts");
const editionReader = read("components/EditionReader.tsx");

console.log(
  JSON.stringify(
    {
      analyzedAt: new Date().toISOString(),
      phase: "static_path_analysis_batch3",
      note: "Runtime: [perf:metrics] BASELINE_REPORT — ttfmcSource home_instant_cache_paint | home_cache_paint | home_first_paint",
      batch3Optimizations: {
        earlyUseLayoutEffectHydrate: home.includes("useLayoutEffect") &&
          home.includes("tryApplyInstantCache"),
        primedUserIdWithoutAwait: launchSession.includes("getPrimedLaunchUserId"),
        memoryWarmCache: editionCache.includes("peekMemoryCachedEdition"),
        coalescedDiskLoads: editionCache.includes("inflightLoads"),
        paintableCacheGate: instantEdition.includes("isCachedEditionPaintable"),
        skipNetworkUiChurn: home.includes("cacheMatchesNetwork"),
        editionReaderMemo: editionReader.includes("memo(EditionReaderInner"),
        ttiMark: home.includes("home_interactive"),
      },
      expectedTtfmcOrder: [
        "home_instant_cache_paint (memory warm cache, same JS session)",
        "home_cache_paint (AsyncStorage, before network fetch completes)",
        "home_first_paint (network path, cache miss)",
      ],
      expectedStartupTimeline: [
        "layout_boot_start",
        "layout_session_ready",
        "layout_interests_ready",
        "home_instant_cache_paint | home_cache_paint (repeat launch)",
        "home_fetch_start",
        "home_editions_query_done",
        "home_sections_query_done",
        "home_first_paint | home_network_verified",
        "home_interactive",
      ],
      cacheHitPercentageEstimate: {
        repeatLaunchWithValidCache: "100% (memory or disk before network)",
        coldLaunchFirstOpenOfDay: "0% until first successful generation persists cache",
        coldLaunchSameDayRelaunch: "high (disk + optional memory)",
      },
      imagesBeforeFirstPaint: [
        "preloadMorningHeroImage on applyCachedBundle (Image.prefetch, non-blocking)",
        "Hero decodes after first paint unless warm device cache from prior session",
      ],
      flatListVirtualization: "Home uses Animated.ScrollView — virtualization not applied (no UI change in Batch 3)",
    },
    null,
    2
  )
);
