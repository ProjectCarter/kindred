/**
 * Kindred Story Editor — reusable pre-publication service.
 * Heart of the newsroom: truthful reporting → exceptional reading.
 */

import { buildConsultationPack } from "./consultation.ts";
import {
  allScoresAreFive,
  isThinSource,
  validateStoryDraft,
  type ValidationIssue,
} from "./validators.ts";
import { composeThinHonest, composeWireFallback, composeLocalNewsThinHonest } from "./thinFallback.ts";
import {
  STORY_EDITOR_MAX_PASSES,
  type StoryEditorIntake,
  type StoryEditorLesson,
  type StoryEditorResult,
  type StoryEditorScores,
} from "./types.ts";
import { storyEditorSystemPrompt, storyEditorUserPrompt } from "./voice.ts";

type ModelDraft = {
  voluntary_finish?: boolean;
  headline?: string;
  dek?: string | null;
  paragraphs?: string[];
  pull_quote?: string | null;
  scores?: Partial<StoryEditorScores>;
  memorable_insight?: string | null;
  four_questions?: {
    what?: string;
    why?: string;
    who?: string;
    remember?: string;
    limits?: string[];
  };
  lessons?: Array<{
    changeType?: string;
    rationale?: string;
    principleIds?: string[];
  }>;
  notes?: string[];
};

function parseDraft(text: string): ModelDraft | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as ModelDraft;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as ModelDraft;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function asScores(raw: Partial<StoryEditorScores> | undefined): StoryEditorScores {
  const n = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.min(5, Math.round(v)))
      : 0;
  return {
    interest: n(raw?.interest),
    curiosity: n(raw?.curiosity),
    flow: n(raw?.flow),
    human_connection: n(raw?.human_connection),
    learning: n(raw?.learning),
    memorability: n(raw?.memorability),
    reader_satisfaction: n(raw?.reader_satisfaction),
  };
}

function asLessons(
  raw: ModelDraft["lessons"]
): StoryEditorLesson[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set([
    "opening",
    "delete_para",
    "reorder",
    "ending",
    "curiosity",
    "human_focus",
    "insight",
    "clarity",
    "other",
  ]);
  return raw
    .map((l) => {
      const changeType = allowed.has(l.changeType ?? "")
        ? (l.changeType as StoryEditorLesson["changeType"])
        : "other";
      const rationale =
        typeof l.rationale === "string" ? l.rationale.trim() : "";
      if (!rationale) return null;
      return {
        changeType,
        rationale: rationale.slice(0, 400),
        principleIds: Array.isArray(l.principleIds)
          ? l.principleIds.filter((p) => typeof p === "string").slice(0, 6)
          : [],
      };
    })
    .filter(Boolean) as StoryEditorLesson[];
}

function normalizeParagraphs(paragraphs: string[] | undefined): string[] {
  if (!Array.isArray(paragraphs)) return [];
  return paragraphs
    .map((p) => p.replace(/\s+/g, " ").replace(/!+/g, ".").trim())
    .filter(Boolean)
    .slice(0, 12);
}

async function callStoryEditorModel(
  intake: StoryEditorIntake,
  redPen: string[],
  apiKey: string
): Promise<ModelDraft | null> {
  const locale = intake.locale ?? "en";
  const consultation =
    intake.consultation ??
    buildConsultationPack({
      surfaceRole: intake.surfaceRole,
      locale,
    });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2200,
      system: storyEditorSystemPrompt(locale, intake.surfaceRole),
      messages: [
        {
          role: "user",
          content: storyEditorUserPrompt(intake, consultation, redPen),
        },
      ],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  console.log("[storyEditor] model", {
    surface: intake.surfaceRole,
    id: intake.id.slice(0, 48),
    httpStatus: response.status,
    ok: response.ok,
    hasContent: Boolean(text),
    apiError: data?.error?.message ?? null,
  });

  if (!response.ok || !text) return null;
  return parseDraft(text);
}

function toResult(
  intake: StoryEditorIntake,
  draft: ModelDraft,
  passes: number,
  path: "full" | "thin_honest"
): StoryEditorResult {
  const paragraphs = normalizeParagraphs(draft.paragraphs);
  const headline =
    (draft.headline ?? intake.headline).replace(/\s+/g, " ").trim() ||
    intake.headline;
  const dek =
    typeof draft.dek === "string" && draft.dek.trim()
      ? draft.dek.replace(/\s+/g, " ").trim()
      : null;
  const scores = asScores(draft.scores);
  const lessons = asLessons(draft.lessons);
  const fq = draft.four_questions ?? {};

  return {
    headline,
    dek,
    paragraphs,
    bodyText: paragraphs.join("\n\n"),
    pullQuote:
      typeof draft.pull_quote === "string" && draft.pull_quote.trim()
        ? draft.pull_quote.trim()
        : null,
    ok: true,
    desk: {
      version: 1,
      path,
      locale: intake.locale ?? "en",
      scores,
      voluntaryFinish: Boolean(draft.voluntary_finish),
      memorableInsight:
        typeof draft.memorable_insight === "string"
          ? draft.memorable_insight.trim()
          : null,
      passes,
      lessons,
      constitutions: {
        storyStandard: true,
        memorability: true,
        globalLanguage: true,
        learningReady: lessons.length > 0,
      },
      fourQuestions: {
        what: (fq.what ?? "").trim(),
        why: (fq.why ?? "").trim(),
        who: (fq.who ?? "").trim(),
        remember: (fq.remember ?? "").trim(),
        limits: Array.isArray(fq.limits)
          ? fq.limits.filter((x) => typeof x === "string").slice(0, 6)
          : [],
      },
      editedAt: new Date().toISOString(),
    },
  };
}

/**
 * Run the Kindred Story Editor on one story before publication.
 */
export async function runStoryEditor(
  intake: StoryEditorIntake,
  apiKey: string
): Promise<StoryEditorResult> {
  const locale = intake.locale ?? "en";
  const sourceText = `${intake.headline}\n${intake.sourceText}`.trim();
  const working: StoryEditorIntake = {
    ...intake,
    locale,
    sourceText: intake.sourceText,
    consultation:
      intake.consultation ??
      buildConsultationPack({
        surfaceRole: intake.surfaceRole,
        locale,
      }),
  };

  if (isThinSource(intake.sourceText)) {
    // Still attempt one editorial pass — thin path may improve opening/close —
    // but fall back to honest thin if the model pads or fails gates.
    const thinAttempt = await callStoryEditorModel(working, [], apiKey);
    if (thinAttempt?.paragraphs?.length) {
      const scores = asScores(thinAttempt.scores);
      const paragraphs = normalizeParagraphs(thinAttempt.paragraphs);
      const issues = validateStoryDraft({
        headline: thinAttempt.headline ?? intake.headline,
        dek: thinAttempt.dek ?? null,
        paragraphs,
        sourceText,
        scores,
        voluntaryFinish: Boolean(thinAttempt.voluntary_finish),
        memorableInsight: thinAttempt.memorable_insight ?? null,
        requirePerfectScores: false,
        surfaceRole: intake.surfaceRole,
      });
      const factIssues = issues.filter(
        (i) =>
          i.code === "unsupported_numbers" ||
          i.code === "placeholder" ||
          i.code === "sensational" ||
          i.code === "press_release"
      );
      if (!factIssues.length && paragraphs.length <= 5) {
        const result = toResult(working, thinAttempt, 1, "thin_honest");
        console.log("[storyEditor] thin path accepted", {
          id: intake.id.slice(0, 48),
          paras: paragraphs.length,
        });
        return result;
      }
    }
    return intake.surfaceRole === "local_news"
      ? composeLocalNewsThinHonest(
          working,
          "Thin source — published honest Local News briefing without invented depth."
        )
      : composeThinHonest(
          working,
          "Thin source — published honest briefing without invented depth."
        );
  }

  let redPen: string[] = [];
  let best: StoryEditorResult | null = null;
  let bestIssueCount = Infinity;

  for (let pass = 1; pass <= STORY_EDITOR_MAX_PASSES; pass++) {
    const draft = await callStoryEditorModel(
      {
        ...working,
        priorDraft: best
          ? {
              headline: best.headline,
              dek: best.dek,
              paragraphs: best.paragraphs,
            }
          : working.priorDraft,
      },
      redPen,
      apiKey
    );

    if (!draft) {
      redPen = ["Model returned unparseable JSON. Return valid Story Editor JSON only."];
      continue;
    }

    const paragraphs = normalizeParagraphs(draft.paragraphs);
    const scores = asScores(draft.scores);
    const issues = validateStoryDraft({
      headline: draft.headline ?? intake.headline,
      dek: draft.dek ?? null,
      paragraphs,
      sourceText,
      scores,
      voluntaryFinish: Boolean(draft.voluntary_finish),
      memorableInsight: draft.memorable_insight ?? null,
      requirePerfectScores: true,
      surfaceRole: intake.surfaceRole,
    });

    const candidate = toResult(working, draft, pass, "full");
    if (issues.length < bestIssueCount) {
      best = candidate;
      bestIssueCount = issues.length;
    }

    console.log("[storyEditor] pass", {
      id: intake.id.slice(0, 48),
      pass,
      issueCount: issues.length,
      issues: issues.map((i) => i.code),
      perfect: allScoresAreFive(scores) && issues.length === 0,
    });

    if (issues.length === 0 && allScoresAreFive(scores)) {
      return candidate;
    }

    redPen = issues.map((i: ValidationIssue) => `${i.code}: ${i.message}`);
    if (draft.notes?.length) {
      redPen.push(...draft.notes.map((n) => `editor_note: ${n}`).slice(0, 4));
    }
  }

  // Infrastructure breaker: prefer best fact-safe full draft if scores are strong,
  // else honest thin rather than shipping a failed “excellent” claim.
  if (best) {
    const softIssues = validateStoryDraft({
      headline: best.headline,
      dek: best.dek,
      paragraphs: best.paragraphs,
      sourceText,
      scores: best.desk.scores,
      voluntaryFinish: best.desk.voluntaryFinish,
      memorableInsight: best.desk.memorableInsight,
      requirePerfectScores: false,
      surfaceRole: intake.surfaceRole,
    });
    const fatal = softIssues.filter((i) =>
      [
        "unsupported_numbers",
        "placeholder",
        "sensational",
        "press_release",
        "empty_body",
        "ai_tells",
      ].includes(i.code)
    );
    if (!fatal.length && best.paragraphs.length >= 2) {
      console.log("[storyEditor] breaker — publishing best safe draft", {
        id: intake.id.slice(0, 48),
        passes: best.desk.passes,
        remainingIssues: softIssues.map((i) => i.code),
      });
      return {
        ...best,
        desk: {
          ...best.desk,
          path: "full",
          constitutions: {
            ...best.desk.constitutions,
            // Perfect score gate not met — still learning-ready via lessons.
            storyStandard: softIssues.every(
              (i) => i.code === "score_below_five" || i.code === "no_insight"
            )
              ? best.desk.constitutions.storyStandard
              : softIssues.length === 0,
          },
        },
      };
    }
  }

  console.log("[storyEditor] breaker — thin honest", {
    id: intake.id.slice(0, 48),
  });
  return intake.surfaceRole === "local_news"
    ? composeLocalNewsThinHonest(
        working,
        "Story Editor could not clear excellence gates within the build budget; published honest Local News briefing."
      )
    : composeThinHonest(
        working,
        "Story Editor could not clear excellence gates within the build budget; published honest briefing."
      );
}

/**
 * Convenience: edit or fall back to wire if the API key is missing.
 */
export async function runStoryEditorSafe(
  intake: StoryEditorIntake,
  apiKey: string | null | undefined
): Promise<StoryEditorResult> {
  if (!apiKey) {
    return intake.surfaceRole === "local_news"
      ? composeLocalNewsThinHonest(
          intake,
          "Story Editor unavailable — honest Local News briefing."
        )
      : composeWireFallback(intake);
  }
  try {
    return await runStoryEditor(intake, apiKey);
  } catch (err) {
    console.log("[storyEditor] error", {
      id: intake.id.slice(0, 48),
      error: err instanceof Error ? err.message : String(err),
    });
    return intake.surfaceRole === "local_news"
      ? composeLocalNewsThinHonest(
          intake,
          "Story Editor threw — honest Local News fallback published."
        )
      : composeThinHonest(
          intake,
          "Story Editor threw — honest fallback published."
        );
  }
}
