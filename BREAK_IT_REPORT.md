# Break It Report — Kindred

**Mode:** adversarial failure hunt at ~1M-user scale  
**Rules followed:** no features, no redesign, no polish — only production breakers  
**Date:** 2026-07-11  
**Typecheck:** `tsc --noEmit` clean after fixes

---

## Verdict

Several paths that could hang, crash, or lie to the reader are now hardened. The app still depends on live network + in-memory article stash; those remain the largest residual failure modes under real devices and process death.

---

## Critical

| Issue | Attack | Impact | Status |
| --- | --- | --- | --- |
| `loadEdition` throw left home loading forever | Malformed jsonb / unexpected throw mid-load | Infinite loading; paper unreachable | **Fixed** — try/catch clears loading + error |
| Malformed `lead_story` returned crashy shapes | Partial/null `heroImage`, `summary`, `selection` | Folio crash on front page | **Fixed** — `parseLeadStory` never throws; safe defaults |
| Auth code retry storm on poisoned magic links | Failed `exchangeCodeForSession` removed code from set | Boot loop / rate-limit / stuck auth | **Fixed** — failed codes stay in `exchangedCodes` |
| Clip insert race + thrown errors stuck pending | Double-tap / unique violation / network throw | Clip button dead forever | **Fixed** (home + archive) — `try/finally`; treat `23505` as success |

---

## High

| Issue | Attack | Impact | Status |
| --- | --- | --- | --- |
| Non-`ready` edition treated as today’s paper | Job mid-flight / failed row with partial sections | Incomplete or empty “paper” that looks finished | **Fixed** — home + archive require `status === "ready"` |
| Generate presses stuck on hung invoke | Slow / stalled Edge Function, no client timeout | `generating` never clears; CTA dead | **Fixed** — 90s client timeout races invoke |
| Expired JWT on home load silently no-ops | Session expired while app open | Blank home, no redirect | **Fixed** — JWT/expired → `signOut` |
| Interests stored as JSON string | Legacy / bad profile write | Onboarding loop or wrong gate | **Fixed** — index parses string arrays safely |
| Library sign-out failure blocked login | `signOut` throws | User trapped signed-in UI | **Fixed** — navigate to login even if sign-out errors |
| Broken image URIs | Dead CDN / 404 hero | Broken image chrome / layout blowups | **Fixed** — lead + article `onError` hide/fallback |
| External URL open rejects | Bad `sourceUrl` / no handler | Unhandled promise rejection | **Fixed** — `Linking.openURL(...).catch` (events + article) |
| Discovery desk null `reasons` / bad items | Malformed discovery jsonb | Crash in “why” formatter | **Fixed** — filter items; safe `reasons` |

---

## Medium

| Issue | Attack | Impact | Status |
| --- | --- | --- | --- |
| Rapid clip spam / duplicate saves | Double-tap before pending set | Duplicate rows or error noise | **Fixed** — pending guard + unique treated as success |
| Stale load after refresh race | Pull-to-refresh then older response wins | Wrong edition / clips flash | **Mitigated** — load generation counters on home/clips |
| App resume with stale morning | Background overnight | Yesterday’s paper until refresh | **Mitigated** — AppState resume refresh (throttled) |
| Local events malformed cards | Missing venue/url fields | Blank rows / bad maps query | **Fixed** — coerce fields in `parseLocalEventsBody` |
| Article route `id` as `string[]` | Odd deep-link / router params | Missing-story false negative | **Fixed** — normalize param |
| In-memory article stash lost | Process death / cold start on `/article/:id` | “Story isn’t available” | **Open** — graceful empty state exists; no disk cache |
| No offline edition cache | Airplane mode after first paint | Empty / error; cannot re-read | **Open** — intentional for now; pull-to-retry only |
| Deep link `/home` skips onboarding gate | Session without interests | Home without profile subjects | **Open** — index gates `/`; deep links can bypass |
| Overnight Edge reliability | Provider outages / job backlog | Empty mornings at scale | **Open** — ops / monitoring, not client |

---

## Low

| Issue | Attack | Impact | Status |
| --- | --- | --- | --- |
| Article stash LRU (16) eviction | Open many articles in one session | Older stash miss → missing story UI | Acceptable; empty state handles it |
| Companion stash same bound | Same | Missing aside copy | Acceptable |
| Onboarding `pending` if navigate fails after write | Rare nav failure | Button stays disabled until remount | Low; write already succeeded |
| Magic-link Universal Links on all devices | Misconfigured AASA / scheme | Auth friction | Needs device E2E; not proven in this pass |
| Generate timeout leaves server work running | Client gives up at 90s | User retries; possible duplicate job pressure | Server should stay idempotent by date |
| Clippings load without auth redirect | Expired session on clips screen | Error copy, not auto logout | Layout auth effect usually redirects |

---

## Attack surface coverage

| Vector | Result |
| --- | --- |
| Crashes (null / malformed payloads) | Hardened lead, discovery, local events, interests |
| Memory growth | Article/companion LRU already bounded |
| Race conditions | Load gens; clip pending; auth code set |
| Loading loops | Auth code storm fixed; home load catch fixed |
| Stale state | Resume refresh; gen counters |
| Navigation | Article missing + back; archive id normalize |
| Auth edges | Expired JWT sign-out; poisoned link no retry storm |
| Offline | Degrades to error/empty — **not cached** |
| Retry / duplicate | Clip unique; generate gated by `generating` + timeout |
| Rapid tapping | Clip + generate guards |
| Background/foreground | Home AppState refresh |
| Timezone | `localEditionDate()` (not UTC slice) |
| Empty / malformed API | Parsers return null/safe; UI empty states |
| Images | `onError` paths |
| Slow network | Generate timeout; pull-to-retry |
| Expired sessions | Sign-out on JWT errors |
| Cancelled requests | Cancelled flags / gen checks |
| Deep links | Auth URL parse hardened; article id array; onboarding bypass noted |
| State restoration | Article stash not restored after kill |

---

## Fixes shipped in this pass

1. `parseLeadStory` / `articleFromLeadStory` / lead hero `onError`
2. `home` `loadEdition` try/catch + JWT sign-out + `ready`-only editions
3. `home` generate 90s timeout
4. Clip toggle: `try/finally` + duplicate `23505` (home + `edition/[id]`)
5. Auth: keep failed codes in `exchangedCodes`
6. Index interests JSON-string parse
7. Library sign-out always leaves
8. Discovery / local events / Linking / article param hardening

---

## Still open (do not ignore at 1M)

1. **Offline / process-death article & edition cache** — biggest “app feels broken” residual  
2. **Onboarding enforcement on all authenticated routes** — not only `/`  
3. **Edge Function SLO** — generate + overnight jobs need dashboards and alerts  
4. **Device E2E** — magic link, cold start deep link, kill-while-reading  

---

## What was deliberately not done

- No new features  
- No UI redesign or typography work  
- No backend architecture rewrite  
- Cosmetic empty-state copy tweaks ignored  

---

## Confidence

**Limited beta:** reasonable if magic-link and generate-edition are monitored.  
**One million users:** not yet — needs offline/read cache strategy, route-level onboarding guard, and Edge reliability proof under load.
