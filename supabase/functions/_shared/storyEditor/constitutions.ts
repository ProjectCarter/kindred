/**
 * Compact constitutional reminders for the Story Editor.
 * Philosophy lives in Kindred’s ratified documents; this module is the enforceable digest.
 */

export const STORY_STANDARD_DIGEST = `
KINDRED STORY STANDARD (enforce):
- Answer in the prose: What happened? Why it matters? Who is affected? What should I remember?
- Opening makes significance legible immediately — not chronology, bureaucracy, or dates-first.
- One new idea per paragraph; cut filler and repetition.
- Plain, intelligent language. Never sensationalize. Never AI tells. Never press-release voice.
- End with one memorable, accurate takeaway — not a CTA, not an abrupt stop.
- Thin sources stay thin and honest — never invent depth.
- Truth and understanding outrank brevity theater and engagement tricks.
`.trim();

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
  "Would I voluntarily finish this article?",
  "Did I understand something better than before?",
  "Will I remember this tomorrow?",
  "Does every paragraph earn its place?",
  "Does this feel like Kindred?",
] as const;

/** Seed principles until the Learning Engine promotes measured ones. */
export const SEED_EDITORIAL_PRINCIPLES = [
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
