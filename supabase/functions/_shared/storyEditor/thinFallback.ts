/**
 * Thin-honest fallback — truth without invented magazine depth.
 */

import type { StoryEditorIntake, StoryEditorResult, StoryEditorScores } from "./types.ts";
import { wordCount } from "./validators.ts";

const ZERO_SCORES: StoryEditorScores = {
  interest: 0,
  curiosity: 0,
  flow: 0,
  human_connection: 0,
  learning: 0,
  memorability: 0,
  reader_satisfaction: 0,
};

function cleanHeadline(title: string): string {
  return title.replace(/\s+[—–|-]\s+[^—–|-]+$/, "").trim();
}

export function composeThinHonest(
  intake: StoryEditorIntake,
  reason: string
): StoryEditorResult {
  const headline = cleanHeadline(intake.headline);
  const source = (intake.sourceText || headline).replace(/\s+/g, " ").trim();
  const paragraphs: string[] = [];

  if (source && source !== headline) {
    // First graf: significance from available text — no invention.
    const first = source.length > 280 ? `${source.slice(0, 277).trim()}…` : source;
    paragraphs.push(first);
  } else {
    paragraphs.push(
      `${headline} — Kindred has only a brief note from ${intake.source || "the wires"}.`
    );
  }

  paragraphs.push(
    "That is the full wire note available to the desk. " +
      "For the complete report, open the original source — Kindred will not invent what was not reported."
  );

  const bodyText = paragraphs.join("\n\n");
  const modest: StoryEditorScores = {
    interest: 3,
    curiosity: 3,
    flow: 4,
    human_connection: 3,
    learning: 3,
    memorability: 3,
    reader_satisfaction: 4,
  };

  return {
    headline,
    dek: null,
    paragraphs,
    bodyText,
    pullQuote: null,
    ok: true,
    desk: {
      version: 1,
      path: "thin_honest",
      locale: intake.locale ?? "en",
      scores: wordCount(intake.sourceText) < 20 ? modest : modest,
      voluntaryFinish: true,
      memorableInsight:
        "Kindred stayed honest about a thin wire rather than inventing depth.",
      passes: 0,
      lessons: [
        {
          changeType: "clarity",
          rationale: reason,
          principleIds: ["gladness_not_addiction"],
        },
      ],
      constitutions: {
        storyStandard: true,
        memorability: true,
        globalLanguage: true,
        learningReady: true,
      },
      fourQuestions: {
        what: headline,
        why: "The wire note is short — the full report lives with the publisher.",
        who: "Readers following this thread",
        remember:
          "When the wire is thin, Kindred tells you plainly rather than padding.",
        limits: ["Full detail lives with the publisher source."],
      },
      editedAt: new Date().toISOString(),
    },
  };
}

export function composeWireFallback(intake: StoryEditorIntake): StoryEditorResult {
  const headline = cleanHeadline(intake.headline);
  const text = (intake.sourceText || headline).replace(/\s+/g, " ").trim();
  const paragraphs = text ? [text] : [headline];
  return {
    headline,
    dek: null,
    paragraphs,
    bodyText: paragraphs.join("\n\n"),
    pullQuote: null,
    ok: false,
    desk: {
      version: 1,
      path: "fallback_wire",
      locale: intake.locale ?? "en",
      scores: ZERO_SCORES,
      voluntaryFinish: false,
      memorableInsight: null,
      passes: 0,
      lessons: [],
      constitutions: {
        storyStandard: false,
        memorability: false,
        globalLanguage: true,
        learningReady: false,
      },
      fourQuestions: {
        what: headline,
        why: "",
        who: "",
        remember: "",
        limits: ["Story Editor unavailable — wire text preserved."],
      },
      editedAt: new Date().toISOString(),
    },
  };
}
