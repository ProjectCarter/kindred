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

export type CandidateStory = {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  /** Best available article image from the wire, when present. */
  imageUrl?: string | null;
  /** NewsAPI category or inferred topic bucket. */
  category: string | null;
  /** Where the candidate was fetched from. */
  pool: "general" | "interest" | "local" | "secondary";
};

export type RankedStory = {
  story: CandidateStory;
  score: number;
  role: StoryRole;
  reasons: StorySelectionReason[];
};

export type StoryRankingProfile = {
  interests: string[];
  /** Learned + onboarding topics for ranking boosts. */
  followedTopics: string[];
  city: string | null;
  region: string | null;
  state: string | null;
};

export type PersonalizationRankingSignals = {
  favoriteSources: Array<{ key: string; weight: number }>;
  followedTopics: Array<{ key: string; weight: number }>;
  skippedTopics: Array<{ key: string; weight: number }>;
  engagedStoryKeys: string[];
  clippedStoryKeys: string[];
  /** 0–1 — how much behavioral history we have. */
  confidence: number;
};

export type StoryRankingContext = StoryRankingProfile & {
  now?: Date;
  /** Recently shown story ids/titles for anti-repetition. */
  recentStoryKeys?: string[];
  maxStories?: number;
  /** Quiet behavioral affinities from the personalization engine. */
  personalization?: PersonalizationRankingSignals;
  /** Newspaper Editor AI — calendar + desk policy for this edition. */
  editorial?: {
    calendar: {
      editionDate: string;
      dayOfWeek: number;
      isWeekend: boolean;
      isSaturday: boolean;
      isSunday: boolean;
      mode: string;
      modeLabel: string;
    };
    policy: {
      mode: string;
      freshnessSoftHours: number;
      freshnessHardHours: number;
      breakingMinScore: number;
      preferLeisureTone: boolean;
      preferWorldBalance: boolean;
      morningFreshHours: number;
      personalizationIntegrityCap: number;
      maxHeavyStories: number;
      requireEmotionalBalance: boolean;
    };
  };
};

export type FrontPageSelection = {
  stories: RankedStory[];
  /** Grounding block for the edition writer (Claude). */
  groundingData: string;
  /** Full scored pool — used by Lead Story without re-fetching. */
  scoredCandidates: Array<{
    story: CandidateStory;
    score: number;
    reasons: StorySelectionReason[];
  }>;
  /** Structured meta for future “why this story” AI copy. */
  selectionMeta: {
    selectedAt: string;
    profile: StoryRankingProfile;
    stories: Array<{
      title: string;
      role: StoryRole;
      score: number;
      reasons: StorySelectionReason[];
      source: string;
      category?: string | null;
      publishedAt?: string | null;
    }>;
    /** Invisible composition audit — source/topic/geo balance. */
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
    /** Newspaper Editor AI decision trail — why each story appears. */
    editorialDecisions?: unknown;
  };
};
