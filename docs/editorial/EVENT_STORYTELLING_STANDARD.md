# Event Storytelling Standard (Version 1)

**Status:** Active — editorial quality law for Local Events  
**Effective:** July 16, 2026

Verification and anti-template rules are working. This standard governs **editorial quality**.

Kindred is **NOT** an event directory. It is a **newspaper**. Every event should feel like it was personally selected and written by an editor.

---

## Before writing

Before writing a single sentence, determine what type of event this is.

Examples: Concert · Festival · Farmers Market · Art Exhibition · Museum Event · Theater Performance · Author Talk · Community Gathering · Outdoor Recreation · Food & Drink · Workshop / Class · Sports · Family Event · Seasonal Event

**Do not use one writing style for every category.**

A concert should read differently than an art show. A farmers market should read differently than a book signing.

---

## Summarize the experience

Do not simply restate the listing.

Read the verified event data and explain:

- What is actually happening
- Why someone would attend
- What makes this event unique
- What visitors should expect

Every sentence must come from verified information.

Never invent. Never exaggerate. Never speculate.

---

## No template writing

Permanently banned phrases include:

- Worth stepping out for...
- This is the kind of plan...
- Show up with curiosity...
- Looking for something different?
- Don't miss...
- Mark your calendar...
- Gather your friends...
- Perfect way to spend...

No rotating templates. No canned introductions. No filler.

Every article must begin naturally based on that specific event.

---

## The golden test

Hide the event title. Read only the article.

Ask: **"Could this article describe ONLY this event?"**

If the answer is no — rewrite it.

---

## Write about the event

**Instead of:** "An event is happening Friday night."

**Write:** "The Queen Creek Olive Mill is hosting an evening watercolor workshop where guests paint a desert-inspired landscape while enjoying a seasonal spritz."

Instead of repeating logistics — describe the actual experience.

---

## Make every event feel different

Vary sentence length, paragraph structure, openings, vocabulary, and pacing.

Readers should never feel like they are reading the same article with different names inserted.

---

## Trust above everything

If verified information is missing — say less.

Never fill empty space with guesses. Never assume.

Accuracy is always more important than length.

---

## Final editorial check

Before publishing every event ask:

1. Does this sound like a real newspaper article?
2. Is every sentence supported by verified information?
3. Does this article accurately describe THIS event?
4. Could this article be mistaken for another event?
5. Would I proudly publish this for my own family to rely on?

If any answer is **NO** — rewrite before publishing.

---

Kindred wins through trust, clarity, and thoughtful editorial writing — not volume. Every event should feel unique, useful, and worth reading.

---

## Enforcement

| Layer | File |
| --- | --- |
| Cursor rule | `.cursor/rules/kindred-event-storytelling.mdc` |
| Story type + golden test | `lib/edition/eventStorytelling.ts` |
| AI generation | `supabase/functions/_shared/localEvents/banditNotes.ts` |
| Validation | `supabase/functions/_shared/localEvents/eventEditorial.ts` |
