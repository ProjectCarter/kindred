# Kindred Editorial Constitution

**Status:** Active — permanent engineering and editorial law  
**Effective:** July 16, 2026

Trust is our most valuable feature.

Every event, activity, recommendation, Bandit's Pick, map location, website,
phone number, address, date, time, and fact must be **verified before
publication**.

Kindred **NEVER** guesses.  
Kindred **NEVER** assumes.  
Kindred **NEVER** fabricates.  
Kindred **NEVER** fills missing information with AI inference.

If something cannot be verified with sufficient confidence, **it is not
published**.

Accuracy is always more important than quantity. A smaller newspaper with 25
verified events is better than a newspaper with 40 events containing one
incorrect listing.

The same rule applies to **Activities** and **Recommendations**.

---

## Before publication — verify

### Events

- ✓ Date
- ✓ Time
- ✓ Timezone
- ✓ Venue
- ✓ Official website
- ✓ Maps coordinates
- ✓ Event status (not cancelled / postponed)
- ✓ Source agreement

### Activities

- ✓ Business exists
- ✓ Not permanently closed
- ✓ Maps coordinates verified
- ✓ Website verified
- ✓ Hours verified when available

### Recommendations

- ✓ Location exists
- ✓ Maps coordinates verified
- ✓ Official website when applicable
- ✓ Business not permanently closed
- ✓ Article facts verified

### Maps

Never guess coordinates. Always verify that the pin opens at the intended
destination. If coordinates cannot be verified, do not publish.

### Articles

Never invent history, facts, rankings, awards, or claims. Only write from
verified information. If confidence is low, omit the statement.

### Unique Conclusions — The Swap Test

Every long-form article (Story of, Masterpiece, Today in History, Bandit's
Pick, Recommendations, Events with editorial body) must have an **original
conclusion**. No template endings, no reusable paragraphs, no rotating closing
pools.

**Golden test:** *If I copied this last paragraph into a different article,
would anyone notice?* If not — rewrite it.

See `.cursor/rules/kindred-unique-conclusions.mdc` and
`lib/edition/uniqueConclusions.ts`.

### Memorable Writing — The Lasting Thought Test

Every article must leave the reader with **one memorable idea** — a verified
fact, overlooked detail, comparison, or takeaway they would remember an hour
later. No filler. No generic endings ("worth visiting," "continues to inspire").

**Golden test:** *What is the one idea the reader will remember an hour from
now?* If there isn't one — rewrite.

See `.cursor/rules/kindred-memorable-writing.mdc` and
`lib/edition/memorableWriting.ts`.

### Publication gates (articles)

Every article must pass all four:

1. **Accuracy Test** — verified facts only  
2. **Swap Test** — no reusable conclusions  
3. **Unique Conclusions Test** — original ending for this article only  
4. **Lasting Thought Test** — one memorable idea worth remembering  

### Visual Language Constitution (v1)

One verified editorial category → one permanent emoji. Never stack. Never rotate.
Icons follow the article everywhere (homepage, article, saved, search).

See `.cursor/rules/kindred-visual-language.mdc` and `lib/edition/categoryIcon.ts`.

---

## General rule

When confidence is below our publishing threshold:

**DO NOT PUBLISH.**

Kindred's reputation depends on trust. Every recommendation should be accurate
enough that we would confidently send our own family there.

**When in doubt: LEAVE IT OUT.**

---

## Editorial exclusion filter (permanent)

Kindred is a **premium, family-friendly morning newspaper**. The editorial
engine surfaces inspiring, educational, cultural, historical, recreational, and
community-focused content — never material that would make a reader of any age
uncomfortable at the breakfast table.

**Gate:** `localEvents/familyFriendlyFilter.ts` — runs **before deduplication
and editorial ranking** on every provider (Eventbrite, Ticketmaster, and any
future source). The same gate applies to Activities, Recommendations, Bandit's
Pick, and future discovery surfaces via `discovery/score.ts`.

### Always exclude

**Adult entertainment**

- Strip clubs, gentlemen's clubs, male/female revue shows, exotic dancers
- Adult entertainment, adult bookstores, adult arcades
- Escort services, swinger events, BDSM/fetish events, sex expos
- Pornography-related events, sexually explicit performances
- Explicit or adult-oriented burlesque (theatrical burlesque at legitimate
  venues may pass)

**Hate and extremism**

- Hate groups or extremist organization rallies and meetups

**Violence and illegal activity**

- Events promoting violence or illegal activity

**Scams and predatory commerce**

- Scam or fraudulent events, pyramid schemes, MLM recruiting events
- Timeshare sales presentations, "get rich quick" seminars
- Predatory financial seminars, fake investment or crypto scams

### Never exclude (when verified and editorially sound)

Broadway, theater, ballet, opera, symphony, concerts, comedy, live music,
museums, cultural festivals, art exhibits, family performances, educational
seminars, charity events, community gatherings, and sporting events.

### Diagnostics (each edition)

Log filtered count, exclusion reason (`signal` + `category`), and up to eight
sample titles for engineering review — never shown to readers.

---

## Enforcement in code

| Desk | Primary gates |
| --- | --- |
| Events | `eventDateVerification.ts`, `editorial/confidence.ts`, `familyFriendlyFilter.ts`, pipeline, `buildEdition.ts` |
| Activities / Recommendations | `familyFriendlyFilter.ts`, `confidence.ts`, `confidencePayload.ts`, `score.ts`, `sectionAllocator.ts` |
| Articles | `storyEditor/`, `uniqueConclusions.ts`, `memorableWriting.ts`, verified metadata templates |
| Maps | Provider coords + official URL — no coordinate invention |

Cursor rule (always applied): `.cursor/rules/kindred-editorial-constitution.mdc`
