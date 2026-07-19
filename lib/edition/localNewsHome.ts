/**
 * Local News homepage desk — resolve lead + top stories for the folio.
 */

import type { LeadStory, LocalNewsContentType } from "./LeadStory";
import type { TopStoryItem } from "./topStories";

export const LOCAL_NEWS_EMPTY_PLACEHOLDER = "No major local updates today.";

const DESK_BADGES: Record<LocalNewsContentType, string> = {
  local_news: "📰 Local News",
  sports: "🏈 Sports",
  weather: "🌤 Weather",
  community: "🏛 Community Update",
};

function deskBadgeFor(
  contentType: LocalNewsContentType | null | undefined,
  explicit?: string | null
): string {
  if (explicit?.trim()) return explicit.trim();
  return DESK_BADGES[contentType ?? "local_news"];
}

export function isLocalNewsRole(role: string | null | undefined): boolean {
  return /local/i.test(role ?? "");
}

export function localTopStoriesOnly(topStories: TopStoryItem[]): TopStoryItem[] {
  return topStories.filter((s) => isLocalNewsRole(s.role));
}

export type LocalNewsHomePackage = {
  /** Primary feature — edition lead when local, otherwise first local top story. */
  lead: LeadStory | null;
  featureTopStory: TopStoryItem | null;
  sideStories: TopStoryItem[];
  hasStories: boolean;
  /** Homepage kicker badge from the selected desk content type. */
  deskBadge: string;
};

/**
 * Resolve what the Local News TimeStylePackage should show.
 * Never requires a local lead when local top stories exist.
 *
 * After the Local News briefing refactor, `editorial_context.top_stories` is
 * the local desk. If slate roles were mislabeled (national/interest/feature
 * from selectFrontPage), still surface those stories unless a non-local lead
 * claims the slate for the legacy "wider world" path.
 */
export function resolveLocalNewsHomePackage(input: {
  leadStory: LeadStory | null;
  topStories: TopStoryItem[];
}): LocalNewsHomePackage {
  let localTop = localTopStoriesOnly(input.topStories);
  const localLead =
    input.leadStory && isLocalNewsRole(input.leadStory.role)
      ? input.leadStory
      : null;

  if (
    localTop.length === 0 &&
    input.topStories.length > 0 &&
    (localLead || !input.leadStory)
  ) {
    localTop = input.topStories;
  }

  if (localLead) {
    const sideStories = localTop
      .filter((s) => s.id !== localLead.id)
      .slice(0, 2);
    return {
      lead: localLead,
      featureTopStory: null,
      sideStories,
      hasStories: true,
      deskBadge: deskBadgeFor(localLead.contentType, localLead.deskBadge),
    };
  }

  const featureTopStory = localTop[0] ?? null;
  const sideStories = featureTopStory ? localTop.slice(1, 3) : [];

  return {
    lead: null,
    featureTopStory,
    sideStories,
    hasStories: Boolean(featureTopStory),
    deskBadge: deskBadgeFor(
      featureTopStory?.contentType,
      featureTopStory?.deskBadge
    ),
  };
}
