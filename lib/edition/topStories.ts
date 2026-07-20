/**
 * Top Stories — one headline, one cohesive article.
 * Never open a mashup of unrelated wires as a single Kindred article.
 */

import type { KindredArticle } from "./article";
import { articleFromSectionItem } from "./article";
import {
  topStoriesFromEditorialContext,
  type TopStoryItem,
} from "./topStoriesFromContext.ts";

export type { TopStoryItem } from "./topStoriesFromContext.ts";
export { topStoriesFromEditorialContext } from "./topStoriesFromContext.ts";

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
