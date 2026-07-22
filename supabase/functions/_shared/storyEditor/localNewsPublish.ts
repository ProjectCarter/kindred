/**
 * Local News publish gate — skip unavailable Story Editor results.
 */

import type { StoryEditorResult } from "./types.ts";
import { isDistinctLocalNewsArticleShape } from "../../../../lib/edition/localNewsSourceQuality.ts";
import {
  hasAcceptableFallbackSourceMaterial,
  hasMinimumLeadSourceMaterial,
} from "../../../../lib/edition/localNewsGeographicEligibility.ts";
import { validateKindredArticleProse } from "../../../../lib/edition/kindredArticleProse.ts";
import {
  localNewsBriefingMinWords,
  newsBriefingWordCount,
} from "../../../../lib/edition/newsBriefingQuality.ts";

export function isPublishableLocalNewsStory(
  edited: StoryEditorResult,
  source?: { title: string; description?: string | null }
): boolean {
  if (edited.desk.path === "unavailable") return false;
  if (!edited.ok && edited.paragraphs.length === 0) return false;
  if (!edited.paragraphs.length) return false;
  const sourceText = source
    ? `${source.title}\n${source.description ?? ""}`.trim()
    : edited.paragraphs.join("\n\n");
  const combinedWords = newsBriefingWordCount([
    ...edited.paragraphs,
    ...Object.values(edited.desk.fieldAnswers ?? {}),
  ]);
  const minCombined =
    edited.desk.path === "thin_honest"
      ? 20
      : localNewsBriefingMinWords(sourceText);
  if (combinedWords < minCombined) return false;
  if (
    edited.paragraphs.length < 2 &&
    source &&
    !hasMinimumLeadSourceMaterial({
      title: source.title,
      description: source.description,
    }) &&
    !hasAcceptableFallbackSourceMaterial({
      title: source.title,
      description: source.description,
    })
  ) {
    return false;
  }
  return isDistinctLocalNewsArticleShape({
    headline: edited.headline,
    dek: edited.dek,
    body: edited.paragraphs,
  }) &&
    validateKindredArticleProse({
      headline: edited.headline,
      dek: edited.dek,
      body: edited.paragraphs,
      desk: "local_news",
      subjectTokens: [edited.headline, source?.title ?? ""].filter(Boolean),
      minWords: edited.desk.path === "thin_honest" ? 20 : undefined,
    }).passes;
}

export function cardSummaryFromEdit(
  edited: StoryEditorResult,
  fallback: string
): string {
  const dek = edited.dek?.trim();
  if (dek) return dek;
  const first = edited.paragraphs[0]?.trim();
  if (first && first.length <= 220) return first;
  if (first) return `${first.slice(0, 217).trim()}…`;
  return fallback;
}
