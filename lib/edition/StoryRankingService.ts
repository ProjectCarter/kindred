/**
 * Client-facing contract for Top Stories intelligence.
 * Ranking runs at edition build time (Edge); these types prepare the app
 * for future “why this story was chosen” explanations without UI changes now.
 */

export type StoryRole =
  | "national"
  | "interest"
  | "local"
  | "feature"
  | "breaking";

export type StorySelectionReason = {
  code: string;
  label: string;
  weight: number;
};

export type StorySelectionMeta = {
  selectedAt: string;
  profile: {
    interests: string[];
    followedTopics: string[];
    city: string | null;
    region: string | null;
    state: string | null;
  };
  stories: Array<{
    title: string;
    role: StoryRole;
    score: number;
    reasons: StorySelectionReason[];
    source: string;
    category?: string | null;
    publishedAt?: string | null;
  }>;
  composition?: {
    uniqueSources: number;
    uniqueCategories: number;
    roles: string[];
    hasLocal: boolean;
    hasNationalOrWorld: boolean;
    hasInterest: boolean;
    hasFeature: boolean;
    avgFreshnessHours: number | null;
    editorNotes: string[];
  };
};

export const STORY_ROLE_LABELS: Record<StoryRole, string> = {
  national: "Major national or world story",
  interest: "Matched to your interests",
  local: "Local or regional relevance",
  feature: "Uplifting or interesting feature",
  breaking: "Important developing news",
};

/**
 * Future AI helper: turn structured selection meta into calm prose.
 * Not shown in the newspaper UI yet — extension point only.
 */
export function formatStoryWhyChosen(
  story: StorySelectionMeta["stories"][number]
): string {
  const role = STORY_ROLE_LABELS[story.role] ?? story.role;
  const top = story.reasons
    .filter((r) => !r.code.startsWith("role_"))
    .slice(0, 2)
    .map((r) => r.label);
  if (!top.length) return role;
  return `${role}. ${top.join(" ")}`;
}

export const StoryRankingService = {
  roleLabels: STORY_ROLE_LABELS,
  formatStoryWhyChosen,
};

export default StoryRankingService;
