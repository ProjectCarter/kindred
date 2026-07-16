# Phase 1 — Baseline & Batch 1 Report

**Recorded:** 2026-07-16  
**Scope:** Measurement infrastructure + Batch 1 (`loadPrefs` launch memoization)  
**Status:** Batch 1 complete — awaiting device runtime confirmation before Batch 2

---

## Measurement methodology

### Runtime (primary)

On every dev launch, Metro logs include:

```
[perf:metrics] BASELINE_REPORT <cold_launch|repeat_launch>
```

Snapshot fields:

| Metric | Source |
| --- | --- |
| Cold-start time | `totalElapsedMs` when `launchKind === "cold_launch"` |
| Warm-start time | `totalElapsedMs` when `launchKind === "warm_launch"` (repeat_launch) |
| TTFMC | `ttfmcMs` — first of `home_cache_paint` (cache hit) or `home_first_paint` (network) |
| Startup network requests | `supabaseFetchCount` + `otherFetchCount` (dev fetch probe) |
| Edge Function calls | `edgeFunctionFetchCount` |
| Cache hit vs miss | `cacheHit` boolean + `ttfmcSource` |
| Edition load time | `editionLoadMs`, `editionsQueryMs`, `sectionsQueryMs` |
| `loadPrefs` coalescing | `loadPrefsCallCount`, `loadPrefsCacheHitCount` |
| Auth session reads | `authGetSessionCount` |
| Memory | `memoryNote` — use Xcode Instruments / Android Profiler on device |

### Static (supplement)

```bash
node scripts/perf/analyze-startup-path.mjs
```

---

## Pre–Batch 1 baseline (inferred from code path)

Instrumentation was added in the same session as Batch 1. **Pre-change behavior** is reconstructed from static analysis of the launch path (no device run on pre-memo code).

### Launch path — location prefs

Concurrent callers during cold start:

1. `home.tsx` mount → `resolveActivePlace()` → `loadPrefs()`
2. `useLocationFirstRun()` → `isFirstRunPending()` → `loadPrefs()`
3. `fetchEdition()` → `resolveActivePlace()` → `loadPrefs()`

**Before Batch 1:** each call ran the full pipeline independently:

- `AsyncStorage.getItem(LOCATION_PREFS_KEY)` × N
- `migrateLegacyCache()` × N
- `hydratePrefsFromProfile()` × N (may add `auth.getUser()` + `profiles` REST when local prefs empty)

**Expected:** 3 full `loadPrefs` paths on typical cold launch (N = 3).

### Launch path — auth & network

| Signal | Pre–Batch 1 (static) |
| --- | --- |
| `getSession()` call sites at launch | 4 (layout ×2 paths, home ×2) |
| Supabase REST on happy path (cache miss) | profiles.interests, editions, edition_sections |
| Edge Functions on happy path | 0 |
| TTFMC marks | `home_cache_paint` or `home_first_paint` |

### Timing (pre–Batch 1)

No pre-memo device capture exists. **TTFMC and wall-clock times require a device run** using the new instrumentation on a branch without Batch 1, or A/B comparison on the same device before/after. Until then, Batch 1 is validated on **counter deltas** (`loadPrefs` coalescing), not wall-clock claims.

---

## Batch 1 — What changed

### Optimization

**Memoize concurrent `loadPrefs()` during launch** in `lib/location/kindredLocation.ts`:

- Single shared `launchPrefsPromise` for in-flight reads
- `invalidateLaunchPrefsCache()` on every `writePrefs()` and on error
- Dev counters: `recordLoadPrefsInvocation(cached)`

### Instrumentation (no UX impact)

| File | Role |
| --- | --- |
| `lib/perf/startupMetrics.ts` | Structured snapshot + `[perf:metrics] BASELINE_REPORT` |
| `lib/perf/installStartupFetchProbe.ts` | Dev-only `global.fetch` counter for Supabase + Edge |
| `lib/perf/startupTiming.ts` | Wires marks → metrics report at first paint |
| `app/_layout.tsx` | Install probe, begin probe, count layout `getSession` |
| `app/home.tsx` | Count home `getSession` in `fetchEdition` |
| `scripts/perf/analyze-startup-path.mjs` | Static launch-path helper |

---

## Batch 1 — Before / after (measurable)

| Metric | Before (inferred) | After (expected on device) | Notes |
| --- | --- | --- | --- |
| Full `loadPrefs` pipelines / launch | 3 | 1 | 2+ coalesced via cache hits |
| `loadPrefsCallCount` | 3 | 3 | Same callers; behavior differs |
| `loadPrefsCacheHitCount` | 0 | ≥ 2 | **Primary Batch 1 win** |
| AsyncStorage reads (`LOCATION_PREFS_KEY`) | 3 | 1 | Per launch window |
| Duplicate `hydratePrefsFromProfile` | up to 3 | 1 | Avoids redundant profile REST |
| TTFMC | TBD device | TBD device | Not claimed until device run |
| Cold / warm wall clock | TBD device | TBD device | Not claimed until device run |
| `authGetSessionCount` | unchanged | unchanged | Batch 1 does not dedupe session |
| Supabase fetch count (happy path) | unchanged | unchanged | Batch 1 targets prefs I/O only |
| Edge Function count | 0 | 0 | Unchanged |
| Visible UX | — | unchanged | No layout, copy, or navigation changes |

---

## Validation results

| Check | Result |
| --- | --- |
| `node scripts/perf/analyze-startup-path.mjs` | Pass — cache invalidation wired |
| `npm run typecheck` | Pre-existing errors in unrelated files (`TimeStylePackage.tsx`, `localEvents.ts`) — **not introduced by Batch 1** |
| Batch 1 files lint-clean | No new errors in touched perf/location files |
| Device `[perf:metrics] BASELINE_REPORT` | **Pending** — run app in Expo dev, cold + warm launch, paste logs below |

### Device capture checklist (for you)

1. Kill app completely → cold launch → copy `BASELINE_REPORT cold_launch`
2. Background → foreground (or navigate away and back) → copy `BASELINE_REPORT repeat_launch`
3. Confirm `loadPrefsCacheHitCount >= 2` on cold launch

---

## Regressions found

| Issue | Severity | Action |
| --- | --- | --- |
| Unrelated `paper.page` background in `_layout` / `home` | UX | **Reverted** — not part of Batch 1 |
| No pre-memo device baseline | Process | Documented; future batches should capture device baseline before optimization |
| Typecheck failures on branch | Pre-existing | Out of Batch 1 scope |

---

## UX / editorial preservation (Batch 1)

Confirmed for Batch 1 scope:

- Homepage section order unchanged
- Navigation unchanged
- Editorial design unchanged
- All existing features preserved
- Dev-only metrics (`__DEV__` guards) — zero production overhead
- `loadPrefs` memo returns identical `LocationPrefs` data; only I/O coalescing differs

---

## Next batch (not started)

Batch 2 candidates (require separate approval after Batch 1 device validation):

- Auth `getSession` deduplication (layout + home)
- EditionReader side-effect `useMemo` fixes
- Status-only background job polling

**Do not proceed until Batch 1 device metrics are recorded above.**
