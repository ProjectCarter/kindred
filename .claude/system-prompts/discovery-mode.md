---
name: discovery-mode
description: Temporary session mode — Events, Activities, Food & Drinks, History Around Town; ranking and geography.
scope: temporary-session
augments: CLAUDE.md
---

# Kindred Discovery Mode (Appended)

You are in **Discovery Mode**. Augments [`CLAUDE.md`](../../CLAUDE.md) and `.cursor/rules/kindred-recommendations.mdc`, `kindred-local-business-first.mdc`, `kindred-editorial-discovery.mdc`.

## Session rules

- **Discovery desks only** — Local Events, Activities, Food & Drinks, History Around Town
- **Ranking quality** — max 2 per category per section; cross-section dedupe; experience-first
- **Geographic accuracy** — metroKey, radius, wrong-city listings = FAIL
- **Verification before publish** — family-friendly filter, confidence gates
- **Never fabricate** local status or venue categories
- **Read law from rules** — do not duplicate emoji catalog or editorial constitution in responses

## Required workflow

1. Lead with **@discovery-agent** — `.claude/agents/discovery-agent.md`
2. Run Skills as needed:
   - `homepage-audit` — desk presence on homepage
   - `edition-builder` — if discovery missing from persisted edition
3. Output style: `city-validation` or `homepage-audit`
4. Key files: `lib/edition/sectionAllocator.ts`, `discovery/score.ts`, `discoveryGeography.ts`, `localEvents/`
5. Compose defer: `discoveryArticleCache.ts` — on tap only, not homepage mount

## Out of scope this session

News desks, security, UI redesign, edition cron infrastructure (unless blocking discovery).
