---
name: performance-report
description: Kindred performance audit report — cold start, cache, render, network, DB timing, and release recommendation.
keep-coding-instructions: true
---

You are producing **Kindred Performance Reports**. Follow the `performance-diagnostics` and `performance-audit` skills for investigation — this style defines output shape only.

## Purpose

Standardize **performance audit deliverables** with budget comparison and ship recommendation.

## When to use

- App slower than yesterday
- Homepage hang or slow paint
- Edition build timing investigation
- Pre-release performance sign-off
- After `performance-agent` completes diagnosis

## Required sections

1. **Verdict** — `PASS | WARNING | FAIL`
2. **Cold Start** — `totalElapsedMs`, launch kind, over-budget flag
3. **Cached Start** — repeat launch metrics, cache hit source
4. **Homepage Render** — TTFMC ms, source (`home_instant_cache_paint` | `home_cache_paint` | `home_first_paint`)
5. **Discovery Render** — post-paint sync, local events status if relevant
6. **Article Load** — tap-to-reader estimate or note if not measured
7. **Database Timing** — `editionsQueryMs`, `sectionsQueryMs`, build DB writes if server-side
8. **Network Timing** — fetch counts, duplicate requests, edge calls at launch
9. **Recommendations** — ordered investigation/fix list; **Release Recommendation**

## Optional sections

- **Performance Budget table** — all targets vs measured
- **Root Cause** — one paragraph
- **Likely Impact** — audience scope
- **Evidence** — log prefixes, script outputs
- **Static Analysis** — `analyze-startup-path.mjs` highlights

## Formatting

- Title: `# Performance Report — [symptom] — [date]`
- Budget table columns: Metric | Measured | Target | Status
- Targets: cold ≤5s, cached ≤2s, TTFMC ≤2s, article ≤1s, edge@launch = 0
- Cite log prefixes: `[perf:metrics]`, `[perf:pipeline]`, `[buildEdition] timing`
- FAIL if FAST BUT INCOMPLETE or OVER BUDGET without documented cause

## Example output

```markdown
# Performance Report — repeat launch slow — 2026-07-22

## Verdict
WARNING

## Performance Budget
| Metric | Measured | Target | Status |
|--------|----------|--------|--------|
| Cold launch | 4200ms | 5s | PASS |
| Cached launch | 2800ms | 2s | WARN |
| TTFMC | 2400ms | 2s | WARN |
| Edge @ launch | 0 | 0 | PASS |

## Cold Start
4200ms, `cold_launch`, within budget.

## Cached Start
2800ms, `warm_launch`, disk hit but parse twice (`editionCacheParseCount: 2`).

## Homepage Render
TTFMC 2400ms, source `home_cache_paint`. Completeness PASS.

## Discovery Render
Background sync after paint; no block.

## Article Load
Not measured this session.

## Database Timing
editionsQueryMs: 180, sectionsQueryMs: 420.

## Network Timing
supabaseFetchCount: 2, edgeFunctionFetchCount: 0.

## Recommendations
1. Investigate duplicate cache parse — `editionCache.ts` inflight coalescing
2. Re-run after fix; target cached ≤2s

**Release Recommendation:** SHIP WITH MONITORING
```

## Expected length

**Medium–long:** 50–90 lines.

## Related Skills

- `performance-diagnostics` — **primary**
- `performance-audit` — cold-start sign-off
- `homepage-audit` — if incomplete desks suspected

## Related Subagents

- **Lead:** `performance-agent`
- **Support:** `edition-agent`, `ui-agent`, `news-agent` (desk-specific delays)
