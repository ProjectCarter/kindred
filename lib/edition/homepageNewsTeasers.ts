/**
 * Local + National News homepage teasers — newspaper article rows, not listing cards.
 */

import type { LeadStory } from "./LeadStory";
import {
  LOCAL_NEWS_EMPTY_PLACEHOLDER,
  type LocalNewsHomePackage,
} from "./localNewsHome";
import type { NationalNewsStory } from "./nationalNewsTypes";
import type { TopStoryItem } from "./topStories";

export { LOCAL_NEWS_EMPTY_PLACEHOLDER };

export const NATIONAL_NEWS_EMPTY_PLACEHOLDER =
  "No major national headlines today.";

export type NewsArticleTeaser = {
  id: string;
  headline: string;
  /** City, source, or "City · Source" — never badges or utility labels. */
  attribution: string | null;
  teaser: string | null;
};

/** Clamp wire copy to a short newspaper teaser (up to four sentences). */
export function formatNewsArticleTeaser(
  text: string | null | undefined
): string | null {
  const cleaned = text?.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const sentences =
    cleaned
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((part) => part.trim())
      .filter(Boolean) ?? [];

  if (sentences.length === 0) return cleaned;
  if (sentences.length <= 4) return sentences.join(" ");
  return sentences.slice(0, 4).join(" ");
}

function localNewsAttribution(
  city: string | null | undefined,
  source: string | null | undefined
): string | null {
  const cityLine = city?.trim() || null;
  const sourceLine = source?.trim() || null;
  if (cityLine && sourceLine) {
    if (sourceLine.toLowerCase().includes(cityLine.toLowerCase())) {
      return sourceLine;
    }
    return `${cityLine} · ${sourceLine}`;
  }
  return cityLine ?? sourceLine;
}

export function localNewsPackageToArticleTeasers(
  pkg: LocalNewsHomePackage,
  locationCity?: string | null
): NewsArticleTeaser[] {
  const articles: NewsArticleTeaser[] = [];

  if (pkg.lead) {
    articles.push({
      id: pkg.lead.id,
      headline: pkg.lead.headline,
      attribution: localNewsAttribution(locationCity, pkg.lead.source),
      teaser: formatNewsArticleTeaser(pkg.lead.summary),
    });
  } else if (pkg.featureTopStory) {
    articles.push({
      id: pkg.featureTopStory.id,
      headline: pkg.featureTopStory.headline,
      attribution: localNewsAttribution(
        locationCity,
        pkg.featureTopStory.source
      ),
      teaser: formatNewsArticleTeaser(
        pkg.featureTopStory.dek ?? pkg.featureTopStory.summary
      ),
    });
  }

  for (const story of pkg.sideStories) {
    articles.push({
      id: story.id,
      headline: story.headline,
      attribution: localNewsAttribution(locationCity, story.source),
      teaser: formatNewsArticleTeaser(story.dek ?? story.summary),
    });
  }

  return articles;
}

function topStoryToTeaser(story: TopStoryItem): NewsArticleTeaser {
  return {
    id: story.id,
    headline: story.headline,
    attribution: story.source?.trim() || null,
    teaser: formatNewsArticleTeaser(story.dek ?? story.summary),
  };
}

function leadStoryToTeaser(lead: LeadStory): NewsArticleTeaser {
  return {
    id: lead.id,
    headline: lead.headline,
    attribution: lead.source?.trim() || null,
    teaser: formatNewsArticleTeaser(lead.summary),
  };
}

function nationalStoryToTeaser(story: NationalNewsStory): NewsArticleTeaser {
  return {
    id: story.id,
    headline: story.headline,
    attribution: story.sourceName?.trim() || null,
    teaser: formatNewsArticleTeaser(story.summary),
  };
}

/**
 * Resolve National News homepage rows — package first, then legacy lead/top stories.
 */
export function resolveNationalNewsArticleTeasers(input: {
  nationalStories: readonly NationalNewsStory[];
  leadStory: LeadStory | null;
  nationalTopStories: readonly TopStoryItem[];
}): NewsArticleTeaser[] {
  if (input.nationalStories.length > 0) {
    return input.nationalStories.slice(0, 3).map(nationalStoryToTeaser);
  }

  const articles: NewsArticleTeaser[] = [];
  const nationalLead =
    input.leadStory && !/local/i.test(input.leadStory.role ?? "")
      ? input.leadStory
      : null;

  if (nationalLead) {
    articles.push(leadStoryToTeaser(nationalLead));
    for (const story of input.nationalTopStories
      .filter((s) => s.id !== nationalLead.id)
      .slice(0, 2)) {
      articles.push(topStoryToTeaser(story));
    }
    return articles;
  }

  return input.nationalTopStories.slice(0, 3).map(topStoryToTeaser);
}
