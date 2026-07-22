---
name: news-pipeline-audit
description: Audits the full Kindred Local + National News pipeline before release — desk presence, order, deduplication, freshness, hydration, and homepage-to-reader consistency. Use for pre-release news checks, after cache/sync changes, or when either news desk regresses.
---

# News Pipeline Audit

Orchestrates **Local News + National News** end-to-end. Use with `/local-news-verification` and `/national-news-verification` for desk-deep dives.

## Law (read, do not duplicate)

- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §5–§7
- [`CLAUDE.md`](../../../CLAUDE.md)
- [`components/EditionReader.tsx`](../../../components/EditionReader.tsx) — render order
- [`lib/edition/homepageNewsTeasers.ts`](../../../lib/edition/homepageNewsTeasers.ts)
- [`lib/edition/localNewsDesk.ts`](../../../lib/edition/localNewsDesk.ts) — local fallback only
- [`lib/edition/nationalNewsHydration.ts`](../../../lib/edition/nationalNewsHydration.ts)
- Related skills: `/local-news-verification`, `/national-news-verification`, `/homepage-audit`

## Purpose

Single **pre-release news system audit** — both desks present, correctly ordered, distinct content, consistent cache/regenerate behavior, homepage matching detail pages.

## When to use

- Before shipping news-related changes
- After warm-cache or `homepageNewsHydration` edits
- When user reports wrong order, duplicate stories, or missing news desk
- Part of `/release-readiness` for news-heavy branches

## Inputs

| Input | Required | Default |
|-------|----------|---------|
| `edition_date` | No | Today / last good |
| `user_id`, `metro_key` | For live | Gilbert / phoenix-az |
| `SUPABASE_SERVICE_ROLE_KEY` | For live scripts | `.env.local` |
| Pre-regeneration snapshot | Optional | Compare cached vs fresh build |

## Investigation steps

```
Progress:
- [ ] 1. Static order check (EditionReader)
- [ ] 2. Run homepage audit script (includes both desks)
- [ ] 3. Run news hydration simulation
- [ ] 4. Local desk verification
- [ ] 5. National desk verification
- [ ] 6. Cross-desk dedupe matrix
- [ ] 7. Fallback boundary check
- [ ] 8. Unit test suite
- [ ] 9. Produce structured report
```

**Step 1 — Render order (code):**

Local News `FolioReveal` → National News `FolioReveal` (Local **above** National). Both use `NewsArticleSection`. Comment in `EditionReader.tsx`: *"Local News — always mounts; National News follows immediately after."*

**Step 2 — Homepage audit:**

```bash
node scripts/audit-gilbert-homepage-today.mjs [edition_date]
```

Inspect `local_news` and `national_news` section audits in output.

**Step 3 — Hydration paths:**

```bash
node scripts/simulate-homepage-news-hydration.mjs
```

Confirms cold/warm/refresh merge behavior; `mergeNationalNewsHydration` must not null-overwrite valid package.

**Step 4 — Local verification:** Follow `/local-news-verification` checklist.

**Step 5 — National verification:** Follow `/national-news-verification` checklist.

**Step 6 — Cross-desk matrix:** For each national story, confirm no matching local `id` or normalized headline. For each local story, confirm not in `national_news.stories`.

**Step 7 — Fallback boundaries:**

| Desk | Allowed fallbacks | Forbidden |
|------|-------------------|-----------|
| Local | local_news → sports → weather → community | Using national package as local |
| National | `national_news` package → legacy non-local lead/top stories adapter | localNewsDesk chain |

**Step 8 — Tests:**

```bash
node --test lib/edition/localNewsDesk.test.ts
node --test lib/edition/localNewsHome.test.ts
node --test lib/edition/homepageNewsHydration.test.ts
node --test lib/edition/nationalNews.test.ts
node --test lib/edition/homepageNewsTeasers.test.ts 2>/dev/null || node --test lib/edition/topStories.test.ts
npm run test:nationwide-audit
```

**Step 9 — Optional regenerate comparison:**

```bash
# Snapshot before
node scripts/audit-gilbert-homepage-today.mjs [date]
# After local-only regen (destructive):
# node scripts/regenerate-local-news-gilbert.mjs
# Re-run audit — National should be unchanged; Local may change
```

## Verification checklist

### Presence & order
- [ ] Local News section exists on homepage
- [ ] National News section exists on homepage
- [ ] Local renders **above** National
- [ ] Both mount when empty (placeholders OK)

### Content integrity
- [ ] Local and National stories are **different** (IDs + headlines)
- [ ] Images match respective stories (or omitted honestly)
- [ ] Local freshness ≤ 24h for selected desk type
- [ ] National stories nationally scoped
- [ ] No fabricated fields in persisted edition row

### Fallback behavior
- [ ] Local fallback chain works when no fresh local_news
- [ ] National **never** pulls from local fallback chain
- [ ] National uses `editions.national_news` column first

### Homepage ↔ detail
- [ ] Same story `id` opens same headline in reader
- [ ] Teaser text derived from same summary source (`formatNewsArticleTeaser`)
- [ ] National tap uses `articleFromNationalNewsStory`
- [ ] Local tap uses `openLocalNewsArticle` path

### Cache & regeneration
- [ ] Cached edition shows same news desks as Supabase row
- [ ] Warm hydration does not wipe `nationalNews` (`mergeNationalNewsHydration`)
- [ ] Local-only regen does not corrupt national package
- [ ] `withSyncedNewsDesksInCache` keeps desks paired in cache bundle

### Empty states
- [ ] Local: `No major local updates today.`
- [ ] National: `No major national headlines today.`
- [ ] Sections visible — not collapsed to zero height

## Common failure patterns

| Failure | Signal | First check |
|---------|--------|-------------|
| National below Local | Order regression | `EditionReader.tsx` FolioReveal sequence |
| Same story both desks | Dedupe miss | IDs + headline normalize compare |
| National empty, DB has package | Hydration null overwrite | `simulate-homepage-news-hydration.mjs` |
| Local uses national lead | Role mislabel on `lead_story` | audit warning: "national lead" |
| Reader ≠ homepage | Adapter mismatch | `articleFromNationalNewsStory` vs teaser |
| Cache stale news | Sync not updating desks | `homepageNewsHydration.ts`, `home.tsx` |
| Local fallback in National | Wrong resolver path | `resolveNationalNewsArticleTeasers` |

## Output format

```markdown
# News Pipeline Audit — [edition_date] — [city/metro]

## Release recommendation
SHIP NEWS | DO NOT SHIP | SHIP WITH CAVEATS

## Findings (pass)
- ...

## Failures (blockers)
| # | Desk | Issue | Evidence |
|---|------|-------|----------|

## Warnings (non-blockers)
| # | Desk | Issue | Evidence |
|---|------|-------|----------|

## Desk summary
| Desk | Mounts | Order OK | Stories | Empty OK | Dedupe OK |
|------|--------|----------|---------|----------|-----------|
| Local News | | | | | |
| National News | | | | | |

## Homepage ↔ detail spot check
| id | desk | homepage headline | reader headline | match |

## Fallback audit
| Desk | Selected type | Fallback used? | Correct? |

## Scripts & tests
| Command | Exit | Notes |
|---------|------|-------|

## Cached vs persisted
| Source | Local count | National count | packageId match |
|--------|-------------|----------------|-----------------|

## Manual verification still required
- [ ] Cold launch — both desks visible
- [ ] Warm launch — no news desk flash/disappear
- [ ] Tap each visible story — reader opens correctly
- [ ] Back navigation — scroll position preserved

## Recommended next step
One action only.
```

## Escalation

| If this fails… | Run skill… |
|----------------|------------|
| Local desk only | `/local-news-verification` |
| National desk only | `/national-news-verification` |
| Full homepage context | `/homepage-audit` |
| Post-fix regression | `/regression-guard` |
