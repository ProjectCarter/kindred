/**
 * Local News reader adapters — newspaper structure without UI changes.
 */

import { articleFromSectionItem } from "./article";
import type { KindredArticle } from "./article";
import {
  filterLocalNewsBodyParagraphs,
  localNewsBriefingFooterNote,
  localNewsModulesFromDeskMeta,
} from "./localNewsArticleCore";

export {
  LOCAL_NEWS_DISCLAIMER_PATTERNS,
  filterLocalNewsBodyParagraphs,
  isLocalNewsDisclaimerParagraph,
  localNewsBriefingFooterNote,
  localNewsFieldAnswersFromDesk,
  localNewsModulesFromDeskMeta,
  localNewsStoryTypeFromDesk,
} from "./localNewsArticleCore";

export type LocalNewsArticleInput = {
  id: string;
  headline: string;
  body: string | string[];
  dek?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  publishedAt?: string | null;
  imageUrl?: string | null;
  imageCaption?: string | null;
  role?: string | null;
  desk?: Record<string, unknown> | null;
};

export function articleFromLocalNewsStory(
  input: LocalNewsArticleInput
): KindredArticle {
  const rawBody = Array.isArray(input.body)
    ? input.body.join("\n\n")
    : input.body;
  const filtered = filterLocalNewsBodyParagraphs(
    rawBody.includes("\n\n")
      ? rawBody.split(/\n\s*\n/).map((p) => p.trim())
      : rawBody.trim()
        ? [rawBody.trim()]
        : []
  );
  const modules = localNewsModulesFromDeskMeta(input.desk);
  const briefingFooterNote = localNewsBriefingFooterNote({
    desk: input.desk,
    source: input.source?.trim() || "Kindred",
  });

  const article = articleFromSectionItem({
    id: input.id,
    section: "local_news",
    headline: input.headline,
    body: filtered.length ? filtered.join("\n\n") : rawBody,
    dek: input.dek ?? null,
    source: input.source,
    sourceUrl: input.sourceUrl,
    publishedAt: input.publishedAt,
    imageUrl: input.imageUrl,
    imageCaption: input.imageCaption,
    role: input.role ?? "local",
    tags: input.role ? [input.role] : ["local"],
    fieldAnswers: {},
  });

  return {
    ...article,
    modules: modules.length ? modules : article.modules,
    briefingFooterNote,
  };
}
