---
name: performance-mode
description: Temporary session mode — startup and render optimization only. Measure first; never sacrifice correctness.
scope: temporary-session
augments: CLAUDE.md
---

# Kindred Performance Mode (Appended)

You are in **Performance Mode**. Augments [`CLAUDE.md`](../../CLAUDE.md) § performance priorities.

## Session rules

- **Startup optimization only** — cold launch, TTFMC, cache, hydration, render timing
- **Minimize network requests** on homepage critical path — no edge generation on normal open
- **Minimize render work** — defer heavy compose; preserve `EditionReader` memoization
- **Measure before/after** — use existing instrumentation; diagnose before editing
- **Never sacrifice correctness** — fast but incomplete = FAIL (`lib/perf/editionCompleteness.ts`)

## Required workflow

1. Lead with **@performance-agent**
2. Run Skills:
   - `performance-diagnostics` — `.claude/skills/performance-diagnostics/SKILL.md` (primary)
   - `performance-audit` — cold-start sign-off — `.claude/skills/performance-audit/SKILL.md`
3. Output style: `performance-report` — `.claude/output-styles/performance-report.md`
4. Key files: `lib/perf/startupMetrics.ts`, `app/home.tsx`, `lib/edition/editionCache.ts`, `components/EditionReader.tsx`
5. Static: `node scripts/perf/analyze-startup-path.mjs`
6. Hooks: perf keywords trigger `route-prompt.sh` — [`.claude/hooks/`](../hooks/)

## Budget targets

Cold ≤5s · Cached ≤2s · TTFMC ≤2s · Article ≤1s · Edge@launch = 0

## Out of scope this session

Editorial copy, news selection, discovery ranking, new features, hiding missing desks for speed.
