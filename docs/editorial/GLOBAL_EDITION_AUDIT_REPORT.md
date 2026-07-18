# Global Edition Editorial Audit

**Audit date:** 2026-07-17  
**Method:** Developer Edition Override (`devPreview: true`) — production `generate-edition` pipeline, no logic changes  
**Scope:** 29 cities worldwide + deep editor-in-chief review of the best available ready edition (Gilbert metro, 2026-07-15, 106-event pool)

**Artifacts:** `reports/global-edition-audit.json` · `reports/gilbert-july15-deep-audit.json` · `scripts/audit-global-editions.mjs`

---

## Executive summary

Kindred’s **Gilbert-area pipeline can produce a thick event pool** (106 verified listings on 2026-07-15), and the new **Editorial Diversity Engine** successfully spreads homepage cards across venues and cities. But the **global newspaper test failed decisively**: **27 of 29 cities could not produce a complete ready edition** in this run, and the Gilbert deep-dive revealed **critical trust failures** (adult listings, scam workshops) plus **systematic data gaps** (no event coordinates in frozen cards, no authorized listing images).

**Average health score across 29 generation attempts: 4/100.**

Until completeness gates and family-friendly filtering are reliable in every market, Kindred cannot feel like a professionally curated newspaper outside the Phoenix metro QA path.

---

## Methodology

1. **Automated global run** — `node scripts/audit-global-editions.mjs` invoked `generate-edition` for 29 cities on edition date `2026-07-17` with `devPreview: true`.
2. **Per-edition checks** — empty sections, duplicate listings, homepage venue/category/geo repetition, generic titles, missing maps/images, hometown sports, emoji concerns, suspicious listings.
3. **Deep dive** — Full editor review of `2026-07-15` ready edition (106 events, Gilbert QA user), simulating homepage selection with diversity penalties aligned to production.

---

## Global generation results (29 cities)

| Outcome | Count | Cities |
| --- | ---: | --- |
| Generation failed (500) | 27 | Seattle, Denver, Chicago, NYC, LA, SF, Miami, Austin, Boston, Portland, San Diego, London, Paris, Rome, Tokyo, Sydney, Toronto, Berlin, Amsterdam, Barcelona, Dublin, Vancouver, Montreal, Singapore, Hong Kong, Mexico City, São Paulo, + 4 JSON parse errors |
| Marked ready but incomplete | 2 | Gilbert, Phoenix (no `local_events` section on 2026-07-17 after run) |
| Ready + full event pool (historical) | 1 | Gilbert metro 2026-07-15 (used for deep dive) |

**Primary failure messages:**
- `"Edition incomplete — not marking ready: bandit pick missing"` (23 cities)
- `"Edition incomplete — not marking ready: edition_sections missing today_in_history; bandit pick missing"` (Seattle, Aug 1 test)
- `"Unexpected token 'Y', \"You are ma\"... is not valid JSON"` (4 cities — upstream LLM/API returning prose instead of JSON)

**Follow-up spot checks:**
- Gilbert `2026-08-02` → status **ready** but sections = `[weather, today_in_history, story_of]` only — **no local_events, no discovery, no bandit on homepage path**
- Gilbert `2026-07-15` → status **ready**, **106 events**, bandit pick + lead story present

---

## Deep dive: Gilbert metro (2026-07-15) — editor-in-chief review

### What works

- **Event pool depth:** 106 listings — enough for a real newspaper desk.
- **Homepage venue diversity:** 8/8 unique venues after diversity selection.
- **Geographic spread (homepage):** Mesa (2), Tempe (2), Chandler, Gilbert, Queen Creek — acceptable valley spread.
- **Category mix (homepage):** sports, community, food, arts, music, nightlife — not a single-category wall.
- **Duplicate merge:** 0 exact duplicate keys in pool.
- **Discovery surfaces populated:** activities, restaurants, coffee, museums, etc. (12 items each on many surfaces).
- **Bandit’s Pick + lead story:** present.

### Critical editorial failures (this edition)

| Issue | Evidence |
| --- | --- |
| **Adult entertainment in pool + homepage** | `"Muscle Men Male Strippers Revue…"` ranked on homepage; **12** stripper/skelora listings in pool |
| **Family-friendly gate failure** | Patterns like `male strippers` exist in `familyFriendlyFilter.ts` but listings still published |
| **Scam / MLM-style workshops** | Venues like `"For venue details reach us @ events@skelora.com"` — **10+** Skelora trainings in pool |
| **Misleading “sports” classification** | `"Buds & Bikinis Pool Party"` at golf club → category `sports`, **editorialRank #1** |
| **Misclassification of music** | Pearl Jam / Nirvana tributes tagged `community`, not `music` |
| **No hometown sports in pool** | **0** D-backs / Cardinals / Mercury / Suns / Rising FC among 9 “sports” events |
| **100% missing listing images** | All 106 events: `imageUrl: null`, Eventbrite `imageRights.policy: "prohibited"` |
| **100% missing map coordinates on frozen cards** | No `lat`/`lon` on persisted event JSON — maps cannot work from edition payload |

### Homepage vs ranking tension

Top 10 by `editorialRank` are mostly community/networking — several are **networking-heavy** (`Women 360 Networking`, `Arizona Cannabis Business Networking`). A major concert tribute ranks **#8–9** but classified as **community**. The diversity engine correctly avoided venue repeats but **still surfaced rank #67 stripper show** because higher-ranked picks cluster in overlapping desks/geographies and pool lacks strong hometown sports/music anchors.

---

## Prioritized improvements (no production changes in this audit)

### Critical — fix before calling Kindred “global”

1. **Edition completeness gate fails outside Gilbert**  
   93% of cities failed generation (bandit pick / today_in_history missing). Readers in Seattle, London, Tokyo, etc. would get **no paper** or a **failed row**.  
   *Impact:* Product unusable outside QA metro.

2. **“Ready” editions missing entire desks**  
   Future-date Gilbert builds (`2026-08-02`) marked **ready** with **no `local_events` section**. Completeness gate must require local_events + discovery for ready status.  
   *Impact:* Silent empty Events desk.

3. **Adult entertainment publishing**  
   Male stripper revues in pool and on homepage violate Editorial Constitution family-friendly rule. Filter exists but listings still ship — verify gate runs at **final publish**, not just gather.  
   *Impact:* Trust destruction; app store / brand risk.

4. **Scam / predatory workshop listings**  
   Skelora-style events with email-as-venue and generic “1 Day Training” titles pollute pool and homepage. Need **venue verification** + **title quality** reject rules.  
   *Impact:* Reader trust; newspaper credibility.

5. **International / non-Phoenix generation JSON failures**  
   LLM or writer endpoints returning non-JSON prose for bandit/history desks (Paris, Dublin, Portland, Vancouver).  
   *Impact:* Hard 500 for entire edition.

---

### High — required for “professionally curated” in every US metro

6. **No event coordinates in frozen edition JSON**  
   All 106 cards lack `lat`/`lon` in stored payload — map links and “open in maps” cannot be verified client-side.  
   *Impact:* Broken map UX; Constitution violation.

7. **No authorized event images (Eventbrite)**  
   100% `imageUrl: null` with rights `prohibited`. Homepage feels like a text directory, not a magazine. Need **fallback strategy** (category editorial art from library, or alternate authorized sources).  
   *Impact:* Kindred Effect — readers imagine through images.

8. **Hometown sports not surfacing (Phoenix metro)**  
   Sports market catalog exists; **0** hometown team events in a 106-event pool with 9 sports tags. Ticketmaster/sports retrieval or ranking boost not reaching published pool.  
   *Impact:* Core Local Events promise for metro readers.

9. **Category classification accuracy**  
   Pool party → sports; tributes → community; strippers → nightlife/community instead of **reject**. Emoji + desk selection inherit bad labels.  
   *Impact:* Wrong icons, wrong homepage desk, wrong reader expectations.

10. **Story of / Bandit / History desks missing for many markets**  
    Non-Gilbert runs fail bandit pick; Phoenix run missing Story of. Universal desks must degrade gracefully with verified fallbacks, not fail whole edition.

11. **Networking/event spam crowding top ranks**  
    Top `editorialRank` slots dominated by networking summits and generic community events — music, sports, festivals underrepresented at rank layer **before** homepage diversity runs.  
    *Impact:* Diversity engine cannot fix bad pool ordering alone.

---

### Medium — polish for magazine-quality curation

12. **Generic / template titles**  
    `"Event Planning 1-Day Workshop | Mesa, AZ"` — fails “exact verified names” editorial standard.

13. **Emoji catalog vs frozen `categoryIcon`**  
    Re-generate editions to pick up new editorial emoji rules; audit found legacy classifications (e.g. sports mislabels) matter more than emoji mapping.

14. **Geographic spread still Mesa/Tempe-heavy**  
    Diversity helps, but pool sourcing skews to east valley; Scottsdale/West Phoenix underrepresented.

15. **Sports market catalog coverage**  
    Only Phoenix, Seattle, Denver metros in hometown catalog — Chicago, NYC, LA, Boston, etc. have **no hometown team boost** even when generation succeeds.

16. **International event sources thin**  
    London, Tokyo, Paris never reached ready — likely discovery + events + bandit dependencies tuned for US Eventbrite/Ticketmaster.

17. **Weak sections on thin days**  
    When generation succeeds with partial data, Story of / History Around Town / Activities may be empty — health report should block “ready” or show explicit empty states.

---

### Low — tune after critical/high

18. **Ranking vs diversity tradeoffs**  
    Document when homepage intentionally omits top pool rank for spread; ensure **See All** still shows true editorial order.

19. **Duplicate near-matches across providers**  
    `"Copy of Muscle Men Male Strippers…"` — dedupe should catch copy variants.

20. **Bandit notes on low-quality events**  
    Stripper listing still has Bandit note (“Worth stepping out for…”) — notes should not generate for excluded categories.

21. **Dev audit tooling**  
    Wire `audit-global-editions.mjs` to Edition Health Report + unique edition dates per city; add to Developer Tools export.

22. **editorialScore not persisted on event cards**  
    Frozen JSON has `editorialRank` but not always `editorialScore` — homepage/diversity use score fallback, weakening quality signal.

---

## Recommended validation sequence (before next feature)

1. Re-run global audit with **unique edition date per city** after completeness fixes.
2. Gate **ready** on: local_events ≥ 8, bandit pick, today_in_history, discovery surfaces, family-friendly re-check.
3. Re-audit Gilbert with **post-filter** pipeline — confirm 0 adult/spam in pool.
4. Manually spot-check homepage in Dev Tools for: Tokyo, London, Seattle, Chicago, Miami, Denver (target ≥ 80 health score).

---

## Per-city generation log (2026-07-17 run)

| City | Result | Notes |
| --- | --- | --- |
| Gilbert | Ready/incomplete | 0 events on this date after run |
| Phoenix | Ready/incomplete | Story of missing |
| Seattle–São Paulo (27) | Failed | Bandit pick or JSON errors |

**Best available edition for editorial QA:** Gilbert metro **2026-07-15** (106 events, ready).

---

## Bottom line

**Architecture wins (recent sprints):** sport-specific emojis, editorial emoji catalog, homepage diversity engine, dev override + health report — all pointed in the right direction.

**Biggest gap:** The **production pipeline does not yet reliably produce a complete, family-safe, image-rich edition outside Gilbert**, and even Gilbert’s best edition contains listings an editor would **never** put on the front page.

Fix **Critical** items 1–5 before investing in new reader-facing features. That unlocks the value of everything already built.
