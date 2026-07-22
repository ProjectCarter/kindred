---
name: performance-diagnostics
description: Diagnose Kindred performance regressions across edition generation, homepage rendering, articles, network, database, and images — before changing code. Use when the app feels slower, one desk blocks the page, build times spike, or release perf sign-off needs root-cause analysis.
---

# Performance Diagnostics

**Diagnose first. Fix second.** This skill is the operational troubleshooting layer for the full Kindred pipeline. For cold-start TTFMC sign-off only, also run [performance-audit](../performance-audit/SKILL.md).

## Law (read, do not duplicate)

- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §11 Performance Standard
- [`THE_PRESSES_NEVER_STOP.md`](../../../THE_PRESSES_NEVER_STOP.md) — prebuild, cron, cache philosophy
- [`docs/perf/PHASE1_BASELINE.md`](../../../docs/perf/PHASE1_BASELINE.md) — measurement methodology
- [`lib/perf/startupTiming.ts`](../../../lib/perf/startupTiming.ts) — 5000 ms cold budget (enforced in dev logs)
- [`CLAUDE.md`](../../../CLAUDE.md) — fast but incomplete = failure; no AI on normal open

## Purpose

Locate **where time is spent** and **what blocked the UI** across server build, client launch, homepage paint, and article open — using existing instrumentation and scripts, without modifying application code during diagnosis.

## When to use

- "App is slower than yesterday" (any surface)
- Homepage hangs, skeleton persists, or desks pop in late
- Edition generation or cron builds exceed expectations
- Article open feels sluggish or images arrive late
- One section (National News, Local News, Events) seems to block everything
- Before release — structured PASS / WARNING / FAIL report

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| Symptom + surface | Yes | launch / homepage / article / build |
| Device or simulator | For client | Metro logs authoritative in dev |
| `edition_date`, `user_id`, `metro_key` | For build/DB | Default Gilbert / `phoenix-az` in scripts |
| Edge Function logs | For build | `[buildEdition] timing`, `TIMING REPORT` |
| Supabase credentials | For DB audit | `.env.local` only |

---

## 1. Edition Generation Diagnostics

**Goal:** Find which build stage dominates wall-clock time.

### Key files

| Stage | File |
|-------|------|
| Full pipeline | [`supabase/functions/_shared/buildEdition.ts`](../../../supabase/functions/_shared/buildEdition.ts) |
| Job queue / cron | [`supabase/functions/process-edition-jobs/index.ts`](../../../supabase/functions/process-edition-jobs/index.ts) |
| Local News | [`selectLeadStory.ts`](../../../supabase/functions/_shared/localNews/selectLeadStory.ts), [`localNewsDesk.ts`](../../../supabase/functions/_shared/localNews/localNewsDesk.ts) |
| National News | [`resolveNationalNews.ts`](../../../supabase/functions/_shared/nationalDaily/resolveNationalNews.ts), [`selectNationalNews.ts`](../../../supabase/functions/_shared/nationalDaily/selectNationalNews.ts) |
| Story generation | [`storyEditor/`](../../../supabase/functions/_shared/storyEditor/) |
| Health report | [`lib/dev/editionHealthReport.ts`](../../../lib/dev/editionHealthReport.ts) |

### Investigation steps

```
Progress:
- [ ] 1. Confirm edition status lifecycle (queued → processing → ready)
- [ ] 2. Pull Edge Function logs for [buildEdition] timing entries
- [ ] 3. Read TIMING REPORT buckets vs Total wall-clock
- [ ] 4. Isolate News vs Events vs AI vs DB writes
- [ ] 5. Check generation_jobs for stuck / duplicate builds
- [ ] 6. Verify edition_sections written before ready
```

**Step 2 — Log patterns:**

```
[buildEdition] timing { label, ms }
[buildEdition] ===== TIMING REPORT =====
```

Per-request `timer.timed()` wraps every await-able step. Buckets: Location + Profile Reads · Weather · News · Events · Food & Drink · Today in History · AI Summaries · Bandit Payload · Editorial Opening · Database Writes · **Total**.

**Important:** Weather / News / Events / Recommendations run **concurrently** inside `Promise.all` — bucket sums can exceed Total. Compare slowest individual `[buildEdition] timing` labels, not bucket sums alone.

**Step 3 — Common slow stages:**

| Label prefix | Likely bottleneck |
|--------------|-------------------|
| `News - Local Editorial Decisions` | Local News pipeline, story selection |
| `National Daily Editorial` | US national daily attach + image payload |
| `Local Events` / `Local Events - Editorial Surface` | Provider fetch + ranking |
| `AI Summaries - Story Editor` / `Section Writing` | Claude latency |
| `Database Write - Edition Upsert` / `Sections` | Large JSON payloads, missing indexes |
| `Profile Reads - Consolidated` | N+1 or cold DB |

**Step 4 — Scripts:**

```bash
node scripts/audit-build-city-edition.ts    # local Deno build + timing
node scripts/audit-global-editions.ts     # generationTimeMs + health report
node scripts/verify-edition-completeness.mjs
```

**Step 5 — Cache writes:** Client cache is written after successful fetch in [`editionCache.ts`](../../../lib/edition/editionCache.ts) — slow builds do not block cache until `ready` + client sync. Homepage assembly on device is separate (§2).

---

## 2. Homepage Rendering Diagnostics

**Goal:** Trace first paint → interactive without accepting hidden missing desks.

### Key files

| Concern | File |
|---------|------|
| Load orchestration | [`app/home.tsx`](../../../app/home.tsx) |
| Render order | [`components/EditionReader.tsx`](../../../components/EditionReader.tsx) |
| Disk + memory cache | [`lib/edition/editionCache.ts`](../../../lib/edition/editionCache.ts) |
| Paint gate | [`lib/edition/instantEdition.ts`](../../../lib/edition/instantEdition.ts) |
| Completeness gate | [`lib/perf/editionCompleteness.ts`](../../../lib/perf/editionCompleteness.ts), [`coldLaunchTrace.ts`](../../../lib/perf/coldLaunchTrace.ts) |
| Pipeline stages | [`lib/perf/startupPipeline.ts`](../../../lib/perf/startupPipeline.ts) |
| News hydration | [`homepageNewsHydration.ts`](../../../lib/edition/homepageNewsHydration.ts), [`nationalNewsHydration.ts`](../../../lib/edition/nationalNewsHydration.ts) |
| Discovery defer | [`discoveryArticleCache.ts`](../../../lib/edition/discoveryArticleCache.ts) |

### Render order (do not guess)

MorningArrival → Local Events → Activities → Food & Drinks → Story of → Today in History → Bandit's Picks (V1 hidden) → **Local News** → **National News** → Community → History Around Town — source: `EditionReader.tsx`.

### Investigation steps

```
Progress:
- [ ] 1. Static startup path analysis
- [ ] 2. Capture [perf:metrics] BASELINE_REPORT
- [ ] 3. Read [perf:pipeline] stage SUMMARY
- [ ] 4. Trace TTFMC source (instant vs cache vs network)
- [ ] 5. Run [coldLaunch:trace] desk stages if desks missing
- [ ] 6. Check news hydration not blocking first paint
- [ ] 7. Confirm discovery compose NOT on homepage mount
```

**Step 1:**

```bash
node scripts/perf/analyze-startup-path.mjs
```

**Step 2 — Dev Metro patterns:**

```
[perf:startup] <mark> +Nms
[perf:startup] OVER BUDGET (max 5000ms)
[perf:startup] FAST BUT INCOMPLETE
[perf:metrics] BASELINE_REPORT cold_launch|repeat_launch
[perf:pipeline] BEGIN|END cache_load|edition_lookup|edition_sections|normalization|completeness|first_paint|background_sync
[coldLaunch:trace] desk present/missing per stage
```

**Metrics to record:** `ttfmcMs`, `ttfmcSource`, `editionLoadMs`, `editionsQueryMs`, `sectionsQueryMs`, `cacheHit`, `editionCacheMemoryHitCount`, `editionCacheDiskHitCount`, `loadPrefsCallCount`, `supabaseFetchCount`, `edgeFunctionFetchCount`.

**Skeleton / loading:** `home.tsx` uses `PaperLoading` while `loading === true`; safety timeout clears stuck spinner (~15s). `generating` state during overnight prebuild is separate from cache paint.

**Hydration timing:** `useLayoutEffect` + `tryApplyInstantCache` paints disk/memory before network. News desks merge via `mergeNationalNewsHydration` / `resolveEditionNewsDesks` — should not block leaving loading if cache bundle is paintable (`isCachedEditionPaintable`).

**React bottlenecks:** `EditionReader` is memoized; heavy `useMemo` for section allocation. Watch for parent re-renders in `home.tsx` state churn after network merge. `traceEditionReaderRender` in dev traces render cost.

**Async loading:** Local Events status (`localEventsStatus`) can show loading independently; background sync after first paint via `background_sync` pipeline stage.

---

## 3. Rich Article Performance

**Goal:** Article open should feel instant; heavy work happens on tap, not on homepage.

### Key files

| Concern | File |
|---------|------|
| Open handoff | [`lib/edition/openArticle.ts`](../../../lib/edition/openArticle.ts) |
| In-memory stash (LRU 16) | [`lib/edition/articleStore.ts`](../../../lib/edition/articleStore.ts) |
| Route + session | [`app/article/[id].tsx`](../../../app/article/[id].tsx) |
| Reader UI | [`components/ArticleReader.tsx`](../../../components/ArticleReader.tsx) |
| Adapters / templates | [`lib/edition/article.ts`](../../../lib/edition/article.ts), [`contentSystem`](../../../lib/edition/contentSystem/) |
| Discovery compose on tap | [`discoveryArticleCache.ts`](../../../lib/edition/discoveryArticleCache.ts) — `composeDiscoveryArticleOnTap` |
| Hero resolution | [`lib/edition/articleHero.ts`](../../../lib/edition/articleHero.ts) |

### Investigation steps

```
Progress:
- [ ] 1. Confirm article stashed before router.push (not param payload)
- [ ] 2. Measure tap → first reader frame (target ≤ 1s)
- [ ] 3. Check composeDiscoveryArticleOnTap only on Activities/Recommendations tap
- [ ] 4. Inspect article.body length + module count for long-form desks
- [ ] 5. Profile hero Image decode (ArticleReader instantEnter path)
- [ ] 6. Verify withContentSystem / ensureArticleHero not duplicated
- [ ] 7. Watch articleStore LRU evictions on long sessions (MAX_STASHED = 16)
```

**Large payloads:** Masterpiece, Story of, long Recommendations — body lives in stash, not URL. Slow open often = sync compose + hero fetch, not navigation itself.

**Markdown rendering:** `ArticleReader` renders structured body; check for oversized inline image arrays or repeated module maps.

**Memory:** Bounded stash + companion store; unbounded growth suggests leak outside `articleStore`.

---

## 4. Network Diagnostics

**Goal:** Find slow, failed, duplicate, or sequential calls that should be parallel.

### Instrumentation

| Tool | Scope |
|------|-------|
| [`installStartupFetchProbe.ts`](../../../lib/perf/installStartupFetchProbe.ts) | Dev startup window only |
| `startupMetrics` counters | `supabaseFetchCount`, `edgeFunctionFetchCount`, `otherFetchCount` |
| Metro `[home] loadEdition:` logs | Fetch start, date filters, merge traces |
| Edge `[buildEdition] timing` | Server-side provider calls |

### Checklist

- [ ] **Slow APIs:** Compare `editionsQueryMs` + `sectionsQueryMs` vs total `editionLoadMs`
- [ ] **Failed APIs:** `completeEditionLoadFailure` in [`lib/analytics/editionLoad.ts`](../../../lib/analytics/editionLoad.ts); Metro errors on fetch
- [ ] **Duplicate requests:** `loadPrefsCallCount` > 1 on cold start; repeated `loadEdition` without guard; cache invalidated loop
- [ ] **Retry loops:** `home.tsx` safety timeout; generation polling during `processing`
- [ ] **Timeouts:** 15s loading safety timeout; MasterpieceLoading 5s timeout
- [ ] **Edge on open:** `edgeFunctionFetchCount` should be **0** on normal cached launch — generation belongs in prebuild
- [ ] **Parallel vs sequential:** Build uses `Promise.all` for independent desks; client should not await discovery compose before paint

### Red flags

| Pattern | Meaning |
|---------|---------|
| High `edgeFunctionFetchCount` at launch | Client triggering generation — investigate home generate path |
| `supabaseFetchCount` spikes after paint | Background sync OK; before paint = regression |
| Same URL fetched twice in startup probe | Missing coalescing (`inflightLoads` in editionCache) |
| National News network fetch after cache paint | Stale `nationalNews` in bundle — hydration path |

---

## 5. Database Diagnostics

**Goal:** Supabase latency, incomplete rows, and cache/hydration mismatches.

### Client queries (typical launch)

1. `editions` row (discovery, lead_story, national_news, editorial_context, …)
2. `edition_sections` by edition_id
3. Optional: weather, profile, generation_jobs status

### Build queries

Profile reads consolidated; edition upsert; bulk section writes — timed in buildEdition.

### Checklist

- [ ] **Slow queries:** `editionsQueryMs` / `sectionsQueryMs` in BASELINE_REPORT; build `Database Write` bucket
- [ ] **Missing indexes:** Full table scans on `edition_sections(edition_id)`, `editions(user_id, edition_date)` — check Supabase query plan if times spike
- [ ] **N+1:** Build timer should show consolidated reads; scattered `Profile Reads` retries = regression
- [ ] **Cache misses:** `editionCacheMissCount` ↑ with valid same-day edition = invalidation bug or metroKey mismatch
- [ ] **Hydration failures:** `[coldLaunch:trace] Supabase marked ready but persisted payload incomplete`; `isPersistedEditionComplete()` false
- [ ] **Stale ready:** Edition `ready` before sections exist — should be impossible post Phase 2; if seen, check migration + build order

### Scripts

```bash
node scripts/verify-edition-completeness.mjs
# Supabase: editions.status, edition_sections count, national_news column populated
```

---

## 6. Image Diagnostics

**Goal:** Images must not block text; wrong/missing/oversized assets traced to source.

### Policy

- Homepage listings: text-first, emoji identifiers — [kindred-editorial-design.mdc](../../../.cursor/rules/kindred-editorial-design.mdc)
- Article pages: hero + inline — [`ArticleReader.tsx`](../../../components/ArticleReader.tsx), [`v1ImagePolicy.ts`](../../../lib/edition/v1ImagePolicy.ts)
- Build note: event/place images are URLs from providers — no server-side image processing in build timer

### Key files

| Concern | File |
|---------|------|
| Morning hero prefetch | [`heroArtwork/preload.ts`](../../../lib/edition/heroArtwork/preload.ts) — `Image.prefetch`, non-blocking |
| National News images | [`buildNationalNewsStoryPayload`](../../../supabase/functions/_shared/nationalDaily/) |
| Local News hero | [`LeadStory.ts`](../../../lib/edition/LeadStory.ts), lead story build |
| Today in History sync | [`todayInHistorySync.ts`](../../../lib/edition/todayInHistorySync.ts), [`todayInHistoryImage.ts`](../../../lib/edition/todayInHistoryImage.ts) |
| Masterpiece traces | [`masterpieceDiagnostics.ts`](../../../lib/edition/masterpieceDiagnostics.ts) |

### Checklist

- [ ] **Incorrect images:** National vs Local desk mix-up — run [news-pipeline-audit](../news-pipeline-audit/SKILL.md)
- [ ] **Missing images:** `heroImage.uri` empty; `instantEnter` defers decode in ArticleReader
- [ ] **Oversized downloads:** Remote URLs without CDN resize — profile with network tab / Flipper
- [ ] **Placeholders:** Editorial fallback sources in ArticleReader; V1 text-only listings skip photos
- [ ] **Late appearance:** Hero prefetch runs on cache apply; cold image cache = decode after paint
- [ ] **Local vs National consistency:** Same story should use same icon/image on homepage, See All, and article — stored on article payload, not re-fetched per surface

---

## 7. Performance Budget (Release Targets)

| Metric | Target | Enforcement |
|--------|--------|-------------|
| Cold launch (first open of day) | ≤ **5 s** | `startupTiming.ts` dev OVER BUDGET log |
| Cached / repeat launch | ≤ **2 s** | Release target; measure `repeat_launch` `totalElapsedMs` |
| Homepage render (TTFMC) | ≤ **2 s** | `ttfmcMs` in BASELINE_REPORT |
| Article open (tap → reader) | ≤ **1 s** | Manual trace; stash path should be near-instant |
| Blocking network on UI thread | **None** on critical path | Fetch probe + pipeline stages |
| Independent fetches | **Parallelize** | Build `Promise.all`; client cache-before-network |

**Hard rule:** Fast but incomplete = **FAIL** — [`editionCompleteness.ts`](../../../lib/perf/editionCompleteness.ts), FAST BUT INCOMPLETE log.

**Hard rule:** No repeated AI generation on normal app open — edition loads from prebuild + cache.

---

## 8. Regression Checklist (Symptom → Flow)

Run the matching flow **before** proposing code changes.

### "App is slower than yesterday"

1. Compare `BASELINE_REPORT` cold vs repeat launch
2. Check cache hit counts and `ttfmcSource` shift (instant → network = cache regression)
3. Diff recent changes to `home.tsx`, `editionCache`, `EditionReader`
4. Run static analysis script
5. If server-side: compare latest `[buildEdition] TIMING REPORT` to prior day

### "Homepage hangs"

1. Is `loading` stuck? Check safety timeout logs
2. Is `generating` true while job `processing`? Expected overnight; bug if daytime
3. Pipeline SUMMARY — which stage never ENDs?
4. Completeness gate refusing partial paint?
5. Run [homepage-audit](../homepage-audit/SKILL.md) for empty vs slow

### "Edition generation slow"

1. Edge logs — top 5 `[buildEdition] timing` labels by ms
2. TIMING REPORT buckets vs Total
3. Stuck `generation_jobs` / duplicate claims — [edition-builder](../edition-builder/SKILL.md)
4. `audit-global-editions.ts` generationTimeMs trend

### "Articles open slowly"

1. Discovery card? Confirm `composeDiscoveryArticleOnTap` cost
2. Pre-stashed lead/masterpiece? Should skip compose
3. Hero URI fetch blocking render?
4. `validateArticleHandoff` failure aborting open?

### "Images appear late"

1. Prefetch on cache apply (`preloadMorningHeroImage`)
2. Article hero `instantEnter` path
3. Oversized remote URL
4. National/Local image payload empty at build — server issue not client

### "One section blocks everything"

1. Identify desk in EditionReader order
2. `[coldLaunch:trace]` — which stage first shows `present: false`?
3. Sync work in parent before paint? (section allocation useMemo)
4. Local Events independent status vs global loading

### "National News delays homepage"

1. `mergeNationalNewsHydration` — runs after edition row load, not before cache paint
2. `columnOnly: true` — no legacy top_stories fallback during sync
3. Empty `nationalNews` in cache but network row has data — hydration merge bug
4. Run [national-news-verification](../national-news-verification/SKILL.md)

### "Local News delays homepage"

1. `lead_story` / `editorial_context` parse on editions row
2. `resolveLocalNewsHomePackage` / teaser build cost in EditionReader
3. Build-side: `News - Local Editorial Decisions` timing
4. Run [local-news-verification](../local-news-verification/SKILL.md)

---

## 9. Release Report (Required End State)

Every diagnostic session ends with this report. Do not ship fixes without filling it in.

```markdown
# Performance Diagnostics — [date] — [symptom]

## Verdict
PASS | WARNING | FAIL

## Performance Budget
| Metric | Measured | Target | Status |
|--------|----------|--------|--------|
| Cold launch | | 5s | |
| Cached launch | | 2s | |
| TTFMC | | 2s | |
| Article open | | 1s | |
| Edge calls at launch | | 0 | |

## Root Cause
[Primary bottleneck — one sentence, evidence-backed]

## Likely Impact
[Who feels it: all users / cache miss only / one metro / build cron only]

## Evidence
- Static: analyze-startup-path.mjs — …
- Runtime: BASELINE_REPORT / pipeline SUMMARY — …
- Server: buildEdition TIMING REPORT — …
- DB: editions + sections — …

## Suggested Investigation Order
1. …
2. …
3. …

## Release Recommendation
SHIP | SHIP WITH MONITORING | DO NOT SHIP

## Related Skills Run
- [ ] performance-audit
- [ ] homepage-audit
- [ ] edition-builder
- [ ] news-pipeline-audit
```

### Verdict guide

| Verdict | When |
|---------|------|
| **PASS** | All measured surfaces within budget; completeness gate passes; no blocking regressions |
| **WARNING** | One surface 10–25% over target OR intermittent cache miss OR single-desk late pop-in with complete edition |
| **FAIL** | OVER BUDGET cold launch; FAST BUT INCOMPLETE; Edge generation on open; hung loading; build > SLA; missing desks traded for speed |

---

## Quick Reference — Log Prefixes

| Prefix | Layer |
|--------|-------|
| `[perf:startup]` | Launch marks + budget |
| `[perf:metrics]` | BASELINE_REPORT snapshot |
| `[perf:pipeline]` | loadEdition sub-stages |
| `[coldLaunch:trace]` | Per-desk presence |
| `[buildEdition] timing` | Server build steps |
| `[home] loadEdition:` | Client fetch orchestration |
| `masterpieceTrace` | Hero / masterpiece image path |

## Do not

- Modify application code during diagnosis (this skill is read-only)
- Accept speed gained by hiding missing desks
- Duplicate editorial or performance law — follow links above
- Confuse this skill with [performance-audit](../performance-audit/SKILL.md) — run both for release sign-off
