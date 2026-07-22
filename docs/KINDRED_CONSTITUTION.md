# The Kindred Constitution

**Status:** Active — product and editorial law for Version 1  
**Effective:** July 2026  
**Audience:** Engineers, editors, and AI assistants working on Kindred

This document consolidates the current committed truth for Kindred. Detailed
implementation lives in `.cursor/rules/`, `docs/editorial/`, and engineering
modules — this constitution organizes them without copying every rule verbatim.

**Concise operating guide for Claude Code:** [`../CLAUDE.md`](../CLAUDE.md)

---

## 1. Mission

Kindred is a **local-first morning newspaper and discovery product** designed to
help people understand, enjoy, and connect with the place where they live or visit.

Kindred exists to answer one question:

> **"What can I do that's fun today?"**

If a reader opens Kindred, discovers a local event, finds a hike, or visits a
neighborhood restaurant — and never reads a news article — **Kindred has still
succeeded.** That is **the Kindred Effect**.

- **Discovery is the product.** Events, Activities, and Food & Drinks are the heartbeat.
- **The newspaper is the presentation.** Calm, curated, family-safe, trustworthy.
- **Kindred vs Google Maps:** Google Maps answers *"What's nearby?"* Kindred answers
  *"What's worth experiencing?"*

Kindred is **not trying to replace** Google Maps, Ticketmaster, Eventbrite, Yelp,
local newspapers, tourism bureaus, or official venue websites. Kindred **gathers
verified information from trusted sources** and presents it in one daily local edition.

---

## 2. Version 1 Scope

- **United States only** — no international product behavior in V1.
- **Polish and reliability over expansion** — complete, trustworthy editions before new markets.
- **Scale editions based on demand** — market catalog in `lib/markets/`, staged builds.
- **Avoid expensive services without approval** — cost-aware API use; prefer cached/prebuilt content.
- **National daily content** may be shared nationwide (see §6).
- **Metro discovery, city identity** — e.g. Gilbert masthead with Phoenix Metro event/discovery scope (`lib/edition/discoveryGeography.ts`).

Future international or multilingual behavior is documented in
`docs/editorial/GLOBAL_LANGUAGE_ARCHITECTURE.md` but is **not V1 scope**.

---

## 3. Trust Standard

Kindred earns trust through:

| Pillar | Requirement |
|--------|-------------|
| **Accuracy** | Verified facts only; never guess, assume, or fabricate |
| **Source transparency** | Official and tiered sources; provenance tracked |
| **Freshness** | No expired events; Local News within 24h window |
| **Relevant imagery** | Subject-matched, authorized — never misleading |
| **Honest fallbacks** | Empty placeholders beat fake content |
| **Family-safe filtering** | Adult venues excluded before ranking |
| **No fabrication** | No invented quotes, timelines, stats, or story details |

**When in doubt: leave it out.**

Engineering gates: `editorial/confidence.ts`, `familyFriendlyFilter.ts`,
`validateKindredArticleProse()`, Story Editor validators.

Detailed publish law: `.cursor/rules/kindred-editorial-constitution.mdc`,
`docs/editorial/EDITORIAL_CONSTITUTION.md`

---

## 4. Editorial Philosophy

Kindred is **not trying to publish the most content**. Kindred publishes **the most trusted content**.

- **Lead with useful information** — first paragraph answers what happened and why it matters.
- **No filler, no generic padding** — every paragraph earns its place.
- **Write for ordinary readers** — calm newspaper prose, not AI or marketing voice.
- **Local relevance over directory volume** — curated experiences, not scraped listings.
- **Discovery feels edited** — magazine spread, not a category dump (max 2 per category per section).
- **Memorable but restrained prose** — lasting thought without drama (`kindred-memorable-writing.mdc`).
- **Unique conclusions** — no reusable endings; Swap Test (`kindred-unique-conclusions.mdc`).
- **Banned wrap-ups** — never "In conclusion…", "Overall…", "This article discussed…".

Universal craft standard: `.cursor/rules/kindred-newspaper-editorial-standards.mdc`  
Digest: `lib/edition/kindredEditorialStandards.ts`

---

## 5. Edition Structure

The homepage render order is defined in `components/EditionReader.tsx`. Required
desks must **not silently disappear** — empty states use honest placeholders.

### Current homepage order (committed code)

| # | Section | Notes |
|---|---------|-------|
| 1 | **Greeting, Weather, Today's Masterpiece** | `MorningArrival` — hero + masthead |
| 2 | **Local Events** | Up to 8 text-first listing cards |
| 3 | **Activities** | Experience-first discovery |
| 4 | **Food & Drinks** | Rendered via `RecommendationsSection`; 15-mile radius |
| 5 | **The Story of Your City** | When edition includes story_of section |
| 6 | **Today in History** | When edition includes today_in_history section |
| 7 | **Bandit's Picks** | **V1: hidden** — `BANDITS_PICKS_ENABLED = false`; backend preserved |
| 8 | **Local News** | Always mounts; placeholder if empty |
| 9 | **National News** | Separate desk; follows Local News immediately |
| 10 | **Community / Looking Ahead** | Optional; when edition includes looking_ahead |
| 11 | **History Around Town** | Final editorial desk before edition close |

**Local News always appears above National News.** Both sections mount even when empty.

Homepage listings (Events, Activities, Food & Drinks, news teasers): **text-first**
— emoji, headline, summary, badges. Photography belongs on **article pages**.

Design law: `.cursor/rules/kindred-editorial-design.mdc`

---

## 6. National and Local Content Model

### Shared nationwide (same content every U.S. edition that day)

- **Today's Masterpiece** — curated library; daily freeze
- **Today in History** — national daily selection
- **National News** — wire/syndicated national desk

### City- or reader-specific

- **Weather** — reader location
- **Local News** — geographic eligibility + desk priority
- **Story of Your City** — city edition content
- **Local Events** — metro-scoped catalog (e.g. Phoenix Metro, 50-mile isolation)
- **Activities** — 25-mile reader-centered radius
- **Food & Drinks** — 15-mile reader-centered radius
- **History Around Town** — metro library, 25-mile radius

**Metropolitan discovery, city identity:** The user's home city (e.g. Gilbert) may
appear on the masthead while discovery pools draw from a broader metro where configured.
See `lib/edition/discoveryGeography.ts`.

---

## 7. Local News Standard

Local News is a **required homepage desk**. It must never be removed to fix another section.

### Content requirements

- Meaningful article depth — not wire snippets alone when Story Editor succeeds
- Current verified reporting — freshness enforced
- Accurate image–story association
- No fabrication — Story Editor + prose gates

### Desk priority (fallback order)

When fresh local news is unavailable, `localNewsDesk.ts` selects in order:

1. **Local news** (24h window)
2. **Professional sports** — teams in the same state as the reader
3. **Relevant local weather** — advisories, warnings, significant conditions
4. **Community / local government** — council, closures, civic updates

If nothing qualifies: **"No major local updates today."** — section still mounts.

**National News remains a separate desk** — never merged into Local News.

Implementation: `lib/edition/localNewsDesk.ts`, `localNewsHome.ts`, `homepageNewsTeasers.ts`

---

## 8. Discovery Standard

Applies to **Local Events, Activities, Food & Drinks, and History Around Town**.

| Requirement | Detail |
|-------------|--------|
| Curated, not a directory | Experience-first ranking; Kindred Test before publish |
| No expired events | Horizon filters; verification at build and publish |
| Useful distance windows | Events: metro; Activities/HAT: 25 mi; Food: 15 mi |
| Family-safe | `familyFriendlyFilter.ts` — exclude before ranking |
| Scam/spam filtering | MLM, predatory seminars, hate/extremist content excluded |
| Category accuracy | Verified category before emoji assignment |
| Local Business First | Independents preferred when quality comparable |
| Accurate maps, addresses, dates, links | No guessed coordinates |

Variety: **maximum two picks per category per section** (`sectionAllocator.ts`).

Philosophy: `.cursor/rules/kindred-recommendations.mdc`, `kindred-local-business-first.mdc`,
`kindred-editorial-discovery.mdc`

---

## 9. Image Standard

- **No AI-generated app imagery** — permanent law across active Cursor rules and prose gates.
- **Authorized sources only** — official, licensed, public domain, Creative Commons (with attribution), government, museum, business, or organizer supplied.
- **Images must match the subject** — venue, event, artwork, or place depicted.
- **Same story retains image identity** across homepage teaser and article reader.
- **Misleading generic fallbacks are unacceptable.**
- **Clean text-only presentation beats a false image.**

Homepage **listing desks** do not show thumbnail photos (emoji is the identifier).
Article pages are where photography belongs.

Desk-specific rules: `kindred-history-images.mdc`, `kindred-masterpiece-library.mdc`,
`kindred-bandits-pick.mdc`, `kindred-editorial-design.mdc`

---

## 10. Design Standard

- **Cream paper background:** `#FDFCF9` (`lib/edition/newspaperTheme.ts`)
- **Consistent spacing and typography** — `newspaperTheme`, locked homepage architecture
- **No debug bars or temporary UI boxes** in production surfaces
- **Preserve scroll position** when returning from article details
- **Cold launch begins at the top** of the edition
- **Accessible to older and non-technical readers** — calm hierarchy, readable type

**Locked sections** (do not redesign without explicit request): homepage architecture,
hero, greeting, Local Events, Activities, Food & Drinks, news desks, article reader foundation.

Detail: `.cursor/rules/kindred-editorial-design.mdc`

---

## 11. Performance Standard

- **Prebuilt and cached editions** where appropriate — see `THE_PRESSES_NEVER_STOP.md`
- **Cold open target: ≤ 5 seconds** — budget enforced in `lib/perf/startupTiming.ts`
- **No repeated AI generation on normal app open** — edition should load from cache/build
- **Never hide missing content to improve perceived speed** — fast but incomplete is failure
- **Measure and fix root causes** — use perf instrumentation and audit scripts

Discovery article composition is deferred until reader opens a card where configured —
avoid heavy client work on homepage paint path.

---

## 12. Safety and Security

### Family-safe content

Age restriction alone never excludes legitimate entertainment, food, culture, or hospitality.
**Primary purpose** determines inclusion — adult or sexually themed venues are removed
before ranking globally.

Gate: `localEvents/familyFriendlyFilter.ts`, `discovery/score.ts`

### Security

- Family-safe editorial filtering (see above)
- Validate external API data before trust
- **Never commit credentials** — `.env.local` is gitignored
- **Never log secrets** — service-role keys, cron secrets, API tokens
- Surface security issues clearly — do not normalize credential exposure in scripts

---

## 13. Change Discipline

- **Smallest safe change** — fix root cause, not symptoms
- **No unrelated refactors** — match existing conventions
- **Preserve working behavior** — especially homepage sections and cache sync
- **Verify across multiple cities** when location-sensitive (Gilbert + metro scope)
- **Compilation alone is not proof** — run tests and audits
- **Regressions become prevention rules** — update tests, Cursor rules, or gates when fixing repeated mistakes

Workflow detail: [`../CLAUDE.md`](../CLAUDE.md) § Development Workflow

---

## 14. Decision Hierarchy

When instructions conflict:

1. **Current explicit user direction**
2. **This constitution** (`docs/KINDRED_CONSTITUTION.md`)
3. **Applicable Cursor rules** (`.cursor/rules/*.mdc`)
4. **Desk-specific editorial docs** (`docs/editorial/`)
5. **Committed code and passing tests**
6. **Stale documentation** — flag, do not silently follow

Contradictions must be **reported**, not silently resolved.

---

## 15. Supporting Documents

### Active and in repository

| Document | Role |
|----------|------|
| [`../CLAUDE.md`](../CLAUDE.md) | Claude Code entry point and workflow |
| [`.claude/README.md`](../.claude/README.md) | Claude Code infrastructure index (skills, subagents, hooks) |
| `.cursor/rules/*.mdc` | 24 Cursor rules — detailed permanent law |
| `docs/editorial/` | Desk-specific editorial constitutions |
| [`../THE_PRESSES_NEVER_STOP.md`](../THE_PRESSES_NEVER_STOP.md) | Edition prebuild, cron, cache reliability |
| `lib/edition/kindredEditorialStandards.ts` | Standards digest for prompts and gates |
| `lib/edition/kindredArticleProse.ts` | Unified prose publication validator |
| `lib/edition/localBusinessFirst.ts` | Local Business First digest |
| `supabase/functions/_shared/storyEditor/` | Story Editor prompts and validators |
| `scripts/audit-*.mjs`, `scripts/nationwide-editorial-audit.ts` | Edition and editorial audits |

### Not in repository (do not claim they exist)

These were drafted in a July 21 session but **never committed**:

- `BEHAVIOR_SKILLS.md`
- `EDITORIAL_STANDARDS.md` (root-level handbook — distinct from `docs/editorial/`)
- `SOURCE_STANDARDS.md`
- `EVENT_VERIFICATION.md`
- `ACTIVITY_VERIFICATION.md`

---

## Known Documentation Conflicts

These contradictions exist across the repo today. **Do not delete or merge sources
in this task** — prefer committed code and active Cursor rules when working.

### 1. Legacy constitution — different product

**`KINDRED_CONSTITUTION_v1.0.md`** (repo root) describes a **physical ownership
app** ("calm intelligence layer for physical ownership"). It is **not** the current
Kindred newspaper/discovery product. **`ROADMAP.md`** still references it — treat both as stale.

**Resolution:** This file (`docs/KINDRED_CONSTITUTION.md`) and `.cursor/rules/` are
current product law.

### 2. AI-generated images

**`kindred-mission.mdc`** lists AI-generated recommendation images as a third-priority
fallback. **Active image rules** (`kindred-editorial-design.mdc`, history/masterpiece/story
rules, `kindredArticleProse.ts`) **forbid AI-generated imagery**.

**Resolution:** Follow the stricter no-AI-image standard.

### 3. Bandit's Picks visibility

**`kindred-editorial-design.mdc`** and **`kindred-bandits-pick.mdc`** describe Bandit's
Pick as a homepage desk. **V1 product decision:** `BANDITS_PICKS_ENABLED = false` in
`lib/edition/banditsPicksFeature.ts` — desk hidden; backend and types preserved.

**Resolution:** Do not render Bandit's Picks on homepage until flag is explicitly re-enabled.

### 4. Homepage section order vs older templates

Some planning templates place Bandit's Picks before Today in History. **Committed render
order** (`EditionReader.tsx`): Today in History → Bandit's Picks (when enabled) → Local News.

**Resolution:** Follow `EditionReader.tsx`.

### 5. "Recommendations" vs "Food & Drinks"

Internal code and rules sometimes say **Recommendations**; the homepage label is
**Food & Drinks** (`RecommendationsSection` component). Same desk.

### 6. "Worldwide" vs United States-only

**`docs/editorial/README.md`** describes a "worldwide newspaper." **V1 scope is
United States only.** Global Language Architecture exists for future use.

**Resolution:** U.S.-only for V1; flag international expansion as future scope.

### 7. Bandit's Notebook vs History Around Town

**`kindred-editorial-design.mdc`** still references Bandit's Notebook as a locked section.
Product now ships **History Around Town** as the permanent metro history library.

**Resolution:** History Around Town is the active feature; Notebook references are legacy naming.
