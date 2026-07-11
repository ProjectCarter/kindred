/**
 * Newspaper Editor AI — reusable editorial decision contracts.
 * Elite publications curate; they do not merely rank.
 * Every future section (Lead, Top Stories, Sports, Science, etc.)
 * should ask this engine why a story belongs in the paper.
 */

export type EditionMode =
  | "weekday_morning"
  | "saturday_weekend"
  | "sunday_weekend";

export type EditorialTone =
  | "uplifting"
  | "neutral"
  | "heavy"
  | "breaking"
  | "feature";

export type EditorialGeoScope = "local" | "national" | "world" | "mixed";

export type EditorialDecisionCode =
  | "lead_of_the_day"
  | "national_desk"
  | "world_desk"
  | "local_desk"
  | "interest_desk"
  | "feature_balance"
  | "breaking_desk"
  | "weekend_leisure"
  | "weekday_brief"
  | "emotional_counterweight"
  | "source_diversity"
  | "topic_diversity"
  | "freshness"
  | "morning_relevance"
  | "personalization_soft"
  | "editorial_integrity";

export type EditorialWhyChosen = {
  code: EditorialDecisionCode;
  label: string;
  weight: number;
};

/** Calendar + daypart framing for the morning paper. */
export type EditorialCalendar = {
  editionDate: string;
  dayOfWeek: number;
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  mode: EditionMode;
  /** Soft label for grounding / Bandit. */
  modeLabel: string;
};

/**
 * Policy an experienced editor would apply when assembling the page.
 * Soft preferences — selection may relax when the pool is thin.
 */
export type EditorialPolicy = {
  mode: EditionMode;
  maxStories: number;
  /** Preferred role fill order. */
  roleOrder: Array<
    "national" | "interest" | "local" | "feature" | "breaking" | "world"
  >;
  similarityLimit: number;
  freshnessSoftHours: number;
  freshnessHardHours: number;
  breakingMinScore: number;
  /** Prefer at least one feature / uplift on heavy pages. */
  requireEmotionalBalance: boolean;
  /** Soft max heavy/doom stories on the slate (excluding optional breaking). */
  maxHeavyStories: number;
  /** Prefer world desk presence on weekday mornings. */
  preferWorldBalance: boolean;
  /** Weekend editions lean feature / leisure earlier. */
  preferLeisureTone: boolean;
  /** Soft morning relevance boost hours. */
  morningFreshHours: number;
  /** Personalization may influence but never override wire quality floors. */
  personalizationIntegrityCap: number;
  /** Lead should not also sit in Top Stories when possible. */
  leadDistinctFromSlate: boolean;
};

export type EditorialDecisionRecord = {
  storyId: string;
  title: string;
  role: string;
  geo: EditorialGeoScope;
  tone: EditorialTone;
  why: EditorialWhyChosen[];
};

export type EditorialDecisionSummary = {
  version: 1;
  calendar: EditorialCalendar;
  policy: {
    mode: EditionMode;
    modeLabel: string;
    requireEmotionalBalance: boolean;
    maxHeavyStories: number;
    preferLeisureTone: boolean;
  };
  lead: EditorialDecisionRecord | null;
  slate: EditorialDecisionRecord[];
  editorNotes: string[];
};
