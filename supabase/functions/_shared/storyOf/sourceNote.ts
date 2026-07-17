/**
 * The Story of... source_note payload — image, subtitle, further reading.
 * Client mirror: lib/edition/storyOf.ts
 */

import type { CityArticleSnapshot } from "./types.ts";

export type StoryOfSourceNotePayload = {
  kind: "story_of";
  metroKey: string;
  subtitle: string;
  furtherReading: string[];
  cityImage: {
    url: string;
    caption: string;
    credit: string;
    sourcePageUrl: string;
    license: string;
    assetKind: "photograph";
    source: "wikimedia_commons";
    resolvedAt: string;
  };
};

export function cityArticleSourceNote(
  article: CityArticleSnapshot
): string {
  const payload: StoryOfSourceNotePayload = {
    kind: "story_of",
    metroKey: article.metroKey,
    subtitle: article.subtitle.trim(),
    furtherReading: article.furtherReading,
    cityImage: {
      url: article.image.url,
      caption: article.image.caption,
      credit: article.image.credit,
      sourcePageUrl: article.image.sourceUrl,
      license: article.image.license,
      assetKind: "photograph",
      source: "wikimedia_commons",
      resolvedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(payload);
}

export function parseStoryOfSourceNote(
  sourceNote: string | null | undefined
): StoryOfSourceNotePayload | null {
  const raw = sourceNote?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoryOfSourceNotePayload & { kind?: string };
    if (parsed?.kind !== "story_of" && parsed?.kind !== "your_city") return null;
    if (!parsed.cityImage?.url?.trim()) return null;
    return { ...parsed, kind: "story_of" };
  } catch {
    return null;
  }
}
