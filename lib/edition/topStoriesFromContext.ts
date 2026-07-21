/**
 * Top-story parsing from editorial_context — no article graph imports so Node
 * smoke tests can load homepage news hydration without the RN bundle graph.
 */

import {
  notesForSection,
  type EditionEditorialContext,
} from "./EditorialContext.ts";

export type TopStoryItem = {
  id: string;
  headline: string;
  summary: string;
  dek?: string | null;
  body?: string[];
  source: string;
  url: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
  role?: string | null;
  contentType?: "local_news" | "sports" | "weather" | "community" | null;
  deskBadge?: string | null;
  desk?: Record<string, unknown> | null;
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
      desk:
        item.desk && typeof item.desk === "object"
          ? (item.desk as Record<string, unknown>)
          : null,
    });
  }
  return out;
}
