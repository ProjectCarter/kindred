---
name: national-news-verification
description: Verifies Kindred National News desk content for national importance, freshness, image match, prose quality, family safety, and separation from Local News. Use when National News is wrong, stale, duplicated locally, or before publish after national daily pipeline changes.
---

# National News Verification

## Law (read, do not duplicate)

- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §6–§7 National vs Local model
- [`CLAUDE.md`](../../../CLAUDE.md) — editorial guardrails, verification rules
- [`lib/edition/nationalNewsTypes.ts`](../../../lib/edition/nationalNewsTypes.ts) — package schema + `resolveNationalNewsForRender`
- [`supabase/functions/_shared/nationalDaily/selectNationalNews.ts`](../../../supabase/functions/_shared/nationalDaily/selectNationalNews.ts) — candidate selection + `buildNationalNewsStoryPayload` (images)
- [`supabase/functions/_shared/nationalDaily/resolveNationalNews.ts`](../../../supabase/functions/_shared/nationalDaily/resolveNationalNews.ts) — daily package build, Story Editor enrich, `claim_us_national_news_write`
- [`lib/edition/nationalDailyValidation.ts`](../../../lib/edition/nationalDailyValidation.ts) — attach validation
- [`lib/edition/kindredArticleProse.ts`](../../../lib/edition/kindredArticleProse.ts) — prose gate (`desk: "national_news"`)
- [`.cursor/rules/kindred-editorial-constitution.mdc`](../../../.cursor/rules/kindred-editorial-constitution.mdc)
- [`.cursor/rules/kindred-newspaper-editorial-standards.mdc`](../../../.cursor/rules/kindred-newspaper-editorial-standards.mdc)

## Purpose

Verify National News is **genuinely national**, **fresh**, **family-safe**, **non-fabricated**, and **never duplicated from Local News** — with homepage teaser matching the article reader experience.

## When to use

- National story feels local-only or mis-scoped
- Same headline appears in Local and National desks
- Image does not match article subject
- Suspected wire filler, AI prose, or generic headline
- After `selectNationalNews`, `us_national_daily`, or hydration changes
- Before release when national desk was touched

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| `edition_date` | Yes | Shared national package date |
| `editions.national_news` column | For live check | City edition copy of shared package |
| `kindred_us_national_daily.national_news` | For live check | Canonical daily package (one per calendar date) |
| `us_national_daily_id` | Optional | Links city edition to national daily row |
| Local News story IDs/headlines | For dedupe | From same edition row |
| Second city edition (optional) | For parity | Gilbert + Seattle should share package |

## Investigation steps

```
Progress:
- [ ] 1. Load national package from edition column
- [ ] 2. Confirm national importance (selection metadata)
- [ ] 3. Check freshness per story publishedAt
- [ ] 4. Dedupe against Local News
- [ ] 5. Validate image ↔ story match
- [ ] 6. Run prose gate on summaries/headlines
- [ ] 7. Trace homepage → detail adapter consistency
- [ ] 8. Run unit tests
```

**Step 1 — Primary source (two-layer model):**

1. **Build:** `resolveUsNationalNews()` selects 3–5 stories, optional Story Editor enrich, writes to `kindred_us_national_daily` via RPC `claim_us_national_news_write`.
2. **Attach:** City editions copy package into `editions.national_news` + `us_national_daily_id`.
3. **Hydrate:** `resolveNationalNewsForRender({ columnOnly: true })` reads `editions.national_news` only — does **not** fall back to `top_stories` during cache/network desk sync (`homepageNewsHydration.ts`).

Homepage teasers may still use legacy non-local lead/top stories when the package is empty (`resolveNationalNewsArticleTeasers` in `homepageNewsTeasers.ts`).

**Step 2 — National importance** (`selectNationalNews.ts`):

- Pool must not be `local`
- Reject local-only relevance without national/global/breaking signals
- `NATIONAL_HINTS` or scoring reasons: `national_importance`, `global_scope`, `breaking_language`
- Tone deprioritization for non–public-safety sensational copy

**Step 3 — Freshness:** Compare `publishedAt` to edition date; stories should read current for the morning edition.

**Step 4 — Local dedupe:**

```bash
# Compare IDs and normalized headlines between:
# - resolveLocalNewsHomePackage / local top stories
# - nationalNews.stories
```

National must **never** use Local News fallback chain (`localNewsDesk.ts` is Local-only).

**Step 5 — Image:** Set at selection via `buildNationalNewsStoryPayload` from NewsAPI `imageUrl` — wire attribution + license note. Subject must plausibly match headline; no AI-generated imagery per design rules.

**Step 6 — Prose gate:**

```typescript
validateKindredArticleProse({
  headline, dek: summary.slice(0,120), body: summary,
  desk: "national_news",
})
```

**Step 7 — Detail consistency:**

- Homepage: `resolveNationalNewsArticleTeasers()` → `NewsArticleSection` (max 3 rows from package)
- Tap: `EditionReader.openNationalNewsArticle()` → `articleFromNationalNewsStory(story)` when package hit; legacy path uses `articleFromLeadStory` / `articleFromTopStory`
- Same `story.id`, headline, and summary source on reader path; image via `story.image.url` on national adapter

**Step 8 — Tests:**

```bash
node --test lib/edition/nationalNews.test.ts
node --test lib/edition/nationalDailyValidation.test.ts
npm run test:nationwide-audit
```

**Optional live row inspect:** `node scripts/simulate-homepage-news-hydration.mjs` (requires `SUPABASE_SERVICE_ROLE_KEY`).

## Verification checklist

- [ ] Stories sourced from `national_news` column (shared nationwide package)
- [ ] Genuinely national — not city council / neighborhood story
- [ ] Current for edition date — not stale wire recycle
- [ ] `sourceUrl` present for each story
- [ ] `verification.reasons` document selection (not empty legacy unless adapted)
- [ ] No duplicate ID or near-duplicate headline vs Local News on same edition
- [ ] National never uses sports/weather/community **local** fallback
- [ ] Family-safe — no deprioritized tone violations
- [ ] Headline specific — not generic ("Major news today")
- [ ] Summary readable teaser length — no template filler
- [ ] No banned AI wrap-ups if Story Editor enriched body
- [ ] Image matches story or cleanly omitted (text-only beats wrong image)
- [ ] Homepage teaser headline matches detail open for same `id`
- [ ] Empty state honest: `NATIONAL_NEWS_EMPTY_PLACEHOLDER` — section still mounts

## Common failure patterns

| Symptom | Likely cause | Where |
|---------|--------------|-------|
| Local story in National desk | Pool misclassification | `selectNationalNews.ts`, `score.ts` |
| Duplicate Local + National headline | Slate overlap / role mislabel | `topStories`, package build |
| National empty, local full | `national_news` column null; hydration drop | `nationalNewsHydration.ts`, warm cache |
| Different cities, different national IDs | Package claim race (should be one/day) | `simulateNationalNewsClaim` |
| Homepage ≠ reader content | Wrong adapter or legacy fallback path | `homepageNewsTeasers.ts`, `EditionReader` open handlers |
| Missing images on all stories | Wire source without image — OK if no false fallback | `NationalNewsImage` |
| Thin generic summary | Selection conciseSummary truncation only | `selectNationalNews.ts` |

## Output format

```markdown
# National News Verification — [edition_date]

## Verdict
PASS | FAIL | EMPTY OK | FAIL — DESK MISSING

## Package
| Field | Value |
|-------|-------|
| packageId | |
| story count | |
| us_national_daily_id | |

## Stories (ranked)
| rank | id | headline | publishedAt | source | national OK | image OK |

## Local dedupe
| Check | Result |
|-------|--------|
| ID overlap with Local | NONE | list |
| Headline similarity | NONE | list |

## Prose gate (sample / worst story)
validateKindredArticleProse: PASS | FAIL

## Homepage ↔ detail
| story id | homepage headline | reader headline | match |

## Tests run
| Command | Result |

## Issues
1. ...

## Manual verification still needed
- [ ] Tap each national row on device
- [ ] Confirm image in article reader
```
