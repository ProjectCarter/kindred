---
name: local-news-verification
description: Verifies Kindred Local News desk content, freshness, geographic eligibility, fallback order, and prose gates. Use when Local News is empty, wrong, stale, mislabeled, or when validating Story Editor output before publish.
---

# Local News Verification

## Law (read, do not duplicate)

- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §7 Local News Standard
- [`lib/edition/localNewsDesk.ts`](../../../lib/edition/localNewsDesk.ts) — desk priority
- [`lib/edition/localNewsGeographicEligibility.ts`](../../../lib/edition/localNewsGeographicEligibility.ts)
- [`lib/edition/kindredArticleProse.ts`](../../../lib/edition/kindredArticleProse.ts) — prose gate
- [`.cursor/rules/kindred-editorial-constitution.mdc`](../../../.cursor/rules/kindred-editorial-constitution.mdc)

## Purpose

Verify Local News meets **freshness, geography, fallback order, and prose standards** — and that the homepage desk **always mounts** separately from National News.

## When to use

- Local News shows placeholder when stories should exist
- Wrong desk badge (sports labeled as local news)
- Suspected fabrication, wire duplication, or AI filler
- After Story Editor or NewsAPI pipeline changes
- Before declaring an edition publish-ready

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| `edition_date` | Yes | Edition under test |
| `user_id` / `metro_key` | For live data | Gilbert default in scripts |
| `city`, `state` | For geo eligibility | Reader location |
| Lead story + top stories payload | From edition row | `lead_story`, `editorial_context` |

## Investigation steps

```
Progress:
- [ ] 1. Confirm Local News section mounts in EditionReader
- [ ] 2. Resolve homepage package (client logic)
- [ ] 3. Check desk priority selection (server/client)
- [ ] 4. Validate geographic eligibility
- [ ] 5. Run prose gate on published copy
- [ ] 6. Run unit tests
- [ ] 7. Optional — regenerate local news stage only
```

**Step 1:** `EditionReader.tsx` — Local News uses `NewsArticleSection` with label `"Local News"`; must render even when empty.

**Step 2:** Trace `resolveLocalNewsHomePackage()` in `lib/edition/localNewsHome.ts` → `homepageNewsTeasers.ts`.

**Step 3 — Fallback priority** (`localNewsDesk.ts`):

1. `local_news` — within 24h (`LOCAL_NEWS_DESK_MAX_HOURS`)
2. `sports` — pro teams in same state
3. `weather` — significant local weather
4. `community` — civic/government

Empty → `LOCAL_NEWS_EMPTY_PLACEHOLDER` (`No major local updates today.`)

**Step 4:** `assessLocalNewsGeographicEligibility()` — reject national wire mislabeled as local.

**Step 5:** Run `validateKindredArticleProse()` with `desk: "local_news"` on headline, dek, body.

**Step 6 — Tests:**

```bash
node --test lib/edition/localNewsDesk.test.ts
node --test lib/edition/localNewsHome.test.ts
node --test lib/edition/localNewsGeographicEligibility.test.ts
node --test lib/edition/localNewsArticle.test.ts
node --test lib/edition/localNewsStoryStructure.test.ts
```

**Step 7 — Regenerate (destructive; needs credentials):**

```bash
node scripts/regenerate-local-news-gilbert.mjs
```

Requires `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` — never log or commit.

## Verification checklist

- [ ] Local News desk **mounts** on homepage (not removed to fix another section)
- [ ] National News remains a **separate** desk below Local News
- [ ] Selected story within 24h freshness window
- [ ] Geographic eligibility passes for reader city/state
- [ ] Correct desk badge (📰 Local News, 🏈 Sports, 🌤 Weather, 🏛 Community)
- [ ] Headline specific — not generic or clickbait
- [ ] Opening paragraph leads with news — not headline repeat
- [ ] No banned wrap-ups (`In conclusion`, `Overall`, etc.)
- [ ] No fabricated quotes, stats, or timelines
- [ ] Image matches story when image present
- [ ] Empty state is honest placeholder — not hidden section

## Common failure patterns

| Symptom | Likely cause | Fix direction |
|---------|--------------|---------------|
| Always empty | No candidates pass geo + freshness | Check NewsAPI queries, `localNewsSourceQuality.ts` |
| National story in Local News | Role mislabel or geo gate bypass | `localNewsGeographicEligibility.ts`, top story roles |
| Sports from wrong state | Hometown team catalog mismatch | `hometownTeams/catalog.ts`, reader state |
| AI-sounding copy | Story Editor or prose gate bypass | `storyEditor/validators.ts`, `kindredArticleProse.ts` |
| Section vanished | Render regression | `EditionReader.tsx` — preservation rule violation |
| Stale wire recycled | Freshness gate not applied | `localNewsFreshness.ts`, `LOCAL_NEWS_FALLBACK_MAX_HOURS` |

## Output format

```markdown
# Local News Verification — [edition_date] — [city]

## Verdict
PASS | FAIL | EMPTY OK | FAIL — SECTION MISSING

## Selected content
| Field | Value |
|-------|-------|
| Content type | local_news | sports | weather | community |
| Headline | |
| Freshness (hours) | |
| Geo tier | |

## Fallback path
Requested local_news → selected [type] because: ...

## Prose gate
validateKindredArticleProse: PASS | FAIL
Reasons: ...

## Tests run
| Test file | Result |

## National News separation
Confirmed separate desk: YES | NO

## Issues
1. ...

## Manual verification still needed
- [ ] Read article on device
- [ ] Tap through to reader
```
