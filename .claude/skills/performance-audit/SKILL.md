---
name: performance-audit
description: Audits Kindred cold-start and edition-load performance against the 5000ms budget. Use when the app feels slow, after cache changes, before release, or when investigating fast-but-incomplete edition loads.
---

# Performance Audit

## Law (read, do not duplicate)

- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §11 Performance Standard
- [`lib/perf/startupTiming.ts`](../../../lib/perf/startupTiming.ts) — 5000 ms budget
- [`docs/perf/PHASE1_BASELINE.md`](../../../docs/perf/PHASE1_BASELINE.md)
- [`CLAUDE.md`](../../../CLAUDE.md) — fast but incomplete = failure

## Purpose

Measure and diagnose **cold launch, TTFMC, and edition load** — without accepting speed gained by hiding content.

## When to use

- Cold open exceeds ~5 seconds
- Homepage paints before content is complete
- After changes to `editionCache`, `instantEdition`, `home.tsx`, `EditionReader`
- Cache hit/miss regressions
- Before V1 release performance sign-off

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| Device or simulator | For runtime | Required for authoritative timing |
| Dev Metro logs | Optional | `[perf:startup]`, `[perf:metrics]` |
| Launch kind | | `cold_launch` vs `warm_launch` |
| Cache state | | memory warm / disk / network |

## Investigation steps

```
Progress:
- [ ] 1. Static startup path analysis
- [ ] 2. Review perf instrumentation code
- [ ] 3. Capture runtime baseline report
- [ ] 4. Trace edition load path
- [ ] 5. Confirm completeness gate not bypassed
- [ ] 6. Report findings
```

**Step 1 — Static analysis:**

```bash
node scripts/perf/analyze-startup-path.mjs
```

**Step 2 — Key files:**

- `app/home.tsx` — hydrate, paint gates
- `lib/edition/editionCache.ts` — disk + memory cache
- `lib/edition/instantEdition.ts` — paintable cache gate
- `lib/perf/startupMetrics.ts`, `coldLaunchTrace.ts`
- `lib/edition/discoveryArticleCache.ts` — deferred compose on tap

**Step 3 — Runtime (dev):** Watch Metro for:

```
[perf:startup] ... +Nms
[perf:startup] OVER BUDGET ... (max 5000ms)
[perf:startup] FAST BUT INCOMPLETE ...
[perf:metrics] BASELINE_REPORT cold_launch|repeat_launch
```

Metrics: `ttfmcMs`, `editionLoadMs`, `cacheHit`, `loadPrefsCallCount`.

**Step 4 — Edition load:** Trace `fetchEdition` → sections query → `EditionReader` mount.

**Step 5 — Completeness:** `lib/perf/editionCompleteness.ts`, `isPersistedEditionComplete()` — reject fast partial renders.

## Verification checklist

- [ ] Cold launch ≤ 5000 ms OR over-budget cause identified
- [ ] TTFMC source documented (`home_instant_cache_paint` | `home_cache_paint` | `home_first_paint`)
- [ ] Full edition desks present at first meaningful paint (not deferred hiding)
- [ ] No repeated AI generation on normal app open path
- [ ] Discovery article compose deferred until card tap (hot path)
- [ ] `loadPrefs` coalesced — not called redundantly on cold start
- [ ] Warm launch faster than cold (cache working)
- [ ] No new blocking network calls on homepage critical path
- [ ] `EditionReader` memoization intact if investigating re-renders

## Common failure patterns

| Symptom | Likely cause | Where |
|---------|--------------|-------|
| OVER BUDGET 5000ms | Sync work on critical path | `home.tsx`, edition fetch |
| FAST BUT INCOMPLETE | Cache paints before sections load | `instantEdition.ts`, completeness gate |
| Slow repeat launch | Cache miss / invalidation loop | `editionCache.ts`, warm sync |
| Blank then pop-in | Discovery sync after paint | `resolveDiscoverySync.ts` |
| Slow article open | Compose on tap doing heavy work | `discoveryArticleCache.ts` |
| High edge calls | Generation on client open | Should be prebuilt edition only |

## Output format

```markdown
# Performance Audit — [date] — [launch_kind]

## Verdict
WITHIN BUDGET | OVER BUDGET | FAST BUT INCOMPLETE

## Timings
| Metric | Value | Budget |
|--------|-------|--------|
| totalElapsedMs | | 5000 |
| ttfmcMs | | |
| editionLoadMs | | |
| cacheHit | | |

## Path
TTFMC source: ...
Edition complete at paint: YES | NO

## Static analysis highlights
(from analyze-startup-path.mjs)

## Root cause hypothesis
...

## Verified
- [ ] Static analysis
- [ ] Dev Metro logs
- [ ] Device testing

## Recommended fix (smallest safe change)
...
```
