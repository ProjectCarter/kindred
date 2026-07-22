/**
 * Shared U.S. National News — article adapter re-exports.
 */

export type {
  NationalNewsImage,
  NationalNewsPackage,
  NationalNewsStory,
  NationalNewsVerification,
} from "./nationalNewsTypes.ts";

export {
  localTopStoriesOnly,
  nationalNewsFromEdition,
  nationalNewsFromLegacyTopStories,
  nationalNewsStoryIds,
  parseNationalNewsPackage,
  resolveNationalNewsForRender,
  simulateNationalNewsClaim,
} from "./nationalNewsTypes.ts";

import type { KindredArticle } from "./article";
import { articleFromSectionItem } from "./article";
import type { NationalNewsStory } from "./nationalNewsTypes.ts";
import { newspaperSourceAttribution } from "./newspaperAttribution.ts";

export function articleFromNationalNewsStory(story: NationalNewsStory): KindredArticle {
  const bodyText = story.body?.length
    ? story.body.join("\n\n")
    : story.summary;
  const article = articleFromSectionItem({
    id: story.id,
    section: "national_news",
    headline: story.headline,
    body: bodyText,
    dek: story.dek ?? null,
    source: story.sourceName,
    sourceUrl: story.sourceUrl,
    publishedAt: story.publishedAt,
    imageUrl: story.image?.url ?? null,
    role: story.category,
    tags: story.category ? [story.category] : undefined,
  });

  return {
    ...article,
    briefingFooterNote: newspaperSourceAttribution(story.sourceName),
  };
}
