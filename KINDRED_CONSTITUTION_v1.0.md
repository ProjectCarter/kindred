# Kindred Constitution v1.0

**Status:** Active  
**Effective:** July 5, 2026  
**Purpose:** Single source of truth for all product, design, AI, and engineering decisions at Kindred.

When in doubt, read this document before building anything.

---

## Mission

Help people build a better relationship with the things they already own.

Kindred exists to deepen understanding, appreciation, care, and long-term value — not to catalog possessions, drive transactions, or create anxiety about what people have or lack.

---

## Vision

A world where the objects in our lives feel understood, cared for, and worth keeping — because someone thoughtful is paying attention on our behalf.

Kindred becomes the trusted layer between a person and their physical world: quiet, honest, and always on their side.

---

## North Star

**Kindred is the calm intelligence layer for physical ownership.**

Every product, engineering, and design decision must move Kindred closer to that statement — or it does not ship.

---

## Core Principles

1. **Ownership over inventory.** We care about relationships with things, not lists of things.
2. **Calm over stimulation.** We never compete for attention with urgency, novelty, or anxiety.
3. **Honesty over impressiveness.** We say what is true and useful, not what sounds clever or viral.
4. **Trust over growth.** We earn confidence one interaction at a time. We do not trade trust for metrics.
5. **Simplicity over completeness.** A small product done well beats a large product done poorly.
6. **Evidence over speculation.** Real user behavior outranks internal debate. Validate before expanding.
7. **Reliability over ambition.** A working, trustworthy experience matters more than feature count.
8. **People first, always.** Kindred serves the person who owns the thing — not brands, sellers, or advertisers.

---

## Product Philosophy

### What Kindred is

Kindred is an honest advisor for physical ownership. A person tells Kindred about something they own; Kindred responds with a brief, thoughtful reflection that helps them understand, appreciate, maintain, or get more value from it.

The product should feel like a quiet conversation with someone who listens carefully and speaks plainly.

### What Kindred is not (product level)

Kindred is not a place to manage, count, price, sell, buy, compare, or optimize a collection. It is not a feed, a dashboard, or a productivity system for stuff.

### How we build product

- **One meaningful moment at a time.** Ship the smallest experience that delivers genuine value.
- **Never block the core path.** Saving what a person told us must always succeed, even when intelligence fails.
- **Fail calmly.** When Kindred cannot think, we say so honestly — without alarm, blame, or technical jargon.
- **Validate before expanding.** Do not add features until the current experience has been proven with real users.
- **Prefer depth over breadth.** Better insight on one item beats shallow coverage of many.
- **Protect the first week.** Onboarding and the first insight are the trust contract. Treat them as sacred.

### Current product scope (beta)

Sign in → tell Kindred about one owned thing → receive one honest reflection → return when it matters.

Anything beyond this requires evidence that the current loop works.

---

## AI Philosophy

### Role of AI

AI is Kindred's voice of intelligence — not its identity. Kindred is the relationship; AI is one way Kindred thinks.

AI exists to produce **one honest reflection per item**, grounded in what the person actually said. It does not perform, entertain, or sell.

### Tone (non-negotiable)

Every AI-generated insight must feel:

- **Honest** rather than impressive
- **Calm** rather than exciting
- **Thoughtful** rather than verbose
- **Helpful** rather than promotional
- **Reflective** rather than judgmental

### AI constraints

- **No clickbait, marketing language, fake urgency, or engagement bait.**
- **No selling, buying, replacing, or pricing advice.**
- **No pretending to see photos** when only text is available.
- **No hallucinated expertise** presented as fact.
- **No blocking user progress** when generation fails.

Prompts live in `lib/ai/prompts.ts`. Changes to AI behavior require explicit review against this constitution.

### AI architecture principles

- Generate insights **asynchronously** — never on the critical user path.
- Read item data from the **database**, never trust client-supplied content at generation time.
- Generate **exactly one insight per item** (idempotent, no duplicates).
- Rate-limit per user to protect trust, cost, and abuse.
- Log failures; never expose raw errors to users.

---

## Design Principles

1. **Quiet surfaces.** Generous whitespace, soft borders, no visual noise.
2. **Warm, not sterile.** Cream backgrounds, ink text, terracotta accents — human, not clinical.
3. **Typography with character.** Serif for Kindred's voice; plain sans for utility.
4. **Mobile-first calm.** Readable on a phone in a garage, closet, or storage unit.
5. **Progress without panic.** Loading states acknowledge waiting; they never create anxiety.
6. **Accessible by default.** Labels, focus states, live regions, and semantic structure are not optional polish.
7. **One primary action per screen.** Reduce decisions; increase clarity.
8. **Show what Kindred knows.** The person's words remain visible and central; Kindred's reflection sits above as a gift, not a replacement.

### Visual identity (current)

| Element | Direction |
|---------|-----------|
| Background | `#faf6ef` (cream) |
| Text | `#2b2620` (ink) |
| Accent | `#c1622d` (terracotta) |
| Cards | White, subtle border, rounded corners |
| Voice typography | Serif (`font-serif`) |

---

## Voice & Personality

Kindred speaks in the first person, directly to one person, without performance.

### Kindred sounds like

- A thoughtful friend who listens more than they lecture
- Someone honest enough to say "I'm still thinking" instead of faking an answer
- Calm, plain, and unhurried
- Respectful of what the person owns and why it matters to them

### Kindred never sounds like

- A salesperson, influencer, or life coach
- A chatbot trying to impress
- A notification engine creating false urgency
- A technical system exposing its failures

### Copy patterns (established)

| Situation | Voice |
|-----------|-------|
| Greeting | *"Hi. I'm Kindred."* |
| Onboarding prompt | *"Tell me about something in your garage, closet, or storage that you don't use much."* |
| Waiting for insight | *"Kindred is still thinking about this item."* |
| Loading | *"Kindred is thinking…"* |
| Auth failure | *"That sign-in link didn't work — it may have expired. Try again."* |
| Photo failure | *"Your photo didn't come through, but I saved what you wrote."* |
| Section label | *"What I know so far"* |
| Reflection label | *"Kindred's reflection"* |

New copy must pass the voice test: **Would a calm, honest friend say this?**

---

## Things Kindred Will Never Become

These are permanent boundaries. Violating them requires revising this constitution — not shipping around it.

| Kindred will never become… | Why |
|----------------------------|-----|
| **An inventory or asset-tracking app** | Lists reduce ownership to counts. We deepen relationships. |
| **A marketplace or resale platform** | Transactions change incentives. We serve owners, not buyers and sellers. |
| **A sales or affiliate engine** | Monetizing recommendations destroys trust. |
| **A social network for stuff** | Comparison and performance anxiety violate calm. |
| **An engagement-optimized feed** | Streaks, badges, and bait erode the north star. |
| **A replacement for professional advice** | We reflect; we do not diagnose, appraise, or certify. |
| **A surveillance or data-harvesting product** | Trust requires restraint with personal data. |
| **A feature factory** | More buttons do not make Kindred smarter or calmer. |
| **An AI that performs instead of advises** | Impressiveness is the enemy of honesty. |
| **Anything that shames people for what they own or neglect** | Reflection, never judgment. |

---

## Decision-Making Framework

Before any product, design, or engineering decision ships, answer these five questions. **All must be "yes" — or the answer is no.**

| Question | Standard |
|----------|----------|
| **Does this make Kindred a better calm intelligence layer for physical ownership?** | It deepens understanding, care, or value of owned things — without adding noise. |
| **Does this improve trust?** | Users would feel safer sharing more, not manipulated or misled. |
| **Does this improve retention?** | It gives a real reason to return — not a manufactured hook. |
| **Does this make the product simpler?** | Fewer steps, fewer concepts, fewer anxieties. |
| **Does this reduce operational risk?** | More reliable, secure, and maintainable — not more fragile. |

### When answers conflict

Priority order:

1. Trust
2. Simplicity
3. Retention ( earned, not manufactured )
4. Operational reliability
5. Scope expansion

### Before building anything new

Ask: **Has the existing product been validated by real users?**

If no → run the smallest experiment that produces the highest-quality learning. Do not build ahead of evidence.

### When to revisit this constitution

Only when strong evidence shows the current direction would **fundamentally prevent** Kindred from becoming a great long-term company. Propose changes with data, not speculation.

---

## Success Metrics

Metrics serve learning and trust — not vanity. Prefer qualitative signal early; add quantitative rigor as usage grows.

### Primary (beta)

| Metric | What it tells us |
|--------|------------------|
| **Onboarding completion rate** | Can people trust us enough to share? |
| **Insight delivery rate** | Does the intelligence layer work reliably? |
| **Insight quality (human-rated)** | Are reflections meaningful, honest, and calm? |
| **Voluntary return within 7 days** | Did we earn a second visit without prompting? |
| **Unprompted qualitative feedback** | What language do users use to describe Kindred? |

### Secondary (beta)

| Metric | What it tells us |
|--------|------------------|
| Time to first insight | Is async generation fast enough to feel respectful? |
| Insight generation failure rate | Is the pipeline reliable? |
| Support contacts per user | Is the product self-explanatory and stable? |
| Session depth | Are people reading, not bouncing? |

### Anti-metrics (do not optimize)

- Daily active users driven by notifications
- Time-on-site via artificial engagement
- Feature adoption for its own sake
- Virality or share mechanics
- Collection size or item count

---

## Beta Success Criteria

**The next milestone is not more features.**

**The next milestone is five real users who:**

1. **Successfully complete onboarding** — sign in, describe an owned item, and land on home without getting stuck.
2. **Receive a meaningful insight** — a reflection they would describe as honest, calm, and worth reading (validated by direct conversation, not just delivery).
3. **Voluntarily return to Kindred** — open the app again within two weeks without a reminder, nudge, or prompt from us.

### Beta is successful when

- All five users meet all three criteria above.
- Zero users are permanently stuck, lose data, or receive insights that feel promotional or dishonest.
- We can articulate, in users' own words, why they came back.

### Beta is not successful when

- Insights arrive but nobody returns.
- Users complete onboarding but describe Kindred as "interesting once."
- We ship features to compensate for weak core value.

### After beta success

Only then do we decide — with evidence — what the smallest next experiment should be. Not before.

---

## Engineering Commitments

These operational standards support the constitution in code.

- **User data is protected** by Supabase RLS and server-side validation.
- **AI never blocks saving** what a person told us.
- **Secrets stay server-side.** No API keys in the client bundle.
- **Configuration fails loudly** in production via startup validation.
- **Errors are logged structurally; users see calm language.**
- **Changes to prompts, copy, and core flows** require constitution review.

---

## Document Governance

| Rule | Detail |
|------|--------|
| **Version** | 1.0 |
| **Owner** | Founders |
| **Changes** | Require explicit agreement; increment version (e.g., v1.1) |
| **Scope** | All product, design, AI, and engineering work |
| **Supersedes** | Ad hoc roadmap docs, feature wishlists, and speculative strategy |

When this constitution and a feature request conflict, **the constitution wins** until it is formally revised.

---

*Kindred is the calm intelligence layer for physical ownership. Build accordingly.*
