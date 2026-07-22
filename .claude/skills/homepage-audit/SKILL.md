---
name: homepage-audit
description: Audits a Kindred homepage edition for required desks, section order, empty states, and placeholder copy. Use when verifying today's edition, debugging blank homepage sections, pre-release homepage checks, or after cache/sync changes.
---

# Homepage Audit

Procedural audit — expert checklist, not documentation. Read law from referenced sources only.

## Law (read, do not duplicate)

- [`CLAUDE.md`](../../../CLAUDE.md) — workflow, verification, preservation rules
- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §5 Edition Structure
- [`components/EditionReader.tsx`](../../../components/EditionReader.tsx) — render order (source of truth)
- [`.cursor/rules/kindred-editorial-design.mdc`](../../../.cursor/rules/kindred-editorial-design.mdc) — text-first listings

## Purpose

Confirm the homepage renders a **complete, honest newspaper** — required desks present, Local News above National News, no silent section removal, no placeholder/filler copy masquerading as content.

## When to use

- After edition build, cache sync, or geography changes
- Before release or merge touching `EditionReader`, `editionCache`, or discovery allocation
- When a user reports blank Events, Activities, Food & Drinks, or News desks
- Daily Gilbert/Phoenix Metro sanity check

## Inputs

| Input | Required | Default |
|-------|----------|---------|
| `edition_date` | No | Today or last known good date |
| `user_id` | No | Gilbert audit user in scripts |
| `metro_key` | No | `phoenix-az` |
| `city` | No | Gilbert |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | For live audit | `.env.local` |

## Investigation steps

```
Progress:
- [ ] 1. Confirm render order in EditionReader (code inspection)
- [ ] 2. Run automated Gilbert homepage audit script
- [ ] 3. Run desk-specific audits if a section fails
- [ ] 4. Inspect persisted edition + sections in Supabase
- [ ] 5. Compare cached vs uncached path if symptom is client-only
- [ ] 6. Produce report
```

**Step 1 — Expected homepage order** (from `EditionReader.tsx`):

1. MorningArrival (greeting, weather, Today's Masterpiece)
2. Local Events
3. Activities
4. Food & Drinks
5. Story of Your City (if present)
6. Today in History (if present)
7. Bandit's Picks — **V1 hidden** (`BANDITS_PICKS_ENABLED = false`)
8. Local News — **always mounts**
9. National News — **follows Local News**
10. Community / Looking Ahead (optional)
11. History Around Town
12. EditionClose

**Step 2 — Automated audit:**

```bash
node scripts/audit-gilbert-homepage-today.mjs [edition_date]
```

**Step 3 — Desk-specific follow-ups:**

```bash
node scripts/audit-gilbert-local-events-today.mjs [edition_date]
node scripts/audit-gilbert-activities-today.mjs [edition_date]
node scripts/audit-gilbert-food-drinks-today.mjs [edition_date]
node scripts/audit-gilbert-greeting-weather-today.mjs [edition_date]
```

**Step 4 — Persisted data:** Query `editions`, `edition_sections`, `discovery` payload for the date. Confirm `status = ready` only after sections exist (`THE_PRESSES_NEVER_STOP.md`).

**Step 5 — Client cache:** If server data is complete but UI is blank, trace `lib/edition/editionCache.ts`, warm-cache sync, and `resolveDiscoverySync.ts`.

## Verification checklist

- [ ] Local Events: cards or honest empty state (not missing section)
- [ ] Activities: curated items or empty; max variety per rules
- [ ] Food & Drinks: items within 15-mile radius scope
- [ ] Local News section **mounts** — placeholder OK (`No major local updates today.`)
- [ ] National News section **mounts** — separate from Local News
- [ ] Local News renders **above** National News
- [ ] No lorem ipsum, template filler, or AI-speak placeholders in headlines
- [ ] Homepage listings are text-first (emoji + headline + summary; no listing thumbnails)
- [ ] Bandit's Picks not rendered unless flag explicitly enabled
- [ ] History Around Town present when edition includes payload
- [ ] No debug UI bars or temporary boxes

## Common failure patterns

| Symptom | Likely cause | Where to look |
|---------|--------------|---------------|
| Discovery desks all blank, greeting OK | Warm-cache sync dropped discovery | `editionCache.ts`, recent bisect fixes |
| Local Events empty | Catalog sync, metro filter, verification gate | `audit-gilbert-local-events-today.mjs`, `discoveryGeography.ts` |
| Local News missing entirely | Section not mounting — **regression** | `EditionReader.tsx`, `NewsArticleSection` |
| Placeholder copy in headlines | Story Editor fallback or prose gate failure | `localNewsDesk.ts`, `kindredArticleProse.ts` |
| Food & Drinks shows chains only | Local Business First not applied | `sectionAllocator.ts`, `localBusinessFirst.ts` |
| Fast load but empty paper | Incomplete edition marked ready | `editionCompleteness.ts`, `buildEdition.ts` |

## Output format

```markdown
# Homepage Audit — [city] — [edition_date]

## Verdict
PASS | FAIL | PASS WITH WARNINGS

## Automated checks
| Script | Exit | Notes |
|--------|------|-------|

## Section matrix
| Desk | Expected | Found | Count | Notes |
|------|----------|-------|-------|-------|

## Order check
Local News above National News: YES | NO

## Issues (ranked)
1. [Critical] ...
2. [Warning] ...

## Verified
- [ ] Automated script
- [ ] Code inspection
- [ ] Device testing (if needed)

## Recommended next step
One concrete action only.
```
