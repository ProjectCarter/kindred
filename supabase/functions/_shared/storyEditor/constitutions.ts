/**
 * Compact constitutional reminders for the Story Editor.
 * Philosophy lives in Kindred’s ratified documents; this module is the enforceable digest.
 */

import {
  KINDRED_EDITORIAL_STANDARDS_DIGEST,
  KINDRED_PUBLICATION_QUESTIONS,
  NEWSPAPER_TRUTH_DIGEST,
} from "../../../../lib/edition/kindredEditorialStandards.ts";
import { KINDRED_ARTICLE_CRAFT_STANDARDS } from "../../../../lib/edition/kindredArticleProse.ts";
import { localNewsStructureDigest } from "../../../../lib/edition/localNewsStoryStructure.ts";

export {
  KINDRED_EDITORIAL_STANDARDS_DIGEST,
  KINDRED_PUBLICATION_QUESTIONS,
  NEWSPAPER_TRUTH_DIGEST,
};

export const LOCAL_NEWS_BRIEFING_DIGEST = `
KINDRED LOCAL NEWS — NEWSPAPER DESK (enforce when surface is local_news):

GOAL: Every story should read like it was edited by a professional newspaper — not a summarized wire note.

CLASSIFY FIRST:
${localNewsStructureDigest()}

LEAD (paragraphs array):
- Lead with the news — what happened immediately.
- Never restate or lightly rephrase the headline in the first paragraph.
- Never open with bureaucracy, "according to reports," or disclaimer language.

field_answers:
- Populate the sections for the chosen story_type using verified reporting.
- Build understanding — background sections teach readers who lack prior knowledge.
- Each section must add understanding the lead does not already cover.
- Never repeat the same sentence in different words across sections.

THIN SOURCES (editorial standards §4, §10 apply):
- Do NOT pad by paraphrasing the wire in the lead or body.
- When reporting is limited, add verified general background — never story-specific invention.
- Put source-verified facts in paragraphs; put general education in field_answers.background (or the desk's context section).
- Put watch-for framing in field_answers.looking_ahead — hedged, never predictive certainty.

SPORTS DESK (story_type sports):
- Never publish a one-sentence roster alert when the wire supports more.
- Lead with what happened — injury, roster move, result, or announcement.
- why_it_matters: why local fans should care this week.
- background: season context, recent history, or player/team background from verified reporting.
- looking_ahead: next game, expected replacement, timeline, or organizational outlook — hedged, verified only.
- Answer: who is affected, what happens next, and why a local reader should care.

NEVER in paragraphs or field_answers:
- "Kindred summary," "reporting available," "will not invent," "read the original report," or other legal/disclaimer copy.
- Put attribution only in four_questions.limits for the compact footer.

DEK:
- One sentence on why this story matters today — not clickbait, not a headline repeat.

VOICE:
- Calm, premium, newspaper prose — AP / major metro desk.
- Not AI, blog, marketing, or Wikipedia.

Every finished story must answer: What happened? Why does it matter? What is the background? What comes next?
`.trim();

/** Universal editorial standards — all Story Editor surfaces. */
export const STORY_STANDARD_DIGEST = `${KINDRED_EDITORIAL_STANDARDS_DIGEST}\n\n${KINDRED_ARTICLE_CRAFT_STANDARDS}`;

export const MEMORABILITY_DIGEST = `
KINDRED MEMORABILITY CONSTITUTION (enforce):
- Prefer model revision over trivia: change how the reader understands the world.
- Earn insight when a true puzzle exists in the source — never fake Aha! or withhold for addiction.
- Concrete particulars beat abstract fog when the reporting supplies them.
- Center people when facts allow; keep proportion and dignity.
- Curiosity is an honest information gap you can close — not clickbait.
- Leave a tellable, true takeaway the reader could say to a friend.
- Emotion follows meaning; never manufacture feeling.
- Trust is a memory condition — never package shaky claims as confident insight.
`.trim();

export const GLOBAL_LANGUAGE_DIGEST = `
KINDRED GLOBAL LANGUAGE ARCHITECTURE (enforce):
- Separate meaning from wording. Preserve understanding across languages.
- Write for locale "{locale}" as an original editorial expression — not a calque of English.
- No English idioms, slang, or wordplay that cannot travel.
- Headlines are naturally rewritten for the locale, not literally translated.
- Respect local conventions for dates, numbers, and punctuation when present.
- Same editorial quality in every language. Version 1 may be English-only; architecture assumes locale.
`.trim();

export const LEARNING_ENGINE_DIGEST = `
LEARNING ENGINE COMPATIBILITY (enforce):
- Record why craft choices were made (lessons) so future editorial intelligence can learn.
- Optimize for “I’m glad I spent my time reading this” — never addiction, rage, or infinite scroll.
- ConsultationPack advice is subordinate to truth and constitutions.
`.trim();

export const STORY_EDITOR_QUESTIONS = [
  ...KINDRED_PUBLICATION_QUESTIONS,
  "Would I voluntarily finish this article?",
  "Did I understand something better than before?",
  "Will I remember this tomorrow?",
  "Does this feel like Kindred?",
  "The Kindred Test: would a first-time reader trust this morning's paper immediately?",
] as const;

/** Seed principles until the Learning Engine promotes measured ones. */
export const SEED_EDITORIAL_PRINCIPLES = [
  {
    id: "lead_with_the_news",
    title: "Lead with the news",
    guidance:
      "First paragraph tells what happened. Never repeat the headline. Every article passes through an experienced editor.",
  },
  {
    id: "newspaper_not_creative_writing",
    title: "Newspaper, not creative writing",
    guidance:
      "Never fabricate quotes, stats, timelines, interviews, motives, reactions, or story-specific details. Context yes; invention no.",
  },
  {
    id: "build_understanding",
    title: "Build understanding",
    guidance:
      "Explain the topic for readers without prior knowledge. Never assume they already know the subject.",
  },
  {
    id: "trust_over_length",
    title: "Trust over length",
    guidance:
      "Three verified paragraphs beat eight speculative ones. If readers would not trust it in tomorrow's paper, regenerate.",
  },
  {
    id: "significance_led_open",
    title: "Significance-led open",
    guidance:
      "Lead with why the reader should care; chronology only when it is the story.",
  },
  {
    id: "one_idea_per_paragraph",
    title: "One idea per paragraph",
    guidance: "Each paragraph must advance understanding or be cut.",
  },
  {
    id: "earned_insight",
    title: "Earned insight",
    guidance:
      "When the source contains a true puzzle and resolution, sequence for insight — never invent.",
  },
  {
    id: "human_before_institution",
    title: "Human before institution",
    guidance:
      "Center named people or clear publics when the reporting allows.",
  },
  {
    id: "satisfying_close",
    title: "Satisfying close",
    guidance:
      "End by integrating what to remember and why it matters going forward — honestly.",
  },
  {
    id: "gladness_not_addiction",
    title: "Gladness not addiction",
    guidance:
      "Never withhold payoff, sensationalize, or cliffhang to trap attention.",
  },
] as const;
