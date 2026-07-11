/**
 * Bandit — shared contracts for Edge + app.
 * Warm, concise, optimistic. Never overwhelming.
 * Reusable across greetings, notes, weekly picks, travel, special editions.
 */

export type BanditOccasion =
  | "morning"
  | "birthday"
  | "travel"
  | "seasonal"
  | "holiday"
  | "special_edition"
  | "weekly"
  | "editorial_note";

export type BanditMomentKind =
  | "morning_greeting"
  | "editorial_note"
  | "weekly_recommendation"
  | "seasonal_message"
  | "birthday"
  | "travel"
  | "special_edition";

/** One calm Bandit utterance for a surface in the app. */
export type BanditMoment = {
  kind: BanditMomentKind;
  occasion: BanditOccasion;
  /** Primary line shown to the reader (1–2 short sentences). */
  line: string;
  /** Invisible notes for future Bandit features / AI. */
  notes?: string[];
  generatedAt: string;
};

/**
 * Stored on editions.bandit — morning is shown today;
 * other fields reserve architecture for future surfaces (no new sections).
 */
export type BanditPayload = {
  version: 1;
  morning: BanditMoment;
  weekly: BanditMoment | null;
  seasonal: BanditMoment | null;
  editorialNotes: string[];
  /** Occasions detected for this edition (debug / future UI). */
  occasions: BanditOccasion[];
};

export type BanditReaderProfile = {
  firstName?: string | null;
  birthdayMMDD?: string | null;
  homeCity?: string | null;
  homeRegion?: string | null;
  homeState?: string | null;
  travel?: {
    away?: boolean;
    city?: string | null;
    until?: string | null;
    note?: string | null;
  } | null;
};

export type BanditComposeInput = {
  editionDate: string;
  now?: Date;
  reader: BanditReaderProfile;
  location: {
    city: string | null;
    region?: string | null;
    state?: string | null;
  };
  weatherSummary?: string | null;
  signals?: {
    hasBreakingNews?: boolean;
    hasLocalEvents?: boolean;
    weatherChange?: boolean;
    holidayTomorrow?: string | null;
    primaryInterests?: string[];
  };
  /** Compact editorial brief from EditionEditorialContext. */
  editorBrief?: string | null;
  personalization?: {
    favoriteSources?: string[];
    confidence?: number;
  };
  /** Discovery Engine brief — Bandit's Picks / Weekend Ideas (no UI required). */
  discoveryBrief?: string | null;
  discoveryPicks?: Array<{ title: string; category: string; why: string }>;
};
