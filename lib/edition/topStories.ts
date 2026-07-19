/**
 * Top Stories — one headline, one cohesive article.
 * Never open a mashup of unrelated wires as a single Kindred article.
 */

import type { KindredArticle } from "./article";
import { articleFromSectionItem } from "./article";
import {
  notesForSection,
  type EditionEditorialContext,
} from "./EditorialContext";

export type TopStoryItem = {
  id: string;
  headline: string;
  summary: string;
  dek?: string | null;
  /** Story Editor paragraphs when the desk has rewritten the story. */
  body?: string[];
  source: string;
  url: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
  role?: string | null;
  contentType?: "local_news" | "sports" | "weather" | "community" | null;
  deskBadge?: string | null;
};

/** Pull individual Top Stories from stored editorial_context. */
export function topStoriesFromEditorialContext(
  editorialContext: unknown
): TopStoryItem[] {
  if (!editorialContext || typeof editorialContext !== "object") return [];
  const ctx = editorialContext as EditionEditorialContext;
  if (!Array.isArray(ctx.sections)) return [];

  const section =
    notesForSection(ctx, "top_stories") ??
    ctx.sections.find((s) => s.sectionType === "top_stories") ??
    null;
  if (!section?.items?.length) return [];

  const out: TopStoryItem[] = [];
  for (const item of section.items) {
    const title = item.title?.trim();
    const bodyText = Array.isArray(item.body)
      ? item.body
          .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
          .join("\n\n")
          .trim()
      : "";
    const summary =
      item.summary?.trim() ||
      item.dek?.trim() ||
      bodyText ||
      "";
    if (!title || !summary) continue;
    out.push({
      id: (item.id?.trim() || `top:${title.slice(0, 48)}`).slice(0, 240),
      headline: title,
      summary,
      dek: item.dek?.trim() || null,
      body: Array.isArray(item.body)
        ? item.body.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        : undefined,
      source: item.source?.trim() || "Kindred",
      url: item.url ?? null,
      imageUrl: item.imageUrl ?? null,
      publishedAt: item.publishedAt ?? null,
      role: item.role ?? null,
    });
  }
  return out;
}

export function articleFromTopStory(story: TopStoryItem): KindredArticle {
  const section = /local/i.test(story.role ?? "")
    ? "local_news"
    : "top_stories";
  const bodyText =
    story.body?.length && story.body.join("").trim()
      ? story.body.join("\n\n")
      : story.summary;
  return articleFromSectionItem({
    id: story.id,
    section,
    headline: story.headline,
    body: bodyText,
    dek: story.dek ?? story.summary,
    source: story.source,
    sourceUrl: story.url,
    publishedAt: story.publishedAt,
    imageUrl: story.imageUrl,
    role: story.role,
    tags: story.role ? [story.role] : undefined,
  });
}
