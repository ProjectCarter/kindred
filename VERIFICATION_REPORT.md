# Verification Report

**Kindred — Verification Mode**  
*Assume nothing. Trace every major flow. Fix what breaks. Report honestly.*

Verification method: **static end-to-end code-path audit** + **unit checks** (timezone helper, email gate, TypeScript).  
**Not** a live device TestFlight run against production Supabase in this session.

Date: 2026-07-11

---

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | Path exists, wired, and consistent under inspection |
| ⚠ | Partially works / depends on runtime data or ops |
| ❌ | Broken or missing before this pass (fixed if noted) |

Confidence is **feature confidence after fixes in this pass**, 1–10.

---

## ✅ Verified Working

| Flow | Confidence | Evidence |
|------|------------|----------|
| **First launch (cold boot)** | 8 | `_layout` boots → session null → `/login`. Cream `PaperLoading` while auth resolves. |
| **Login (OTP request)** | 8 | `signInWithOtp` + PKCE redirect via `Linking.createURL("/")`. Email shape validated. Double-submit guarded. |
| **Deep link auth (`?code=`)** | 7 | Boot exchanges code before `getSession`; live URL listener; hardened URL parse for `kindred://`. Device mailer still required to prove end-to-end. |
| **New account → onboarding** | 8 | Index uses `maybeSingle` interests; empty → `/onboarding`. Profile **update-or-insert** for first row. |
| **Returning account → home** | 8 | Interests present → `/home`. Session persistence via AsyncStorage. |
| **Onboarding save** | 8 | Requires ≥1 subject; writes interests; `replace("/home")`. |
| **Home load** | 8 | Local calendar date key; race-safe generation counter; empty vs network-error distinguished. |
| **Refresh (pull)** | 8 | `RefreshControl` → `loadEdition(true)`. |
| **App resume after background** | 7 | `AppState` active → throttled refresh (≥45s). **Added this pass.** |
| **Morning Edition generation (client invoke)** | 7 | `functions.invoke("generate-edition")` + error surfaces + reload. Success depends on Edge/cron health. |
| **Bandit** | 8 | Payload parse → `banditMorningLine` → MorningGreeting note + signature; weekly/seasonal as aside. |
| **Morning briefing** | 8 | `morning_edition` → opening/briefing via `requestMorningBriefing`; expand path present. |
| **Lead + Knowledge (“Why this matters”)** | 7 | Knowledge selected + `whyThisMatters` / companion on article. Empty when payload missing (graceful). |
| **Discovery desk** | 7 | Discovery payload → Bandit’s Picks / weekend / gems; renders only when items exist. |
| **Memory (continuity note)** | 7 | **Was unwired (❌).** Now selects `memory`, parses `sinceYouLastRead`, shows “Since you last read” under Bandit. |
| **Weather** | 8 | Weather section rendered; text also grounds Bandit/hero context. |
| **Local Events** | 8 | `local_events` → `LocalEventsSection` parse + maps/source links. |
| **Article reading** | 8 | Stash → `/article/[id]` → `ArticleReader`; missing stash calm empty state; progress/session signals. |
| **Save clipping** | 8 | Insert/delete + pending guard; optimistic set update; archive path mirrors home. |
| **Library** | 8 | Ready editions list → `/edition/[id]`; empty shelf copy. |
| **Clippings** | 8 | Join to sections; local events rendering; remove guard. |
| **Empty / loading / error states** | 8 | PaperLoading; empty morning; shelf/presses errors; article missing. |
| **Logout** | 8 | **Was missing (❌).** Library → “Sign out” → `signOut` → `/login`. Auth guard also redirects. |
| **Timezone (local edition date)** | 9 | Unit check: local evening stays `YYYY-MM-DD` local while UTC slice rolls forward. |
| **Typecheck** | 9 | `tsc --noEmit` clean after fixes. |

---

## ⚠ Needs Attention

| Flow | Confidence | Why |
|------|------------|-----|
| **Magic link on real devices** | 6 | Code path solid; still depends on mail client, Universal Links / scheme registration, and Supabase redirect allow-list for `kindred://`. |
| **Overnight auto-generation** | 5 | Client can invoke generate; **scheduled readiness** is ops. Empty mornings still possible. |
| **Discovery / Knowledge / Memory content quality** | 5 | UI wiring verified; payloads may be null → surfaces correctly hide. Not the same as “always delightful content.” |
| **Offline behavior** | 4 | No offline edition cache. Expect errors / empty, not reading offline. Copy is calm; experience is degraded. |
| **Slow network** | 5 | Loading states exist; long `generate-edition` can sit on “Setting the type…” with no soft timeout. |
| **Edition status edge cases** | 5 | Home loads today’s row without requiring `status === "ready"`. Partial generating editions could show thin sections. |
| **Article stash after process death** | 5 | In-memory LRU only — OS kill mid-navigation → missing article state (by design, calm). |
| **Accessibility (VoiceOver full pass)** | 5 | Roles/labels/Reduce Motion present; no on-device VoiceOver verification this session. |
| **Deep links beyond auth** | 4 | Auth codes handled. No edition/article universal links. |
| **Timezone change mid-session** | 6 | Resume refresh + local date on load help; no dedicated timezone-change listener. |

---

## ❌ Broken

| Item | Status |
|------|--------|
| **Logout (pre-pass)** | **Fixed** — Library “Sign out”. |
| **Memory never fetched/shown (pre-pass)** | **Fixed** — `memory` column + “Since you last read” surface. |
| **No AppState refresh (pre-pass)** | **Fixed** — throttled resume reload on Home. |
| **Live E2E against production** | **Still not run in this session** — do not mark “device-proven.” |

Nothing known remains **actively crashing** the client under static analysis. Remaining red items are **ops / device / content**, not missing screens.

---

## Fixes applied during Verification Mode

1. **Sign out** on Library (quiet, editorial).  
2. **Memory wiring** — select `memory`, parse continuity, render under Bandit.  
3. **App resume refresh** on Home (45s throttle).  
4. **Auth deep-link URL parsing** hardened for custom schemes.  
5. Home / archive both pass `memoryNote` into the folio.

---

## Confidence by product area (summary)

| Area | Score | One-line |
|------|-------|----------|
| Auth & routing | 7.5 | Strong client; device mail/links TBD |
| Onboarding | 8 | Write path fixed for new profiles |
| Morning folio UI | 8 | Bandit, briefing, weather, events, discovery wired |
| Intelligence payloads | 6.5 | Wired; content-dependent |
| Generation / overnight | 5.5 | Invoke OK; ops reliability unknown here |
| Clips & library | 8 | Solid |
| Offline | 4 | Degrade only |
| Overall limited beta | **7 / 10** | Ready for closed TestFlight *if* Edge editions are healthy |

---

## What this report does **not** claim

- That a physical iPhone completed every flow today  
- That Supabase Edge Functions and cron are green in production  
- That every edition will contain Discovery, Knowledge, and Memory data  
- That offline reading works  

---

## Recommended next verification (human / TestFlight)

1. Fresh install → magic link → onboarding → home  
2. Sign out → sign in returning  
3. Empty morning → Open today’s edition → wait for folio  
4. Confirm Bandit + Memory note + Discovery when payloads exist  
5. Lead → article → Keep → Clippings → remove  
6. Background 2 minutes → resume → pull/refresh  
7. Airplane mode on home and login  

---

*— Verification Report*
