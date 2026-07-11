# Release Candidate Report

**Kindred — TestFlight readiness**  
*No new features. No UI redesign. No backend architecture changes. Stability only.*

Date: 2026-07-11  
Scope: Client app (Expo / React Native), auth boot, navigation, edition load, article handoff, library / clippings, production logging.

---

## 1. What was fixed

### Authentication & boot
- **Auth boot race** — Root layout now exchanges magic-link `code` (if present) *before* `getSession`, then marks loading complete. Prevents “logged out flash” and competing session reads.
- **Duplicate code exchange** — Auth codes are tracked so the same PKCE code is not exchanged twice on cold start + deep link.
- **Unmount-safe auth** — Boot and link listeners cancel cleanly; no session writes after unmount.
- **Index routing** — Unauthenticated users redirect to `/login` (not onboarding). Profile lookup uses `maybeSingle()` so a missing profile row does not throw.
- **Env misconfiguration** — Missing `EXPO_PUBLIC_SUPABASE_*` no longer crashes on import; `isSupabaseConfigured` gates auth/home with a calm error.

### Login & onboarding
- **Email validation** — Implausible emails are rejected before OTP (fewer failed round-trips on slow networks).
- **Double-submit guards** — Login and onboarding ignore taps while pending.
- **Login unmount safety** — OTP result cannot set state after leave.
- **Onboarding profile write** — Update-or-insert path so first-time users without a `profiles` row can still save interests (previously a silent/failed `update`).

### Edition date / home reliability
- **Timezone bug (critical)** — Today’s edition is keyed by **local calendar date**, not `toISOString().slice(0, 10)` (UTC). Users west of UTC no longer miss “today” in the evening / see the wrong morning.
- **Stale response races** — Home load uses a generation counter + mounted flag so refresh / generate / unmount cannot apply outdated results.
- **Network empty vs query error** — Query failures surface a pull-to-retry message instead of looking like “no paper yet.”
- **Generate double-tap** — Ignored while already generating.
- **Clip double-tap** — Home and archive clip toggles ignore re-entry while a clip write is in flight.
- **Error clear on reload** — Successful/attempted reloads clear prior errors.

### Archive screens
- **Edition detail** — Cancelled loads on `id` change / unmount; missing `id` handled; clip re-entry guarded.
- **Library / Clippings** — Generation counters + try/catch so slow networks and unmounts cannot leave spinners or stale lists; clip remove guarded.

### Memory & article handoff
- **Bounded article stash (LRU 16)** — In-memory article store no longer grows without limit across a long session.
- **Bounded companion stash (LRU 16)** — Matching companion metadata eviction.

### Production logging
- **Home / personalization logs** — `console.log` / warn / error gated behind `__DEV__` (except intentional quiet skip of optional signal table).
- Reduces console noise and accidental PII-ish debug dumps in TestFlight builds.

### Typecheck
- `tsc --noEmit` passes after these changes.

---

## 2. What still needs work

| Item | Severity | Notes |
|------|----------|--------|
| **Overnight edition generation reliability** | High (ops) | Empty mornings still depend on cron / Edge Functions. Client can “Open today’s edition,” but TestFlight love depends on papers being ready. |
| **Article stash is process-memory only** | Medium | If the OS kills the app mid-navigation, the article screen shows the calm missing state. Acceptable for RC; AsyncStorage persistence would be a later hardening (not done — would be a small feature). |
| **Offline mode** | Medium | No explicit offline cache of editions. Offline → network errors / empty. Manifesto-friendly copy exists; true offline reading is out of scope for this RC pass. |
| **Generate-edition timeout UX** | Medium | Long Edge Function runs may feel stuck on “Setting the type…” until the invoke returns or fails. Worth a soft timeout message in a follow-up. |
| **Profiles schema assumptions** | Low–Med | Insert path assumes `id` + `interests` are enough; if DB requires more NOT NULL columns, onboarding insert may still fail — verify against live schema in TestFlight. |
| **Accessibility audit (VoiceOver full pass)** | Low–Med | Reduce Motion honored in loading/folio; full VoiceOver walkthrough on device not automated here. |
| **Crash reporting** | Med (ops) | No Sentry/Crashlytics wired in-repo. Recommended before wider beta. |
| **E2E device matrix** | Med | No Detox/Maestro suite; manual TestFlight checklist below. |

---

## 3. What to monitor during TestFlight

### Must-watch
1. **Magic link → session** on cold start, backgrounded mail app, and already-open Kindred.
2. **Timezone edges** — open app just before/after local midnight; confirm “today’s” edition matches local morning.
3. **Empty morning → Open today’s edition** — success rate, duration, and failure copy.
4. **Lead → article → back** — article body present; missing-stash path if process was killed.
5. **Keep this / Kept for you** — rapid taps; airplane mode mid-save.
6. **Library → past edition → Yesterday/Later** — navigation and clip state.
7. **Onboarding first run** — brand-new account with no `profiles` row.
8. **Sign-out / session expiry** — redirected to login without loops (if sign-out exists in build; otherwise session refresh failures).

### Metrics / signals (manual or dashboard)
- `generate-edition` Edge latency and error rate
- Auth `exchangeCodeForSession` failures
- Editions query empty rate by hour / timezone
- Clipping insert/delete errors
- Any native crash reports from TestFlight

### Network conditions to simulate
- Airplane mode on home, login, article open
- Slow 3G while generating edition
- Flaky wifi during pull-to-refresh

---

## 4. Confidence level for a limited beta launch

### **Confidence: 7.5 / 10 for a closed TestFlight (friends & design partners)**

**Why this high**
- Critical timezone bug fixed
- Auth boot ordering fixed
- Race / double-submit / log hygiene addressed
- Typecheck clean
- Missing states remain calm rather than crashing

**Why not higher**
- Overnight generation + Edge Function ops still dominate real-world reliability
- No crash analytics wired
- No automated E2E
- Offline is degrade-not-cache
- Article body handoff is memory-bound

### Recommendation
Ship a **limited TestFlight** (10–30 testers) with a morning checklist for three consecutive days. Do **not** widen until:
1. Overnight editions arrive reliably for the cohort, and  
2. Magic-link success is boring, and  
3. At least one crash-reporting tool is receiving events.

---

## 5. Suggested TestFlight checklist (testers)

- [ ] Fresh install → magic link → onboarding → home  
- [ ] Returning user → home opens today’s paper  
- [ ] Pull to refresh  
- [ ] Empty morning → open today’s edition  
- [ ] Read lead story → back to paper  
- [ ] Keep a section → Library → Clippings → remove  
- [ ] Open yesterday from Library  
- [ ] Airplane mode on home and on login  
- [ ] Open link from email while app is killed  

---

## 6. Out of scope (intentionally unchanged)

- New features, AI engines, UI redesign  
- Backend / cron architecture  
- Design Manifesto identity  
- Local Events structure  
- Adding sounds, haptics, or analytics SDKs (ops follow-up)

---

*— Release Candidate Report*
