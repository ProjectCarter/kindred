# Kindred — Claude Code Operating Guide

**Read this before engineering, editorial, or product work on Kindred.**

This is the concise entry point for Claude Code. It does not replace the detailed
constitution, Cursor rules, or editorial docs — it routes you to them and defines
how to work safely in this repository.

---

## Project Mission

Kindred is a **United States-only**, local-first **morning newspaper and discovery
app**. Each city edition helps readers answer: *"What should I do today?"*

- **Discovery is the product.** Local Events, Activities, and Food & Drinks are the heartbeat.
- **The newspaper is the presentation.** Calm, curated, family-safe, trustworthy.
- **Trust beats volume.** Verified facts only — never fabricated reporting, events, dates, or sources.

Full product law: [`docs/KINDRED_CONSTITUTION.md`](docs/KINDRED_CONSTITUTION.md)

---

## Current Development Phase

Kindred is in **stabilization and Version 1 launch preparation**.

Priorities, in order:

1. **Reliability** — editions build, cache, and render completely
2. **Accuracy** — verified content, correct geography, honest fallbacks
3. **Performance** — cold open within budget; no repeated AI on normal app open
4. **Complete editions** — required sections present; no silent desk removal
5. **Editorial quality** — newspaper prose, not AI filler
6. **Security** — no leaked secrets; validated external data
7. **Visual polish** — preserve locked design; text-first homepage listings
8. **New features** — only after the above are stable

---

## Instruction Hierarchy

When guidance conflicts, resolve in this order:

1. **Explicit current user instruction**
2. **`CLAUDE.md`** (this file)
3. **Applicable `.cursor/rules/*.mdc`** — scoped rules win over general ones for matching files
4. **Current committed editorial documentation** — `docs/editorial/`, `docs/KINDRED_CONSTITUTION.md`
5. **Existing code behavior and tests**
6. **Older or stale documentation** — e.g. `KINDRED_CONSTITUTION_v1.0.md`, `ROADMAP.md`

**Do not silently ignore contradictions.** Report conflicts to the user and prefer
committed code + active Cursor rules over stale docs.

---

## Required Reading Before Work

For non-trivial tasks, inspect:

- Applicable **`.cursor/rules/*.mdc`** (24 rules — see Source Map)
- **Relevant code paths** — trace data from source → edition → homepage → reader
- **Relevant tests and scripts** — `package.json` scripts, `lib/edition/*.test.ts`, `scripts/audit-*`
- **Active editorial standards** — `lib/edition/kindredEditorialStandards.ts`, `kindredArticleProse.ts`
- **`git status`** — protect unrelated uncommitted work

Do not assume a rule exists because it was discussed in a prior chat. Verify in the repo.

---

## Development Workflow

For non-trivial tasks:

1. **Inspect before editing** — read the files you will touch and their callers.
2. **Trace the flow** — edition build, cache, sync, render, or reader path as applicable.
3. **Identify root cause** — fix the source, not a symptom in an unrelated layer.
4. **Smallest safe change** — no drive-by refactors or scope creep.
5. **Avoid unrelated refactors** — match existing naming, types, and patterns.
6. **Review the diff** — confirm only intended files changed.
7. **Run relevant checks** — see Verification Rules.
8. **Report what was and was not verified** — distinguish automated vs manual.

---

## Preservation Rules

- **Never remove or hide working homepage sections** unless explicitly requested.
- **Never fix one section by disabling another.**
- **Local News and National News are separate desks** — both must remain; Local News renders above National News.
- **Never hide performance problems** by skipping required content or desks.
- **Preserve existing design and navigation** unless the task explicitly changes them.
- **Locked homepage architecture** — see `kindred-editorial-design.mdc`; do not redesign without explicit request.
- **Protect unrelated uncommitted work** — do not revert, discard, or overwrite files outside the task scope.
- **Bandit's Picks (V1)** — hidden via feature flag (`BANDITS_PICKS_ENABLED = false`); do not re-enable or delete backend logic without explicit request.

---

## Verification Rules

Never declare success only because code compiles.

When relevant, verify:

| Check | Command / method |
|-------|------------------|
| Typecheck | `npm run typecheck` |
| Unit tests | `npm run test:generation`, `npm run test:markets`, targeted `node --test …` |
| Nationwide audit | `npm run test:nationwide-audit` |
| Mirror sync | `npm run check:mirror-sync` |
| City edition audit | `node scripts/audit-gilbert-homepage-today.mjs` (and related `scripts/audit-*`) |
| Loading / empty / error states | Inspect components and fallbacks |
| Cached vs uncached paths | Edition cache, warm homepage sync |
| Multi-city behavior | Gilbert identity + metro discovery (`lib/edition/discoveryGeography.ts`) |
| Required homepage sections | `components/EditionReader.tsx` render order |
| Local News above National News | Confirmed in `EditionReader.tsx` |
| No secrets in diff | Inspect for `.env`, service-role keys, debug credential logs |

Clearly distinguish in your report:

- **Verified automatically** (commands run, tests passed)
- **Verified by inspection** (code read, logic traced)
- **Still requiring device testing** (runtime perf, scroll position, cold launch)

Performance target: **5000 ms cold-start budget** (`lib/perf/startupTiming.ts`). Fast but incomplete editions are not success.

---

## Editorial and Product Guardrails

Detailed law lives in **`.cursor/rules/`** — do not duplicate all 24 rules here.

Non-negotiables (summarized):

| Rule | Source |
|------|--------|
| No fabricated reporting, quotes, events, dates, or sources | `kindred-editorial-constitution.mdc` |
| No AI-generated app imagery | `kindred-editorial-design.mdc`, desk-specific image rules |
| Authorized, subject-matched images only; text-only beats wrong image | Image rules across `.cursor/rules/` |
| Family-safe content; adult venues excluded before ranking | `kindred-editorial-constitution.mdc` |
| Local businesses preferred over chains when quality is comparable | `kindred-local-business-first.mdc`, `localBusinessFirst.ts` |
| United States only (V1) | Market/edition architecture |
| National daily content shared nationwide (Masterpiece, Today in History, National News) | Edition build + `EditionReader` |
| No repeated AI generation on normal app open | Prebuilt/cached editions — `THE_PRESSES_NEVER_STOP.md` |
| Unique conclusions; no AI wrap-ups ("In conclusion…") | `kindredArticleProse.ts`, `uniqueConclusions.ts` |
| One category = one emoji on listings | `kindred-visual-language.mdc` |
| Homepage listings are text-first (emoji + headline + summary) | `kindred-editorial-design.mdc` |

Engineering gates: `validateKindredArticleProse()`, Story Editor validators, confidence/score modules.

---

## Security

- **Never expose secrets or service-role keys** in code, logs, commits, or chat output.
- **Never commit real `.env` credentials** — use `.env.local.example` patterns only.
- **Never print secrets to logs** — including Supabase keys in debug scripts.
- **Validate external data** — treat API responses as untrusted until verified.
- **Flag security findings clearly** — do not silently patch around credential exposure.

---

## Git Safety

- Run **`git status`** before and after work.
- **Do not discard unrelated work** — stage only task-relevant files.
- **Do not commit or push without explicit user permission.**
- **Summarize the diff** before recommending a commit.
- Follow the user's commit message style from recent `git log`.

---

## Completion Report

For non-trivial work, report:

1. **Root cause** (or design rationale for new work)
2. **What changed**
3. **Files changed**
4. **Checks run** and results
5. **Manual verification still needed**
6. **Known risks**

---

## Source Map

| Area | Location |
|------|----------|
| Cursor rules (24) | `.cursor/rules/*.mdc` |
| Product constitution | `docs/KINDRED_CONSTITUTION.md` |
| Editorial handbooks | `docs/editorial/` |
| Edition / discovery logic | `lib/edition/` |
| Story Editor + validators | `supabase/functions/_shared/storyEditor/` |
| Editorial standards digest | `lib/edition/kindredEditorialStandards.ts` |
| Prose publication gate | `lib/edition/kindredArticleProse.ts` |
| Local Business First | `lib/edition/localBusinessFirst.ts` |
| Discovery geography | `lib/edition/discoveryGeography.ts` |
| Homepage render order | `components/EditionReader.tsx` |
| Bandit's Picks V1 gate | `lib/edition/banditsPicksFeature.ts` |
| Edition reliability | `THE_PRESSES_NEVER_STOP.md` |
| Audit scripts | `scripts/audit-*.mjs`, `scripts/nationwide-editorial-audit.ts` |
| npm scripts | `package.json` |
| Performance instrumentation | `lib/perf/startupTiming.ts`, `docs/perf/` |

**Not in repo (do not reference as existing):** `BEHAVIOR_SKILLS.md`, `EDITORIAL_STANDARDS.md`, `SOURCE_STANDARDS.md`, `EVENT_VERIFICATION.md`, `ACTIVITY_VERIFICATION.md` — these were drafted in a prior session but never committed.

**Superseded (do not treat as current product law):** `KINDRED_CONSTITUTION_v1.0.md` — describes a different product (physical ownership app).

---

## Known Documentation Conflicts

See [`docs/KINDRED_CONSTITUTION.md`](docs/KINDRED_CONSTITUTION.md) § Known Documentation Conflicts for the full list. Key items:

- **`KINDRED_CONSTITUTION_v1.0.md`** — unrelated legacy product; ignore for current Kindred.
- **`kindred-mission.mdc`** once listed AI-generated images as a last-resort fallback; **active image rules forbid AI-generated imagery** — follow `kindred-editorial-design.mdc`.
- **Bandit's Picks** — design rules describe the desk; **V1 hides it** via `BANDITS_PICKS_ENABLED = false`.
- **`docs/editorial/README.md`** mentions a "worldwide newspaper"; **V1 scope is United States only**.
