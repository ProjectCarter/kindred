# History Around Town — Architecture

**Permanent law for History Around Town.** Replaces Bandit's Notebook with a metro-scoped editorial library — the same philosophy as the Masterpiece Library.

Kindred's morning newspaper ends with one last calm invitation: places that help readers understand the story of the community they live in or are visiting. That work must be **finished before the reader arrives**.

---

## Guiding principles (priority order)

1. **Accuracy** — verified facts only; when in doubt, leave it out
2. **Fast startup** — no runtime AI, research, or article generation at app open
3. **Low operating cost** — prepare each place once, reuse until editorial update
4. **Simplicity** — one library, one freeze, one read path

---

## What changes

| Before (Bandit's Notebook) | After (History Around Town) |
|----------------------------|----------------------------|
| Discovery picks from daily catalog | **Permanent metro library** |
| Runtime article from discovery adapter | **Pre-written article** in library row |
| No See All page | **Full directory** — no artificial cap |
| Mixed recommendation tone | **Timeless editorial** — history, not tourism |

---

## Data model

### `kindred_history_places` — permanent metro library

Each row is one historic place with a complete editorial article, validated **before** it can appear in any edition.

| Field group | Columns |
|-------------|---------|
| Identity | `internal_id`, `metro_key`, `place_name`, `slug`, `category`, `category_label` |
| Homepage | `editorial_teaser`, `image_url` / `hosted_url`, `image_credit` |
| Full article | `story_body`, `editorial_modules`, `closing_note` |
| Magazine modules | `history_summary`, `why_it_matters`, `interesting_facts`, `architecture_note`, `best_time_to_visit`, `hours_text`, `admission_text`, `parking_text`, `accessibility_text`, `nearby_places` |
| Location | `lat`, `lon`, `address`, `city`, `state`, `official_website` |
| Provenance | `source_urls`, `source_provider`, `last_reviewed_at`, `verified_at` |
| Gates | `approval_status`, **`validation_status`**, `editorial_priority`, `featured` |

#### `validation_status` (edition eligibility)

| Status | Meaning | Visible to users? |
|--------|---------|-------------------|
| `approved` | Passes editorial + field gates | **Yes** |
| `needs_review` | Incomplete or pending review | **No** |
| `rejected` | Failed editorial or accuracy gates | **No** |

Gate logic: `supabase/functions/_shared/historyAroundTown/validation.ts`

### `editions.history_around_town` — frozen daily snapshot

Written once during `buildEdition`:

```json
{
  "metroKey": "gilbert-az",
  "subtitle": "Every town has a story waiting to be explored.",
  "carousel": [ /* ~20 diversified cards */ ],
  "places": [ /* every approved place in metro — no cap */ ]
}
```

Client reads this snapshot only — no generation.

---

## Edition build flow

```
buildEdition(location)
  → metroKeyFromLocation(location)
  → listApprovedHistoryPlaces(metroKey)
  → rowToSnapshot(each row)
  → diversifyCarousel(~20, max 2 per category in rotation)
  → editions.history_around_town = { carousel, places, metroKey, subtitle }
```

Server: `supabase/functions/_shared/historyAroundTown/library.ts`  
Client parse: `lib/edition/historyAroundTown/types.ts` → `surfaceIntelligence.ts`

---

## Client read path

| Surface | Source | Generation? |
|---------|--------|---------------|
| Homepage carousel | `historyAroundTown.carousel` | **No** |
| See All directory | `historyAroundTown.places` (stashed via list store) | **No** |
| Full article | `articleFromHistoryPlace(snapshot)` | **No** |

Article composer: `lib/edition/historyAroundTown/article.ts`  
UI: `components/HistoryAroundTownSection.tsx`, `app/history-around-town.tsx`

---

## Homepage placement

History Around Town is always the **final section** of the daily newspaper — after Local News, before `EditionClose`. Do not reorder other homepage sections.

---

## Background growth (future)

Like the Masterpiece Library, new places may be added via offline seed scripts or a future edge function. That work must **never** block app startup or edition read paths. Growth cron remains disabled until QA approves.

---

## Images — NO AI (permanent law)

Every image must be **authentic and verifiable**. Never AI-generated, stock filler, or wrong-location photos.

Required on every library row: `image_url`/`hosted_url`, `image_source_url`, `image_credit`, `image_license`, `image_photographer`, `image_era`, `image_date` (when known).

If no authentic image can be verified → `needs_review`. Accuracy beats filling the carousel.

---

## v1.1 — Premium editorial guide (2026)

Each approved library row now stores structured fields for carousel metadata, visitor information, timeline, looking-closer observations, nearby slug links, and designation badges. Edition build freezes the full `HistoryPlaceSnapshot` — client reads only.

**Article reader:** `components/HistoryPlaceReader.tsx` (Introduction · Visitor Information · The Story · Why It Matters · Looking Closer · Timeline · Did You Know? · Visiting Today · Nearby · Before You Go · Closing Note)

**Migration:** `0043_history_places_v11_enrichment.sql`

**Re-seed + repair:** After schema apply, run `seed-history-around-town-gilbert.mjs` and `repair-history-around-town-editions.mjs --force` to refresh frozen snapshots.

---

## Operations scripts

| Script | Purpose |
|--------|---------|
| `scripts/apply-history-around-town-schema.sql` | Apply migration 0040 |
| `scripts/seed-history-around-town-gilbert.mjs` | Seed verified Gilbert places |
| `scripts/audit-history-around-town-library.mjs` | Library health audit |
| `scripts/verify-history-around-town-images.mjs` | Image HTTP verification with retry |

Image verification statuses: `verified` · `verification_pending_rate_limit` · `verification_pending_transient` · `failed`. **429 never rejects editorial approval.**

---

## Editorial standard

- Not a tourism guide or attraction list
- Calm, timeless, educational prose
- Passes Accuracy, Swap Test, Lasting Thought Test
- Every conclusion belongs only to that place

See also: `kindred-editorial-constitution.mdc`, `kindred-memorable-writing.mdc`, `kindred-unique-conclusions.mdc`
