# Masterpiece Library Architecture

**Permanent law for Today's Masterpiece.** Replaces runtime discovery, metadata parsing, and article generation at edition-build or app-open time.

Kindred's morning newspaper should feel like opening a beautifully curated edition where **everything difficult is already finished** before the reader arrives.

---

## Guiding principles (priority order)

1. **User experience** — fast, reliable, beautiful, accurate
2. **Low operating cost** — generate expensive content once, reuse forever; prefer free public-domain sources
3. **Fast startup** — heavy work happens in background ingestion, never while the user waits
4. **Simplicity** — one library, one freeze, one read path

---

## What changes

| Before (legacy) | After (library model) |
|-----------------|----------------------|
| Wikimedia search during edition build | **Never** — selection reads DB only |
| Metadata parsing at app open | **Never** — sanitized at ingest |
| Template / AI article synthesis at edition build | **Never** — full article stored at ingest |
| Weekly background growth (8 artworks) | **Daily** quiet growth (~2 approved artworks) |
| Loose “ready” gate (`isFrozenDetailComplete`) | Strict **approved + validated** gate |

---

## Data model

### `kindred_hero_artwork` — permanent curated library

Each row is one authentic public-domain artwork, fully prepared **before** it can appear in any edition.

| Field group | Columns |
|-------------|---------|
| Identity | `artwork_title`, `artist`, `year`, `source_institution` |
| Image | `hosted_url`, `storage_path`, `image_width`, `image_height`, `aspect_ratio` |
| Licensing | `license`, `license_url`, `public_domain_status`, `attribution_text`, `verification_source` |
| Homepage teaser | `about_artwork_body`, `about_word_count` |
| Full article | `long_story_body`, `editorial_sections`, `artist_biography`, `look_closer_items`, `did_you_know` |
| Museum | `museum_name`, `museum_location`, `official_museum_url`, `official_artwork_url`, `source_references` |
| Editorial gates | `approval_status`, `detail_editorial_status`, `curator_editorial_status`, **`validation_status`** |
| Rotation | **`last_shown_date`**, `last_used_at`, **`use_count`** (times shown) |

#### `validation_status` (edition eligibility)

| Status | Meaning | Visible to users? |
|--------|---------|-------------------|
| `approved` | Every field validated; passes Masterpiece Editorial Standard | **Yes** — eligible for daily selection |
| `needs_review` | Incomplete, pending editorial, or failed a non-fatal check | **No** |
| `rejected` | Failed licensing, authenticity, or editorial gates | **No** |

Only `validation_status = 'approved'` rows enter the daily selection pool.

### `kindred_hero_artwork_edition_selections` — global daily freeze

One row per `edition_date` (global, not per-user):

- `artwork_id` — library reference
- `presentation_snapshot` — complete frozen `MorningHeroExperience` (homepage + article)
- Written once when today's masterpiece is selected; edition build **reads** this snapshot

### `editions.morning_edition.morningHero` — per-user frozen copy

Embedded during `buildEdition` from the global selection snapshot. Client reads this — no generation.

---

## Approved sources only

Authentic public-domain artwork from verified institutions:

- Wikimedia Commons (with license verification)
- Metropolitan Museum of Art Open Access
- National Gallery of Art Open Access
- Rijksmuseum
- Art Institute of Chicago Open Access
- Other verified museum/gallery Open Access collections

**Never:** AI-generated, stock, fictional, unknown internet, or unverified images.

---

## Background ingestion pipeline

Runs via `grow-hero-artwork-library` (daily cron) and `scripts/seed-hero-artwork-library.mjs` (bulk seed). **Never during app open or edition build.**

```
Discover candidate (Wikimedia / museum API)
  → Verify licensing & public domain
  → Download / host authentic image (kindred-hero-artwork bucket)
  → Sanitize metadata (strip Wikidata QS:/P#### syntax)
  → Generate homepage teaser (Claude — once)
  → Generate complete editorial article (Claude — once)
  → Validate every field (Masterpiece Editorial Standard)
  → validation_status = approved | needs_review | rejected
  → Upsert kindred_hero_artwork
```

Failed validation → `needs_review` or `rejected`. Never shown until promoted to `approved`.

---

## Daily edition selection

When `buildEdition` runs for a user:

```
1. Read kindred_hero_artwork_edition_selections for edition_date
   → If presentation_snapshot exists: embed in morning_edition (DONE)

2. Else select from library (validation_status = approved only):
   → Score: never shown > least recently shown > artist/period diversity
   → copyMorningHeroFromRecord (pre-stored article only — no synthesis)
   → Freeze selection + presentation_snapshot
   → Update last_shown_date, use_count

3. Never: Wikimedia, Claude, downloads, metadata parsing, article generation
```

Recommended ops: run `scripts/freeze-daily-masterpiece.mjs` before overnight edition jobs so build always hits a pre-frozen snapshot.

---

## Rotation policy

Track `last_shown_date` and `use_count`. Favor:

- Never shown (`last_shown_date IS NULL`)
- Least recently shown
- Diverse artists, periods, and cultures (scoring in `select.ts`)

**Nothing is deleted** because it was shown. The library only grows.

---

## Initial library & growth targets

| Phase | Target |
|-------|--------|
| **Seed** | 30–60 fully approved masterpieces (`seed-hero-artwork-library.mjs`) |
| **Daily growth** | ~2 new approved artworks (`grow-hero-artwork-library`, cron 03:00 UTC) |
| **Long term** | Hundreds → thousands of authentic masterpieces |

Verify readiness: `node scripts/verify-hero-artwork.mjs`

---

## Client behavior (read-only)

```
editions.morning_edition.morningHero  (primary)
  → resolveMorningHero()
  → preloadMorningHeroImage() (non-blocking)
  → openMasterpiece() → masterpieceStore → MasterpieceReader

Recovery (morningHero missing): read presentation_snapshot from
kindred_hero_artwork_edition_selections — still no generation.
```

---

## Code map

| Concern | Module |
|---------|--------|
| Ingest / grow | `heroArtwork/backgroundDiscovery.ts`, `grow-hero-artwork-library` |
| Validation at ingest | `heroArtwork/libraryValidation.ts` |
| Selection (edition build) | `heroArtwork/librarySelection.ts`, `heroArtwork/production.ts` |
| Scoring / rotation | `heroArtwork/select.ts`, `heroArtwork/ensurePool.ts` |
| DB access | `heroArtwork/library.ts` |
| Editorial gates | `heroArtwork/detailEditorial.ts`, `heroArtwork/articleValidation.ts` |
| Bulk seed | `scripts/seed-hero-artwork-library.mjs` |
| Daily freeze (ops) | `scripts/freeze-daily-masterpiece.mjs` |

---

## Success criteria

- Startup: homepage retrieves frozen snapshot only (~0ms editorial work)
- Reliability: no runtime dependency on Wikimedia or Claude at open
- Editorial consistency: every shown artwork passed full ingest validation
- Cost: AI runs once per artwork, not once per user per day
- Maintainability: single library, single selection path, clear status gates
