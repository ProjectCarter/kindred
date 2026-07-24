# Kindred Editorial Standard

> **Document type:** Permanent editorial constitution.
> **Status:** Source of truth. Supersedes all prior editorial drafts.
> **Applies to:** Every recommendation system, ranking algorithm, filtering
> system, AI prompt, API integration, editorial desk, and content decision in
> Kindred — today and in the future.
> **Precedence:** When any feature, model, heuristic, or business goal conflicts
> with this document, **this document wins**. It sits alongside
> `docs/KINDRED_CONSTITUTION.md` and `CLAUDE.md` and is the single, plain-language
> statement of *what Kindred publishes, and why*.
> **Audience:** Engineers, editorial reviewers, and anyone building a system that
> decides what a reader sees.

This is not marketing copy. Read it the way you would read a language
specification or a design charter: every sentence is a constraint on what we
build next.

---

## Section 1 — Mission

**Kindred exists to help people discover experiences worth leaving home for.**

Kindred is a trusted local guide — not a search engine, a directory, an event
dump, or a coupon app. We are not trying to show everything. We are trying to
show what is worth someone's time.

Every editorial decision must increase at least one of the following:

- **Delight** — it makes the day better.
- **Curiosity** — it makes the reader want to know or see more.
- **Community connection** — it brings people closer to where they live.
- **Usefulness** — it helps the reader do something real.
- **Discovery** — it surfaces something they would not have found on their own.

If a piece of content does not improve at least one of these five things, it
probably should not be published. When in doubt, leave it out.

---

## Section 2 — Editorial Principles

These principles are permanent. They do not expire when a metric dips or a
deadline approaches.

- **Discovery over popularity.** The best pick is not always the most popular one.
- **Interesting beats ordinary.** A reason to look twice outranks a reason to shrug.
- **Local beats generic.** The character of a place is the product.
- **Timely beats stale.** Right-now relevance outranks evergreen filler.
- **Community beats commercial.** We serve readers, not advertisers.
- **Quality beats quantity.** A short, excellent edition beats a long, padded one.
- **Family friendly by default.** Kindred should be comfortable for everyone at the table.
- **Accuracy before speed.** A fast edition that is wrong is a failure.
- **Never fabricate information.** No invented facts, quotes, dates, venues, or sources.
- **Never generate AI images.** Only authorized, real photography or artwork.
- **Safety is never negotiable.** See Section 7.

When two principles appear to conflict, resolve upward: **safety and accuracy
always outrank everything else.**

---

## Section 3 — The Kindred Test

Before any item can be published, ask one question:

> **"If I showed this to someone over breakfast, would they be excited they
> discovered it today?"**

If the answer is *no*, it should probably not appear.

The Kindred Test is deliberately human. It is the final check after every score,
gate, and filter has run. A listing can be verified, safe, and technically
correct and still fail the Kindred Test — because it simply is not worth a
reader's morning. That is a valid reason to hold it.

---

## Section 4 — Editorial Priority Order

When choosing what to feature and in what order, prefer higher-priority content.
This is an ordering of *editorial preference*, applied only after safety and
accuracy gates pass.

**Highest priority**

1. Unique local experiences
2. Seasonal experiences
3. Festivals
4. Live entertainment
5. Outdoor activities
6. Community events
7. Hidden gems
8. Local favorites
9. Beautiful places
10. Reliable classics

**Lower priority**

- Chain businesses
- Generic restaurants
- Ordinary shopping
- Routine services

**Very low priority**

- Business networking
- Professional seminars
- Sales presentations
- MLM
- Recruiting events
- Office trainings
- Generic conferences

Very-low-priority content should generally appear **only if there is truly
nothing better** — and often not even then. Priority is a preference, not a
quota: a reliable classic that genuinely delights can outrank a "unique"
experience that does not.

---

## Section 5 — Discovery Score

Every recommendation receives an internal **Discovery Score from 0–100**. The
score is internal only and is never shown to readers. It answers a single
editorial question: *"If someone had one free afternoon or evening this week,
is this an experience we would genuinely recommend?"*

| Score | Meaning | Editorial action |
| --- | --- | --- |
| **90–100** | Exceptional — "must discover" | Feature prominently |
| **75–89** | Strong recommendation | Publish with confidence |
| **50–74** | Acceptable | Publish when it adds variety or fills a real gap |
| **Below 50** | Not worth the reader's time | **Do not publish** unless exceptional circumstances exist |

The Discovery Score measures **editorial desirability** — how worth-it an
experience is. It is a distinct axis from **trust/verification** (is this real
and correct?). Both must be satisfied: an unverified item is never published no
matter how exciting, and a perfectly verified item is still held if it is
boring. The Discovery Score evaluates reader value — entertainment, community,
uniqueness, local relevance, family friendliness, public interest, visual
appeal, and genuine excitement — and **never business value**.

---

## Section 6 — Editorial Dimensions

The Discovery Score is composed of transparent dimensions. Every dimension is
about the reader's experience, never about commercial benefit to a business.

- **Editorial Quality** — Is this a real, complete, well-formed listing with a
  verified venue, a real date, a source, and enough substance to write about
  honestly? Thin or generic listings score low.
- **Local Relevance** — Does this belong to *this* reader's city or metro? Close,
  in-place experiences outrank distant ones; out-of-area listings are held back.
- **Community Interest** — Do locals actually care about this? Recurring
  favorites, well-attended venues, and civic gatherings score higher.
- **Uniqueness** — Is this one-of-a-kind, rare, or a genuine hidden gem, rather
  than something interchangeable a reader could find anywhere?
- **Timeliness** — Is this happening now, soon, or within a meaningful window?
  Today and this weekend outrank vaguely "someday."
- **Seasonal Relevance** — Does this fit the season, weather, and moment — a
  harvest festival in fall, an outdoor concert on a fair evening?
- **Worth Leaving Home** — Is this an *experience*, not an errand? Concerts,
  festivals, trails, and markets outrank routine stops; networking and
  promotions are penalized.
- **Family Friendliness** — Is this comfortable and welcoming across ages? A
  family-safe default raises confidence; it never lowers a legitimate 21+
  hospitality or cultural experience purely for its age policy.

Future dimensions may be added (for example, **visual appeal** and **user
excitement**) provided they continue to measure reader value, remain
transparent, and never encode commercial preference.

---

## Section 7 — Hard Safety Rules

**These are not scores. They are permanent exclusions.**

The following categories are removed from the candidate pool **before** any
scoring or ranking. No Discovery Score, popularity signal, revenue
consideration, or "exceptional circumstance" can override them. They are hard
gates, forever:

- **Hate** — hate groups, extremist rallies, supremacist content.
- **Violence** — promotion of violence or physical harm.
- **Scams** — pyramid schemes, MLM recruiting, predatory financial seminars.
- **Fraud** — deceptive, fake, or misleading offers.
- **Adult entertainment** — strip clubs, sexually explicit venues or
  performances, escort services, and adult-only sexual entertainment.
- **Dangerous misinformation** — content that could cause real-world harm.
- **Illegal activity** — anything unlawful or promoting unlawful acts.

A hard-excluded item is never merely ranked lower — it is removed entirely so it
can never reach the homepage, search, recommendations, or any future surface.
Safety and accuracy sit above the entire editorial system. This section can only
grow more protective, never less.

---

## Section 8 — The Four Reactions

Every published recommendation should produce a **meaningful positive emotional
response** in the reader. We recognize four:

- ❤️ **"I want to go."** — desire to attend or visit.
- 🍴 **"I want to eat there."** — appetite and anticipation.
- 🌲 **"I want to do that."** — the pull of an experience.
- 📖 **"I'm glad I learned that."** — the quiet reward of curiosity.

Each recommendation must credibly create **at least one** of these reactions. If
a listing produces none of them — if a reader would feel nothing — it does not
belong in Kindred, regardless of how verified or well-formed it is. The Four
Reactions are how we translate the mission's five values (Section 1) into a felt
reader outcome: they are the emotional proof that a pick was worth publishing.

---

## Section 9 — The Grandma Test

A simple, durable filter for judgment calls:

> **"If your grandmother would comfortably attend, recommend, or understand why
> this belongs in Kindred, it passes."**

The Grandma Test is about *belonging and clarity*, not age or taste. It asks
whether an ordinary, thoughtful person would immediately understand why this item
earned its place this morning. If the reason is obvious and comfortable, it
passes. If it requires justification, feels commercial, feels unsafe, or feels
out of place, it fails — and we hold it.

The Grandma Test and the Kindred Test (Section 3) are complementary: the Kindred
Test asks *"is this exciting?"*; the Grandma Test asks *"does this obviously
belong?"* An item should pass both.

---

## Section 10 — Editorial Examples

The table below is illustrative, not exhaustive. It shows how the standard
resolves real listings, and — more importantly — **why**.

| Verdict | Example | Why it belongs here |
| --- | --- | --- |
| **Excellent** | Farmers Market | Local character, community gathering, seasonal, family-friendly, high "worth leaving home." |
| **Excellent** | Night Market | Unique, social, sensory, distinctly local; a reason to go out tonight. |
| **Excellent** | Art Walk | Cultural discovery, community-driven, visually rich, hard to find on your own. |
| **Excellent** | Food Festival | Delight plus appetite; seasonal, communal, unmistakably an experience. |
| **Excellent** | Sunset Kayaking | Outdoor, memorable, timely, one-of-a-kind; the definition of worth leaving home. |
| **Excellent** | Historic Walking Tour | Curiosity and place; teaches something true about where you live. |
| **Excellent** | Jazz Festival | Live entertainment, seasonal, communal, high excitement. |
| **Acceptable** | Local Coffee Shop | A genuine local favorite and useful, but everyday; publishable when it adds variety, ranked below true experiences. |
| **Acceptable** | Community Pool | Useful and family-friendly; ordinary, so it earns a place only when it fits the day. |
| **Acceptable** | Bowling Alley | A real participatory activity; fun but common — solid filler, not a headline. |
| **Acceptable** | Mini Golf | Family-friendly and participatory; pleasant and reliable rather than remarkable. |
| **Poor** | Insurance Seminar | Commercial, not an experience; produces none of the Four Reactions. |
| **Poor** | Mortgage Workshop | Professional/financial service content; no delight, curiosity, or community. |
| **Poor** | Client Acquisition Training | Business-skills content; primary purpose is professional advancement, not discovery. |
| **Poor** | Sales Funnel Bootcamp | Sales/marketing training; commercial intent, fails the Kindred and Grandma Tests. |
| **Poor** | Business Networking Breakfast | Networking for work, not a reason to leave home for joy. |
| **Poor** | MLM Presentation | Recruiting/commercial, borders on the Section 7 scam gate; never a Kindred experience. |

The pattern is consistent: **Excellent** items create strong Four Reactions and
rank at the top of the priority order; **Acceptable** items are real, useful, and
safe but ordinary; **Poor** items exist to serve a business, not a reader, and
produce no genuine reaction. Poor content is not featured to fill space.

---

## Section 11 — Future Expansion

This standard governs everything Kindred builds. Every current and future desk,
engine, and system must follow it, including:

- **Events**
- **Activities**
- **Food & Drinks**
- **History Around Town**
- **Local Deals**
- **Story of Your City, Today's Masterpiece, Today in History**
- **Future recommendation engines**
- **Any future AI ranking systems**

No new feature may bypass this standard. New AI prompts must inherit it. New
ranking systems must express their preferences through the Discovery Score and
its dimensions, keep safety rules as hard gates, and honor the priority order,
the Four Reactions, the Kindred Test, and the Grandma Test.

If a future feature conflicts with this document, **the Editorial Standard
wins.** Kindred's ambition is to become the most trusted local discovery app in
America — earned one morning at a time, because readers consistently find
recommendations genuinely worth their time.
