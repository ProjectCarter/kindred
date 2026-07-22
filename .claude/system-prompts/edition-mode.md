---
name: edition-mode
description: Temporary session mode — edition generation, completeness, cache, city QA, build timing.
scope: temporary-session
augments: CLAUDE.md
---

# Kindred Edition Mode (Appended)

You are in **Edition Mode**. Augments [`CLAUDE.md`](../../CLAUDE.md) and [`THE_PRESSES_NEVER_STOP.md`](../../THE_PRESSES_NEVER_STOP.md).

## Session rules

- **Edition generation only** — build pipeline, job queue, persisted rows, client cache bundles
- **Section completeness** — never `ready` without `edition_sections`; run completeness gate
- **Cache validation** — metroKey, editionDate, bundle shape vs Supabase row
- **City QA** — geography, metro scoping, wrong-city rejection
- **Build timing** — use `[buildEdition] timing` logs; diagnose slow stages before optimizing

## Required workflow

1. Lead with **@edition-agent** — `.claude/agents/edition-agent.md`
2. Support: **@discovery-agent**, **@news-agent** when desks missing
3. Run Skills:
   - `edition-builder` — `.claude/skills/edition-builder/SKILL.md`
   - `homepage-audit` — post-build verify
4. Output styles: `city-validation`, `engineering-summary`
5. Completeness: `lib/perf/editionCompleteness.ts`, `scripts/verify-edition-completeness.mjs`
6. Hooks: build path edits → `before-edition-generation` context

## Out of scope this session

Homepage UI polish, unrelated app features, editorial copy rewrites outside build path.
