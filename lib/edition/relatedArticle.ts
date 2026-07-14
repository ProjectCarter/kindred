/**
 * Resolve a Knowledge/Discovery storyKey to the real KindredArticle it
 * refers to elsewhere in today's edition.
 *
 * Continuation cards ("Related stories", "Continue reading") are built
 * from a short knowledge-facet summary, but the facet's `data.storyKey`
 * (or a discovery item id) usually points at a real, full piece already
 * present in the same edition — a Top Story, another section, or a
 * discovery/notebook recommendation. Opening that real piece instead of
 * a synthetic restatement is what makes a "related article" actually
 * behave like the article it claims to be.
 */
import type { EditionSection } from "./types";
import type { LeadStory } from "./LeadStory";
import type { RankedDiscoveryItem } from "./discovery";
import type { LocalEventCard } from "./localEvents";
import {
  articleFromEditionSection,
  articleFromLeadStory,
  articleFromNotebookItem,
  sectionOpensArticleReader,
  type KindredArticle,
} from "./article";
import { articleFromTopStory, type TopStoryItem } from "./topStories";

export type RelatedArticleContext = {
  sections?: EditionSection[] | null;
  topStories?: TopStoryItem[] | null;
  leadStory?: LeadStory | null;
  discoveryItems?: RankedDiscoveryItem[] | null;
  localEvents?: LocalEventCard[] | null;
};

/**
 * Never fabricates a match — returns null unless the storyKey is a real,
 * currently-loaded piece of today's edition.
 */
export function resolveArticleForStoryKey(
  storyKey: string | null | undefined,
  ctx: RelatedArticleContext
): KindredArticle | null {
  const key = storyKey?.trim();
  if (!key) return null;

  if (ctx.leadStory && ctx.leadStory.id === key) {
    return articleFromLeadStory(ctx.leadStory);
  }

  const topStory = ctx.topStories?.find((s) => s.id === key);
  if (topStory) return articleFromTopStory(topStory);

  const section = ctx.sections?.find(
    (s) => s.id === key && sectionOpensArticleReader(s.section_type)
  );
  if (section) return articleFromEditionSection(section);

  const ranked = ctx.discoveryItems?.find((r) => r.item.id === key);
  if (ranked) return articleFromNotebookItem(ranked, ctx.localEvents);

  return null;
}
