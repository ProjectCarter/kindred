/**
 * Kindred Editorial Standards — universal constitution for every article Kindred publishes.
 * Shared by Story Editor, section writers, history, masterpiece, events, and cursor rules.
 */

import {
  DISCOVERY_SCORE_BANDS,
  KINDRED_REACTIONS,
} from "./editorialStandard.ts";

/**
 * Discovery-desk editorial digest — derived from the shared Phase 0 constants
 * so band numbers and reactions never drift from code. Exposed through the
 * prompt-digest pipeline (see supabase/functions/_shared/editorialStyle.ts) so
 * it is available to every prompt builder. It is intentionally NOT yet folded
 * into the live NEWSPAPER_STYLE_RULES prompt string, so no generated content
 * changes at this phase.
 */
export const KINDRED_EDITORIAL_STANDARD_DIGEST = `
KINDRED EDITORIAL STANDARD (discovery desks — permanent law):

The Kindred Test — before anything is published, ask: "If I showed this to
someone over breakfast, would they be excited they discovered it today?"
If the answer is no, it should probably not appear.

Every recommendation should provoke at least one genuine reaction:
"I want to go," "I want to eat there," "I want to do that," or
"I'm glad I learned that." (${Object.keys(KINDRED_REACTIONS).length} reactions)

Editorial priorities: discovery over popularity · local over generic ·
interesting over ordinary · timely over stale · community over commercial ·
quality over quantity.

Discovery Score (0–100): ${DISCOVERY_SCORE_BANDS.feature}+ exceptional, feature it · ${DISCOVERY_SCORE_BANDS.strong}+ strong · ${DISCOVERY_SCORE_BANDS.acceptable}+ acceptable · below ${DISCOVERY_SCORE_BANDS.acceptable} do not publish unless exceptional.
`.trim();

/** Compact enforceable digest for AI prompts and engineering gates. */
export const KINDRED_EDITORIAL_STANDARDS_DIGEST = `
KINDRED EDITORIAL STANDARDS (every article, every desk — permanent law):

Kindred is not trying to generate content. Kindred is trying to edit a newspaper.
Every article should feel as if it passed through an experienced newspaper editor.

1. LEAD WITH THE NEWS
First paragraph immediately tells the reader what happened.
Never waste the opening repeating the headline.

2. ANSWER THE READER'S QUESTIONS
While writing, constantly answer: What happened? Why does it matter? Who is involved?
Why should I care? What happens next?

3. BUILD UNDERSTANDING
If readers may not know the topic, explain it in everyday language.
Sports: position, roster stakes, how training camp works.
Business: what the company does, local importance.
Government: what is being decided, what changes if it passes.
Science: concepts in plain language. History: verified context.
Never assume prior knowledge.

4. CONTEXT IS ENCOURAGED — FABRICATION IS FORBIDDEN
Background is welcome when factual, widely established, and clearly separated from reported facts.
Never invent: quotes · timelines · statistics · interviews · eyewitness accounts · motives ·
reactions · future outcomes · story-specific details · unreported causes.

5. WRITE LIKE A NEWSPAPER
Not AI. Not a blog. Not marketing. Not Wikipedia.
Calm, confident, professional journalism.

6. RESPECT UNCERTAINTY
If something is unknown, say it is unknown. Never fill gaps with guesses.

7. EVERY PARAGRAPH EARNS ITS PLACE
No filler. No repeated ideas. No rewording the same sentence.
Every paragraph teaches the reader something new.

8. LOCAL RELEVANCE
Answer: "Why does this matter to someone reading today's Kindred edition?"

9. EDITORIAL HIERARCHY
Readers finish knowing: what happened · why it matters · important background ·
what comes next (only if supported by reporting).

10. TRUST OVER LENGTH
Three paragraphs of verified information beat eight paragraphs padded with speculation.

11. READER TEST
If this appeared in tomorrow morning's newspaper, would readers trust it?
If no — regenerate.

12. KINDRED STANDARD
Our goal is not to write more. Our goal is to write better.
Leave the reader informed, educated, and confident every fact is authentic.

ARTICLE CRAFT (headline through closing):
• Strong, specific headline — never generic or clickbait.
• One-sentence subheadline on why the story matters.
• Opening answers what happened, why the reader should care, and why it is interesting.
• Rich body: logical flow, no filler, no AI-style wording, useful verified context.
• Natural ending with a meaningful takeaway — never "In conclusion", "Overall", or recap wrap-ups.
• The Kindred Test: would a first-time reader trust this morning's paper?
`.trim();

/** Pre-publication questions — Story Editor and human review. */
export const KINDRED_PUBLICATION_QUESTIONS = [
  "If this appeared in tomorrow morning's newspaper, would readers trust it?",
  "Does the first paragraph lead with the news — not repeat the headline?",
  "What happened, and why does it matter to today's reader?",
  "Who is involved, and what should I watch for next (only if reporting supports it)?",
  "Does every paragraph teach something new?",
  "Is verified background clearly separated from reported facts?",
  "Did we invent anything — quotes, stats, motives, reactions, or future outcomes?",
  "If something is unknown, did we say so instead of guessing?",
  "Would an experienced newspaper editor recognize this as responsible reporting?",
  "The Kindred Test: would a first-time reader trust this morning's paper immediately?",
] as const;

/** @deprecated Use KINDRED_EDITORIAL_STANDARDS_DIGEST — kept for imports during migration. */
export const NEWSPAPER_TRUTH_DIGEST = KINDRED_EDITORIAL_STANDARDS_DIGEST;
