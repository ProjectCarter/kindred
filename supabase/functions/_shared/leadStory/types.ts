import type { StorySelectionReason } from "../stories/types.ts";

/** Lead placement on the future front page — Bandit's Pick reserved, not active. */
export type BanditsPickReservation = {
  /** Slot exists for a future Bandit's Pick marker. */
  reserved: true;
  /** Never true until Bandit integration ships. */
  isBanditsPick: false;
};

export type LeadStoryHeroImage = {
  /** Best available article image, if the wire provided one. */
  uri: string | null;
  alt: string;
  /** Reserved for future editorial photography overrides. */
  source: "article" | "none";
};

export type LeadStoryRole = "local" | "national" | "world" | "breaking";

/**
 * Front Page Lead Story — one editorial-quality story per edition.
 * Stored as structured metadata; UI placeholder optional / later.
 */
export type LeadStory = {
  id: string;
  headline: string;
  summary: string;
  /** Story Editor paragraphs when the desk has rewritten the Lead. */
  body?: string[];
  dek?: string | null;
  /** Story Editor provenance — Learning Engine + reader adapters. */
  desk?: Record<string, unknown> | null;
  source: string;
  url: string | null;
  publishedAt: string | null;
  role: LeadStoryRole;
  heroImage: LeadStoryHeroImage;
  banditsPick: BanditsPickReservation;
  selection: {
    score: number;
    reasons: StorySelectionReason[];
    /** Titles in Top Stories that were treated as “below the fold” for diversity. */
    belowFoldTitles: string[];
    strategy: "prefer_local" | "national_world" | "breaking" | "fallback";
  };
};

export type SelectLeadStoryInput = {
  /** Balanced Top Stories slate (appears below the lead later). */
  topStories: Array<{
    story: {
      id: string;
      title: string;
      description: string;
      source: string;
      url: string | null;
      publishedAt: string | null;
      imageUrl?: string | null;
      pool: string;
    };
    score: number;
    role: string;
    reasons: StorySelectionReason[];
  }>;
  /** Full scored candidate pool from the ranking engine. */
  scoredCandidates: Array<{
    story: {
      id: string;
      title: string;
      description: string;
      source: string;
      url: string | null;
      publishedAt: string | null;
      imageUrl?: string | null;
      pool: string;
    };
    score: number;
    reasons: StorySelectionReason[];
  }>;
  localScoreThreshold?: number;
  /** Front-page keys from recent editions — prefer a Lead the reader hasn’t seen. */
  recentStoryKeys?: string[];
};

export type LeadStoryPolicy = {
  preferWeekendFeature?: boolean;
  /** When true, lead may be omitted from Top Stories by the editor engine. */
  excludeFromBelowFold?: boolean;
  editionMode?: string;
};
