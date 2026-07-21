/**
 * Top Stories — one headline, one cohesive article.
 * Never open a mashup of unrelated wires as a single Kindred article.
 */

import type { KindredArticle } from "./article";
import { articleFromSectionItem } from "./article";
import { articleFromLocalNewsStory } from "./localNewsArticle";
import {
  topStoriesFromEditorialContext,
  type TopStoryItem,
} from "./topStoriesFromContext.ts";

export type { TopStoryItem } from "./topStoriesFromContext.ts";
export { topStoriesFromEditorialContext } from "./topStoriesFromContext.ts";

export function articleFromTopStory(story: TopStoryItem): KindredArticle {
  const isLocal = /local/i.test(story.role ?? "");
  const bodyText =
    story.body?.length && story.body.join("").trim()
      ? story.body
      : [story.summary];

  if (isLocal) {
    return articleFromLocalNewsStory({
      id: story.id,
      headline: story.headline,
      body: bodyText,
      dek: story.dek ?? story.summary,
      source: story.source,
      sourceUrl: story.url,
      publishedAt: story.publishedAt,
      imageUrl: story.imageUrl,
      role: story.role,
      desk: story.desk,
    });
  }

  return articleFromSectionItem({
    id: story.id,
    section: "top_stories",
    headline: story.headline,
    body: bodyText.join("\n\n"),
    dek: story.dek ?? story.summary,
    source: story.source,
    sourceUrl: story.url,
    publishedAt: story.publishedAt,
    imageUrl: story.imageUrl,
    role: story.role,
    tags: story.role ? [story.role] : undefined,
  });
}
