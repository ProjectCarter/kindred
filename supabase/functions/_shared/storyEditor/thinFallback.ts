/**
 * Thin-honest fallback — truth without invented magazine depth.
 */

import type { StoryEditorIntake, StoryEditorResult, StoryEditorScores } from "./types.ts";
import { proseNearDuplicate, wordCount } from "./validators.ts";

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

function verifiedSourceBody(intake: StoryEditorIntake): string {
  return (intake.sourceText || "").replace(/\s+/g, " ").trim();
}

function splitVerifiedBriefing(
  headline: string,
  sourceBody: string
): { dek: string | null; lead: string | null } {
  const trimmed = sourceBody.replace(/\s+/g, " ").trim();
  if (!trimmed || proseNearDuplicate(trimmed, headline)) {
    return { dek: null, lead: null };
  }

  const afterMatch = trimmed.match(/^(.*?)\bafter\b(.+)$/i);
  if (afterMatch) {
    const first = afterMatch[1].replace(/[,.;!?]+$/, "").trim();
    const second = afterMatch[2].replace(/^[,\s]+/, "").replace(/[.!?]+$/, "").trim();
    if (first.length >= 20 && second.length >= 8 && !proseNearDuplicate(first, headline)) {
      const dek = first.endsWith(".") ? first : `${first}.`;
      const lead = `${second.charAt(0).toUpperCase()}${second.slice(1)}.`;
      if (!proseNearDuplicate(dek, lead) && !proseNearDuplicate(lead, headline)) {
        return { dek, lead };
      }
    }
  }

  const withMatch = trimmed.match(/^(.*?)\bwith\b(.+)$/i);
  if (withMatch) {
    const first = withMatch[1].replace(/[,.;!?]+$/, "").trim();
    const second = withMatch[2].replace(/^[,\s]+/, "").replace(/[.!?]+$/, "").trim();
    if (first.length >= 20 && second.length >= 8 && !proseNearDuplicate(first, headline)) {
      const dek = first.endsWith(".") ? first : `${first}.`;
      const lead = `${second.charAt(0).toUpperCase()}${second.slice(1)}.`;
      if (!proseNearDuplicate(dek, lead) && !proseNearDuplicate(lead, headline)) {
        return { dek, lead };
      }
    }
  }

  return { dek: null, lead: null };
}

function buildDistinctDek(headline: string, sourceBody: string): string | null {
  const split = splitVerifiedBriefing(headline, sourceBody);
  if (split.dek) return split.dek;
  if (!sourceBody || proseNearDuplicate(sourceBody, headline)) return null;
  const sentence = sourceBody.split(/(?<=[.!?])\s+/)[0]?.trim() || sourceBody;
  const candidate = sentence.length <= 180 ? sentence : `${sentence.slice(0, 177).trim()}…`;
  if (candidate && !proseNearDuplicate(candidate, headline)) {
    return candidate.endsWith(".") ? candidate : `${candidate}.`;
  }
  return null;
}

function buildVerifiedLead(headline: string, sourceBody: string): string | null {
  const split = splitVerifiedBriefing(headline, sourceBody);
  if (split.lead) return split.lead;
  if (!sourceBody || proseNearDuplicate(sourceBody, headline)) return null;
  const lead = sourceBody.length <= 320 ? sourceBody : `${sourceBody.slice(0, 317).trim()}…`;
  if (!lead || proseNearDuplicate(lead, headline)) return null;
  return lead.endsWith(".") ? lead : `${lead}.`;
}

function stableBackgroundParagraph(
  intake: StoryEditorIntake
): string | null {
  const hay = `${intake.headline} ${intake.sourceText}`.toLowerCase();
  if (/\b(training camp|roster|preseason|regular season)\b/.test(hay)) {
    return "Training camp is when teams evaluate players and shape rosters before the regular season begins.";
  }
  if (/\b(city council|town council|zoning|bond measure)\b/.test(hay)) {
    return "Local councils vote on policies and budgets that shape everyday life in a community.";
  }
  if (/\b(weather warning|heat advisory|flood warning|storm watch)\b/.test(hay)) {
    return "Weather advisories are issued when conditions may affect travel, safety, or outdoor plans.";
  }
  return null;
}

export function composeLocalNewsUnavailable(
  intake: StoryEditorIntake,
  reason: string
): StoryEditorResult {
  const headline = cleanHeadline(intake.headline);
  return {
    headline,
    dek: null,
    paragraphs: [],
    bodyText: "",
    pullQuote: null,
    ok: false,
    desk: {
      version: 1,
      path: "unavailable",
      locale: intake.locale ?? "en",
      scores: ZERO_SCORES,
      voluntaryFinish: false,
      memorableInsight: null,
      passes: 0,
      lessons: [
        {
          changeType: "clarity",
          rationale: reason,
          principleIds: ["gladness_not_addiction"],
        },
      ],
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
        limits: ["Insufficient verified source material for a Local News briefing."],
      },
      storyType: "general",
      editedAt: new Date().toISOString(),
    },
  };
}

export function composeThinHonest(
  intake: StoryEditorIntake,
  reason: string
): StoryEditorResult {
  const headline = cleanHeadline(intake.headline);
  const source = verifiedSourceBody(intake) || headline;
  const paragraphs: string[] = [];

  if (source && source !== headline) {
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

export function composeLocalNewsThinHonest(
  intake: StoryEditorIntake,
  reason: string
): StoryEditorResult {
  const headline = cleanHeadline(intake.headline);
  const publisher = intake.source?.trim() || "the original publisher";
  const sourceBody = verifiedSourceBody(intake);

  if (!sourceBody || proseNearDuplicate(sourceBody, headline)) {
    return composeLocalNewsUnavailable(
      intake,
      `${reason} — title-only wire cannot become a Local News briefing.`
    );
  }

  const dek = buildDistinctDek(headline, sourceBody);
  const lead = buildVerifiedLead(headline, sourceBody);
  if (!dek || !lead) {
    return composeLocalNewsUnavailable(
      intake,
      `${reason} — verified source could not produce distinct dek and lead.`
    );
  }

  const paragraphs = [lead];
  const background = stableBackgroundParagraph(intake);
  if (
    background &&
    !proseNearDuplicate(background, lead) &&
    !proseNearDuplicate(background, dek) &&
    !proseNearDuplicate(background, headline)
  ) {
    paragraphs.push(background);
  }

  const bodyText = paragraphs.join("\n\n");
  if (
    proseNearDuplicate(bodyText, headline) ||
    proseNearDuplicate(dek, headline) ||
    proseNearDuplicate(dek, lead)
  ) {
    return composeLocalNewsUnavailable(
      intake,
      `${reason} — briefing would repeat the headline without invention.`
    );
  }

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
    dek,
    paragraphs,
    bodyText,
    pullQuote: null,
    ok: true,
    desk: {
      version: 1,
      path: "thin_honest",
      locale: intake.locale ?? "en",
      scores: modest,
      voluntaryFinish: true,
      memorableInsight:
        "Kindred published a compact Local News briefing from verified wire material.",
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
        why: "",
        who: "",
        remember: "",
        limits: [
          `Source: ${publisher}. Kindred summary — read the original for the full report.`,
        ],
      },
      fieldAnswers: {
        verified_facts: lead,
      },
      storyType: "general",
      editedAt: new Date().toISOString(),
    },
  };
}

export function composeWireFallback(intake: StoryEditorIntake): StoryEditorResult {
  const headline = cleanHeadline(intake.headline);
  const text = verifiedSourceBody(intake) || headline;
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
