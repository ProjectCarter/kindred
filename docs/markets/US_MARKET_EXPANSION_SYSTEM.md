# U.S. Market Expansion System

**Version 1 — United States only.**  
Philosophy: **Generate once. Read millions of times.**  
One market at a time. No batch builds. No mass API calls.

---

## Phase 1 — Ranked market catalog

### Source of truth (code)

| Module | Purpose |
|--------|---------|
| `lib/markets/data/usMarketDirectoryData.ts` | Static Top **100** U.S. metros + **15** tourist destinations |
| `lib/markets/usMarketDirectory.ts` | Builds + dedupes seeds |
| `lib/markets/marketRolloutScoring.ts` | Population tier, tourism, regional coverage, national significance |
| `lib/markets/ranking.ts` | Weighted `overall_rank` + `rollout_priority` |
| `lib/markets/marketCatalog.ts` | Production catalog export API |

### Ranking weights

1. **Population** — inverse population rank (dominant)
2. **Tourism** — `tourism_priority` + tourism rank (destinations)
3. **Regional coverage** — metro member city count
4. **National significance** — state capitals, top-25 metros, flagship destinations

### Each market record includes

| Field | Description |
|-------|-------------|
| `metro_key` | Canonical key (`seattle-wa`, `phoenix-az`) |
| `display_name` | Reader-facing label |
| `state` | Two-letter state code |
| `latitude` / `longitude` | Market anchor |
| `search_radius_miles` | Default 25 mi (fallback 50 mi) |
| `timezone` | IANA timezone |
| `population_tier` | `tier_1_national` … `tier_4_emerging` or `tourist_destination` |
| `tourism_priority` | 0–100 for destinations |
| `rollout_priority` | Same sequence as `overall_rank` |
| `status` | `planned` → `building` → `ready` → **`complete`** |

### Database

- Table: `kindred_us_markets` (migration **0044**)
- Rollout columns + `complete` status: migration **0049**
- Seed script (catalog only, **no build**):

```bash
SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-us-markets.mjs
```

### Export catalog (no DB)

```bash
node scripts/export-us-market-catalog.mjs --top 100
# → reports/us-market-catalog.json
```

---

## Phase 2 — Market tooling

### Developer UI

**Developer Tools → Market Management** (`app/dev-market-management.tsx`)

Per market:

- **Build** — one-time catalog bootstrap (Eventbrite + Foursquare sync)
- **Refresh** — incremental catalog sync
- **Validate** — read-only completeness check (**zero API spend**)
- **Retry** — rebuild after failure
- **Pause / Enable**

Also shows: status, build logs, completeness checklist, deficiencies.

Batch actions (Top 10 / 25 / 50) are **UI-visible but disabled** (`MARKET_BATCH_ACTIONS_ENABLED = false`).

### Edge function

`supabase/functions/build-market` — POST body:

```json
{ "slug": "seattle-wa-metro", "action": "build" | "refresh" | "retry" | "validate" | "pause" | "enable" }
```

### CLI

```bash
# Validate only (no sync)
node scripts/validate-us-market.mjs seattle-wa-metro
```

### Client API

`lib/markets/marketManagementClient.ts` — `listUsMarkets`, `invokeBuildUsMarket`, `invokeValidateUsMarket`, `fetchMarketBuildLogs`.

---

## Phase 3 — Market validation

All **11 desks** must pass before status = **`complete`**:

| Desk | Required | Check |
|------|----------|-------|
| Local Events | ✓ | Events catalog bootstrapped + ≥5 events |
| Activities | ✓ | Activities catalog + ≥12 active venues |
| Food & Drinks | ✓ | Food catalog + ≥8 active venues |
| Story of Your City | ✓ | Approved `kindred_city_articles` row |
| Bandit's Pick | ✓ | ≥12 activity candidates |
| Today in History | ✓ | Global desk (always available) |
| Artwork | ✓ | ≥1 ready piece in `kindred_hero_artwork` |
| Maps | ✓ | ≥85% activities with verified coordinates |
| Coordinates | ✓ | Valid market anchor |
| Editorial quality | ✓ | ≥60% activities with confidence/note |
| Family-safe | ✓ | Global pipeline enforcement |

Implementation: `supabase/functions/_shared/markets/marketCompleteness.ts`  
Spec mirror: `lib/markets/marketValidation.ts`

Status mapping:

- **`complete`** — all desks pass
- **`ready`** — catalog foundation only (events + activities + food + coordinates)
- **`needs_attention`** — deficiencies after build
- **`planned`** — not yet built

`is_supported = true` when foundation is ready (allows dev edition generation; full **complete** gate is stricter).

---

## Phase 4 — Evergreen content storage

Table: **`kindred_market_evergreen_assets`** (migration **0049**)

Asset types (stored once, reused):

- `city_history`, `landmark`, `museum`, `park`, `viewpoint`, `artwork`, `historic_district`, `attraction`

Types: `lib/markets/evergreenAssets.ts`

Links to existing libraries:

- Story of → `kindred_city_articles`
- History Around Town → `kindred_history_places`
- Hero artwork → `kindred_hero_artwork`
- Activities → `activities_catalog`

**Not yet wired:** ingest UI, approval workflow, edition reader binding. Schema is ready.

---

## Remaining work before market generation

1. **Apply migrations** `0044`, `0046`, `0049` to production (if not already)
2. **Seed catalog:** `node scripts/seed-us-markets.mjs`
3. **Deploy** `build-market` edge function
4. **Build one market** (e.g. Seattle) via Dev Tools — single API spend
5. **Validate** until checklist passes; seed Story of + History content manually for **complete**
6. **Gate edition generation** on `is_supported` / `complete` (optional next sprint)
7. **Evergreen ingest** tooling for landmarks, museums, parks (Phase 4 UI)

---

## Cost controls (locked)

- ❌ No batch build
- ❌ No mass API calls
- ❌ No nightly refresh (V1)
- ✅ One market · one build · validate before next
- ✅ Validate action = DB reads only
