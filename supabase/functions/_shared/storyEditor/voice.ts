/**
 * Story Editor voice — senior magazine editor; constitutions as law.
 */

import {
  GLOBAL_LANGUAGE_DIGEST,
  LEARNING_ENGINE_DIGEST,
  LOCAL_NEWS_BRIEFING_DIGEST,
  MEMORABILITY_DIGEST,
  STORY_EDITOR_QUESTIONS,
  STORY_STANDARD_DIGEST,
} from "./constitutions.ts";
import type { ConsultationPack, StoryEditorIntake } from "./types.ts";

export function storyEditorSystemPrompt(
  locale: string,
  surfaceRole?: StoryEditorIntake["surfaceRole"]
): string {
  const localNewsBlock =
    surfaceRole === "local_news"
      ? `\n\n${LOCAL_NEWS_BRIEFING_DIGEST}\n`
      : "";
  return (
    "You are Kindred’s Story Editor — a senior magazine editor whose only job is " +
    "to protect the reader from boring articles while preserving absolute truth.\n\n" +
    "You do not invent facts, numbers, names, quotes, motives, or local color.\n" +
    "You transform accurate reporting into exceptional reading.\n\n" +
    STORY_STANDARD_DIGEST +
    "\n\n" +
    MEMORABILITY_DIGEST +
    "\n\n" +
    GLOBAL_LANGUAGE_DIGEST.replace("{locale}", locale) +
    "\n\n" +
    LEARNING_ENGINE_DIGEST +
    localNewsBlock +
    "\n\n" +
    "Before approving, answer NO to continue rewriting:\n" +
    STORY_EDITOR_QUESTIONS.map((q) => `• ${q}`).join("\n") +
    "\n\n" +
    "Score Interest, Curiosity, Flow, Human Connection, Learning, Memorability, " +
    "Reader Satisfaction from 0–5. Advance only when every score is 5 and voluntary_finish is true.\n" +
    "Return ONLY valid JSON with this shape:\n" +
    '{"voluntary_finish":true,"headline":string,"dek":string|null,"paragraphs":string[],' +
    '"pull_quote":null,"scores":{"interest":5,"curiosity":5,"flow":5,"human_connection":5,' +
    '"learning":5,"memorability":5,"reader_satisfaction":5},"memorable_insight":string,' +
    '"four_questions":{"what":string,"why":string,"who":string,"remember":string,"limits":string[]},' +
    '"lessons":[{"changeType":"opening"|"delete_para"|"reorder"|"ending"|"curiosity"|"human_focus"|"insight"|"clarity"|"other",' +
    '"rationale":string,"principleIds":string[]}],"notes":string[]}\n' +
    "No markdown fences. No preamble."
  );
}

export function storyEditorUserPrompt(
  intake: StoryEditorIntake,
  consultation: ConsultationPack,
  redPen: string[]
): string {
  const prior = intake.priorDraft
    ? `\nPRIOR DRAFT:\nHeadline: ${intake.priorDraft.headline}\nDek: ${
        intake.priorDraft.dek ?? "(none)"
      }\n${intake.priorDraft.paragraphs.join("\n\n")}\n`
    : "";

  const why =
    intake.selectionWhy?.length
      ? `Selection framing (not facts): ${intake.selectionWhy.join("; ")}\n`
      : "";

  const place =
    intake.readerPlace &&
    (intake.readerPlace.city ||
      intake.readerPlace.region ||
      intake.readerPlace.state)
      ? `Reader place: ${[
          intake.readerPlace.city,
          intake.readerPlace.region,
          intake.readerPlace.state,
        ]
          .filter(Boolean)
          .join(", ")}.\n`
      : "";

  const principles = consultation.principles
    .slice(0, 8)
    .map((p) => `- [${p.id}] ${p.title}: ${p.guidance}`)
    .join("\n");

  const red =
    redPen.length > 0
      ? `\nRED PEN FROM LAST PASS (must fix):\n${redPen.map((r) => `• ${r}`).join("\n")}\n`
      : "";

  return (
    `Surface: ${intake.surfaceRole}\n` +
    `Locale: ${intake.locale ?? "en"}\n` +
    `Source: ${intake.source}\n` +
    `Published: ${intake.publishedAt ?? "unknown"}\n` +
    why +
    place +
    `\nSOURCE TEXT (closed world — do not invent beyond this):\n${intake.sourceText}\n` +
    `\nWIRE HEADLINE:\n${intake.headline}\n` +
    prior +
    `\nCONSULTATION PACK (advice only; truth overrides):\n` +
    `Confidence: ${consultation.confidence}\n` +
    `Principles:\n${principles}\n` +
    `Playbook hints: ${consultation.playbookHints.join(" | ")}\n` +
    `Avoid: ${consultation.avoidPatterns.join("; ")}\n` +
    (consultation.readerNotes.length
      ? `Reader craft notes: ${consultation.readerNotes.join("; ")}\n`
      : "") +
    red +
    "\nRewrite until a senior editor would proudly publish this in tomorrow’s Kindred edition. " +
    (intake.surfaceRole === "local_news"
      ? "Write a complete Local News briefing (4–8 paragraphs when the source supports it). "
      : "") +
    "If the source is thin, write a short honest briefing and state limits — never pad with fiction."
  );
}
