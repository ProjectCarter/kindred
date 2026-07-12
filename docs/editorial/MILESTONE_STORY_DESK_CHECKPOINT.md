# Milestone Checkpoint — Story Desk & Editorial Constitutions

**Branch:** `cursor/break-it-and-human-mode`  
**Purpose:** Clean checkpoint before app testing. No further architecture in this commit.

---

## Implemented in code

### Story Editor (editorial heart)
- Module: `supabase/functions/_shared/storyEditor/`
- Runs before publication on **Lead**, **Bandit’s Pick**, and **Top Stories**
- Enforces digests of Story Standard, Memorability, Global Language
- Consultation pack seam for future Learning Engine
- Thin-honest fallback when excellence gates cannot clear safely
- Client Lead adapter prefers desk `body[]` / `dek`

### Related editorial pipeline (prior commits on this branch)
- Article quiet editorial close
- EiC briefing no longer previews the Lead
- Knowledge Cards, Editorial Continuation, Bandit’s Pick
- Memory continuity and freshness work

---

## Constitutions (documentation)

Canonical docs under `docs/editorial/`:

- Story Standard  
- Memorability Constitution  
- Global Language Architecture  
- Reading Experience Constitution  

---

## Build verification (this checkpoint)

- `npx tsc --noEmit` — pass  
- `npx expo export --platform ios` — pass  

Excluded from commit: `.env.local`, `.next/`, `supabase/.temp/`, `tsconfig.tsbuildinfo`.
