---
name: edition-builder
description: Builds, regenerates, or validates a Kindred daily edition end-to-end via Supabase and edge functions. Use when creating today's edition, recovering a failed build, verifying edition completeness, or debugging missing sections in persisted data.
---

# Edition Builder

## Law (read, do not duplicate)

- [`THE_PRESSES_NEVER_STOP.md`](../../../THE_PRESSES_NEVER_STOP.md) — prebuild, cron, status lifecycle
- [`docs/KINDRED_CONSTITUTION.md`](../../../docs/KINDRED_CONSTITUTION.md) §5–§6 Edition structure
- [`supabase/functions/_shared/buildEdition.ts`](../../../supabase/functions/_shared/buildEdition.ts)
- [`lib/edition/discoveryGeography.ts`](../../../lib/edition/discoveryGeography.ts)
- [`CLAUDE.md`](../../../CLAUDE.md) — no repeated AI on normal app open

## Purpose

Guide **safe edition generation and validation** — from queued job through `ready` status with complete `edition_sections` and discovery payload.

## When to use

- No edition for today's date
- Edition stuck in `processing`
- Partial edition (missing sections after `ready`)
- After pipeline, migration, or geography changes
- Validating staged build completion

## Inputs

| Input | Required | Notes |
|-------|----------|-------|
| `user_id` | Yes | Target reader profile |
| `edition_date` | Yes | Local date for user timezone |
| `metro_key` | Yes | e.g. `phoenix-az` |
| Location `{ city, state, lat, lon }` | Yes | Reader place |
| `SUPABASE_SERVICE_ROLE_KEY` | For scripts | From `.env.local` only |
| `EDITION_DATE` env | Optional | Override date in scripts |

## Investigation steps

```
Progress:
- [ ] 1. Check existing edition row + status
- [ ] 2. Check generation_jobs queue
- [ ] 3. Verify edition_sections written
- [ ] 4. Run completeness gate
- [ ] 5. Build or regenerate if needed
- [ ] 6. Re-verify homepage audit
```

**Step 1 — Query persisted edition:**

```sql
-- editions: id, edition_date, status, metro_key, discovery, bandit, lead_story
-- edition_sections: section_type, position, headline, body
```

Status lifecycle: `processing` → `ready` only after sections confirmed (`THE_PRESSES_NEVER_STOP.md`).

**Step 2 — Job queue:** `generation_jobs` for user + local date; check stale `processing` (reap via `process-edition-jobs`).

**Step 4 — Completeness:**

```bash
node scripts/verify-edition-completeness.mjs [edition_date] [user_id]
node scripts/verify-edition.mjs
```

**Step 5 — Full regenerate (needs live Supabase + edge):**

```bash
node scripts/generate-today-edition-live.mjs
node scripts/regenerate-edition.mjs
npx tsx scripts/run-staged-edition-build.ts
node scripts/complete-edition.mjs
```

**Step 6 — After build:**

```bash
node scripts/audit-gilbert-homepage-today.mjs [edition_date]
```

Also: `npm run test:generation` for build-stage unit tests.

## Verification checklist

- [ ] `editions.status = ready`
- [ ] `edition_sections` contains expected types (greeting, weather, local_events, etc.)
- [ ] Discovery payload has surfaces for activities, recommendations, food
- [ ] National daily linked when applicable (`us_national_daily_id`)
- [ ] Local News lead or fallback resolved
- [ ] No `ready` edition with zero sections (crash mid-build regression)
- [ ] Bandit's Pick optional in V1 (`banditsPicksFeature.ts` — completeness treats pick as optional)
- [ ] Metro identity matches geography config
- [ ] Edition date matches user timezone, not UTC-only

## Common failure patterns

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| No edition row | Job not enqueued / cron not running | `THE_PRESSES_NEVER_STOP.md` setup |
| Stuck `processing` | Stale job / crash mid-build | Reap jobs; regenerate |
| `ready` but blank sections | Status set before sections write | `buildEdition.ts` gate |
| Discovery empty, events OK | Surface allocation / cache | `sectionAllocator.ts`, discovery sync |
| Wrong date edition | UTC vs local timezone | `lib/edition/timezone.ts`, profiles.timezone |
| Build timeout | Edge function limits | Staged build scripts |

## Output format

```markdown
# Edition Builder Report — [edition_date] — [metro_key]

## Verdict
READY | INCOMPLETE | MISSING | BUILD REQUIRED

## Edition row
| Field | Value |
|-------|-------|
| id | |
| status | |
| sections count | |

## Section inventory
| section_type | headline (truncated) | OK |
|--------------|----------------------|-----|

## Discovery surfaces
| Surface | Item count |

## Jobs
| job status | notes |

## Commands run
- ...

## Next step
Single recommended action.
```
