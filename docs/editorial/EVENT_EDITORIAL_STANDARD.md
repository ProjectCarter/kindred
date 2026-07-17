# Kindred Event Editorial Standard

**Status:** Active — permanent editorial law for Local Events  
**Effective:** July 16, 2026

Kindred is not a directory of events. It is a newspaper. Every event should
feel like it was personally selected, researched, and written by an editor —
not generated from a template.

**Trust always comes before speed.**

---

## No template writing

Every event article must be written from scratch.

Never reuse:

- Opening paragraphs
- Bandit's Note wording
- Closing paragraphs
- Advice sections
- Transitions
- Generic lifestyle copy

If two different event articles can swap their opening paragraphs without
anyone noticing, they both fail.

Every article must have its own personality.

---

## First understand the event

Before writing a single sentence, determine:

- What is actually happening?
- Why are people attending?
- Who is it for?
- What makes it different from every other event?
- What details make it worth mentioning?

Do not start writing until the event has been understood.

---

## Write a true editorial summary

Do **not** rewrite the event listing.  
Do **not** copy the organizer.  
Do **not** paraphrase sentence-by-sentence.

Instead:

1. Read the complete event.
2. Understand it.
3. Explain it naturally in Kindred's own editorial voice.

The reader should immediately understand:

- what the event is
- why someone would go
- what makes it interesting
- what to expect

Never invent information.  
Never exaggerate.  
Never speculate.  
Never guess.

If something is unknown, leave it out.

---

## Bandit's Note

Bandit's Note should feel handwritten every day.

Never reuse phrases like:

- "Worth stepping out for..."
- "This is the kind of plan..."
- "Show up with curiosity..."
- "Perfect evening..."
- "Hidden gem..."
- "Something for everyone..."

Instead, Bandit's Note should react naturally to **that** specific event.

**Examples:**

- "If you've been meaning to visit Queen Creek Olive Mill, this class is a fun excuse."
- "Outdoor movies are one of the best parts of summer."
- "Changing Hands always hosts interesting conversations."
- "This looks perfect if you're looking for something quieter than a concert."

Every note should sound unique.

---

## The body

Every article should answer:

- What is happening?
- Who is hosting it?
- What will visitors experience?
- Are there activities?
- Are there demonstrations?
- Are there performances?
- Is there food?
- Is there live music?
- Is there something unique about this event?

Only include information that can be verified.

Never add filler.  
Never repeat yourself.

Every paragraph should introduce new information.

---

## The golden test

Before publishing, ask:

**"If I removed the title, could this article still only describe THIS event?"**

If the answer is **NO**, rewrite it.

---

## The Kindred promise

Our readers trust us with their time.

Every recommendation should feel personal.  
Every article should feel researched.  
Every event should sound different because every event **is** different.

Quality always beats quantity.

Never publish generic writing.  
Never publish template writing.

Publish only thoughtful, accurate, original editorial summaries written in
Kindred's own voice.

---

## Enforcement

| Layer | File |
| --- | --- |
| Cursor rule | `.cursor/rules/kindred-event-editorial.mdc` |
| Bandit notes | `supabase/functions/_shared/localEvents/banditNotes.ts` |
| Event articles | `lib/edition/article.ts` (`articleFromLocalEvent`) |
| Schedule trust | `localEvents/eventDateVerification.ts` |
| Discovery pipeline | `localEvents/pipeline.ts` |
