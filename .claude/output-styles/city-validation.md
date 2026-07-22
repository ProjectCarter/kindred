---
name: city-validation
description: Kindred per-market edition validation — all desks, geography, images, maps, overall pass/fail.
keep-coding-instructions: true
---

You are producing **Kindred City Validation Reports** for a specific market/metro edition. Cross-desk QA for "does this city edition work end-to-end?"

## Purpose

Validate **one market's daily edition** across discovery, news, history, and practical details — not just homepage presence.

## When to use

- New market launch or geography change
- After `discoveryGeography` or metroKey changes
- Gilbert/Phoenix regression baseline
- User asks "does San Diego edition look right?"

## Required sections

1. **Overall Pass/Fail** — `PASS | WARNING | FAIL`
2. **Market** — city, state, metro_key, edition_date
3. **Weather** — section present, sensible for location
4. **Events** — count, date verification, wrong-city check
5. **Activities** — count, variety (max 2/category), geography
6. **Food & Drinks** — count, local spread, dedupe vs Activities
7. **Story of City** — present, image, body quality note
8. **History Around Town** — carousel/cards, handoff
9. **Local News** — lead present, fresh, hero
10. **National News** — column present, not legacy fallback
11. **Images** — desk-appropriate; article heroes where expected
12. **Maps** — coordinates sanity (no guessed pins noted)

## Optional sections

- **Today in History** / **Community** / **Looking Ahead**
- **Cross-section dedupe** — same venue twice same day
- **Scripts** — `audit-global-editions.ts`, market-specific audits
- **Cache vs Supabase** — client-only issues

## Formatting

- Title: `# City Validation — [city] — [edition_date]`
- Each desk: `PASS | WARN | FAIL` + 1–2 evidence lines
- Flag wrong-city listings as **FAIL**
- Reference `.cursor/rules/kindred-local-business-first.mdc` only by name — no duplication
- Maps: note if coordinates unverified (constitution: do not publish unverified)

## Example output

```markdown
# City Validation — Gilbert, AZ — 2026-07-22

**Overall:** PASS · metro_key: `phoenix-az`

## Weather
PASS — forecast present for Gilbert area.

## Events
PASS — 8 cards, dates verified, no Phoenix-only venues in Gilbert edition.

## Activities
PASS — 6 items, 4 categories, max 2 coffee.

## Food & Drinks
PASS — 5 items, local independents featured.

## Story of City
PASS — Gilbert Story of, hero image loads.

## History Around Town
PASS — 3 cards, carousel renders.

## Local News
PASS — lead story < 24h, teaser present.

## National News
PASS — US daily column, image consistent.

## Images
PASS — text-first homepage; article heroes on open.

## Maps
PASS — sample pin opens intended venue (3/3 spot-checked).

## Overall Pass/Fail
**PASS**
```

## Expected length

**Long:** 60–100 lines for full market audit.

## Related Skills

- `homepage-audit`
- `edition-builder`
- `local-news-verification`, `national-news-verification`
- `release-readiness` — if gate for launch

## Related Subagents

- **Lead:** `qa-agent`
- **Support:** `discovery-agent`, `news-agent`, `edition-agent`
