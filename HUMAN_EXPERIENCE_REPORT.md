# Human Experience Report — Kindred

**Mode:** five first-time readers, not engineers  
**Rules:** no features, no redesign, no polish for polish’s sake — only clarity when confusion costs trust  
**Date:** 2026-07-11

---

## How this was walked

Each persona opened Kindred cold and moved through:

1. Sign-in  
2. Subject choice  
3. First empty morning → get today’s paper  
4. Read the front-page story  
5. Save a clipping  
6. Find that clipping again  
7. Come back “the next morning”

Hesitations below are written in their voice. Fixes are only where wording or labels made the experience harder to understand.

---

## 1. The 72-year-old retiree

| Moment | What they feel | Why |
| --- | --- | --- |
| Login CTA | “Quiet link? Is that a password?” | Poetic CTA hid the action |
| After send | “Open it… open what?” | Never said “email” or “tap the link” clearly enough |
| Bandit | “Who is writing to me?” | A name with no role |
| “Keep this” | “Did I bookmark it? Where?” | Affectionate verb, no destination |
| Library → “What you’ve kept” | Extra guess | Clippings were renamed euphemisms |
| “← The paper” | Soft, but they look for Back | Unfamiliar chrome label |
| “Yesterday” on an older date | “That wasn’t yesterday.” | Trust nick |

**Trust risk:** If the email link fails once, “quiet link” language feels like the app is being clever instead of helpful.

---

## 2. The busy nurse (before work)

| Moment | What they feel | Why |
| --- | --- | --- |
| After subjects: “Open my paper” | Then another empty screen | Promised opening; delivered a second chore |
| Empty: “Almost ready / still being set” | “Is it loading or do I tap?” | Contradictory expectation |
| “Setting the type…” | No sense of finish | Unclear progress language under time pressure |
| Clippings buried under Library | Won’t hunt | Extra tap + renamed link |
| Next morning empty again | “Didn’t I already set this up?” | Overnight paper may still need a tap |

**Trust risk:** Feels like homework before coffee. Every unclear step costs the shift.

---

## 3. The college student

| Moment | What they feel | Why |
| --- | --- | --- |
| Login / onboarding poetry | Skims past | Fine if buttons are obvious |
| Section body with no “Read” | Taps headline anyway | Only the lead opens a full story — documented, not changed (would be a feature) |
| Discovery “Bandit’s Picks” | “Is this ads? AI sludge?” | Unclear editor role |
| Save without confirmation path | “Cool… where?” | Needed the word Clippings on the button |

**Trust risk:** Looks like another AI content app until Bandit is clearly “your editor.”

---

## 4. Someone with slow internet

| Moment | What they feel | Why |
| --- | --- | --- |
| Long prepare after tap | “Is it stuck?” | Needed plain “Preparing your paper…” |
| Library / clippings load fail | “Shelf? Pages?” | Metaphorical errors under stress |
| Pull to refresh | Discoverable if they know the gesture | Not labeled — left alone (no new UI) |

**Trust risk:** Metaphorical errors + silence feel like a broken app, not a slow one.

---

## 5. Someone who has never used an AI product

| Moment | What they feel | Why |
| --- | --- | --- |
| Magic link | “Where’s the password?” | Needed explicit “no password / sign-in link” |
| Bandit notes + “Why this matters” | “Is a machine deciding my news?” | Role unclear; “AI” never said (good) but editor never named either |
| Editorial notes | Helpful once framed | Without Bandit-as-editor, notes feel like judgment |
| Empty morning after onboarding | “Did I break it?” | “Almost ready” sounded automatic |

**Trust risk:** Anything that feels like the app is choosing for them without saying who “Bandit” is.

---

## Cross-persona hesitation map

| Screen | Confusion | Severity | Action |
| --- | --- | --- | --- |
| Login | “Quiet link” | High | **Fixed** — sign-in link language |
| Login sent | Unclear next step | High | **Fixed** — check email, tap link on this phone |
| Onboarding | “Open my paper” lied about next screen | High | **Fixed** — “Continue” / “Saving…” |
| Onboarding | Seasonal curiosity copy | Medium | **Fixed** — plain subject explanation |
| Empty home | Auto vs tap contradiction | High | **Fixed** — “isn’t ready yet” + “Get today’s paper” |
| Preparing | “Setting the type…” | Medium | **Fixed** — “Preparing your paper…” |
| Bandit | Unintroduced character | High | **Fixed** — “Bandit, your editor” |
| Save | “Keep this” with no where | High | **Fixed** — “Save for later” / “Saved to Clippings” |
| Library | Archive/shelf metaphors | Medium | **Fixed** — plain past-papers copy + “Your clippings” |
| Adjacent nav | “Yesterday” when not | Medium | **Fixed** — “Earlier” |
| Article back | “The paper” | Low | **Fixed** — “← Back” |
| Errors | Shelf/pages metaphors | Medium | **Fixed** — library/clippings load errors |
| Section tap → full article | Only lead has reader | Medium | **Documented** — not a copy fix |
| Clippings only via Library | Extra tap to find saves | Medium | **Documented** — path clearer; no new nav |
| Next morning may still need generate | Expectation of automatic paper | High residual | **Documented** — product reality, not a label fix alone |
| Briefing “A breath” | Time unclear | Low | Left — soft timing, not blocking |

---

## Fixes shipped (clarity only)

1. **Login** — “Email me a sign-in link”; sent state explains check email + tap link on this phone  
2. **Onboarding** — plainer subtitle; “Continue” instead of “Open my paper”  
3. **Empty / loading / preparing** — honest “isn’t ready yet,” “Get today’s paper,” “Preparing…”  
4. **Clip action** — “Save for later” → “Saved to Clippings”  
5. **Bandit** — labeled as your editor (greeting + discovery fallback)  
6. **Library / Clippings** — plain titles, “Your clippings,” matching empty-state instructions  
7. **Adjacent “Earlier”** — no false “Yesterday”  
8. **Article** — “← Back”  
9. **Load errors** — say library/clippings couldn’t load  

No new screens, no redesign, no feature work.

---

## Left intentionally unchanged

- Newspaper tone overall (still a paper, not a dashboard)  
- No home shortcut to Clippings (would be navigation feature)  
- No auto-generate on first open (would be product behavior change)  
- Sections without a separate article reader (architecture; not a wording bug)  
- Manifesto preference for editorial verbs — Human Mode overrides where verbs hid the job  

---

## Next-morning walk (shared)

1. Open app → “Opening today’s paper…”  
2. If overnight job finished → folio; Bandit reads as editor; save still says Clippings  
3. If not ready → clear empty state + one tap “Get today’s paper”  
4. Library still holds past mornings; clippings still under Library  

Residual human gap: many people will assume the paper arrives by itself every day. Copy no longer pretends it is already coming when it isn’t — but the product still asks for a tap when no ready edition exists.

---

## Confidence after Human Mode

| Persona | Can they finish the loop without help? |
| --- | --- |
| Retiree | Likely yes if the email link works |
| Nurse | Yes, with fewer false starts |
| Student | Yes |
| Slow network | Yes, if they wait through prepare |
| AI-new | Yes, with Bandit framed as editor |

**Biggest remaining human risk:** first morning still requires a deliberate “Get today’s paper” after onboarding — clearer now, still an extra beat under time pressure.
