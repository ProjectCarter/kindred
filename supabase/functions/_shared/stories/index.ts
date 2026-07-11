import { fetchStoryCandidates } from "./fetchCandidates.ts";
import { scoreCandidate } from "./score.ts";
import { selectFrontPage } from "./selectFrontPage.ts";
import type {
  FrontPageSelection,
  StoryRankingContext,
} from "./types.ts";

export type {
  CandidateStory,
  FrontPageSelection,
  RankedStory,
  StoryRankingContext,
  StoryRankingProfile,
  StoryRole,
  StorySelectionReason,
} from "./types.ts";

export { primaryNewsCategory, interestToCategory } from "./sources.ts";
export { scoreCandidate, storySimilarity } from "./score.ts";
export { selectFrontPage } from "./selectFrontPage.ts";
export { fetchStoryCandidates } from "./fetchCandidates.ts";
export {
  auditComposition,
  isNearDuplicate,
  matchesRecentCoverage,
  normalizeSourceKey,
  normalizeTitleKey,
} from "./diversity.ts";

/**
 * End-to-end: fetch → score → balanced front-page selection.
 */
export async function buildFrontPageStories(
  ctx: StoryRankingContext,
  apiKey: string
): Promise<FrontPageSelection> {
  const candidates = await fetchStoryCandidates(ctx, apiKey);
  const scored = candidates
    .map((story) => scoreCandidate(story, ctx))
    .sort((a, b) => b.score - a.score);

  const selection = selectFrontPage(scored, ctx);

  console.log("[stories] front page selection", {
    candidateCount: candidates.length,
    selectedCount: selection.stories.length,
    roles: selection.stories.map((s) => s.role),
    titles: selection.stories.map((s) => s.story.title.slice(0, 60)),
  });

  return selection;
}
