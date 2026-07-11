/**
 * Morning Edition AI — calm newspaper editor before the reader opens the paper.
 * Composes personalized openings from Editorial, Personalization, Discovery,
 * Knowledge, Memory, and Bandit — reusable for audio, widgets, notifications,
 * lock screen, Watch, Auto, CarPlay, and voice assistants.
 *
 * Does not redesign the newspaper or add sections.
 */

export type MorningBriefingLength =
  | "opening_20s"
  | "briefing_60s"
  | "overview_3m";

/** Future delivery channels that should reuse this engine. */
export type MorningEditionChannel =
  | "audio"
  | "widget"
  | "notification"
  | "lock_screen"
  | "watch"
  | "android_auto"
  | "carplay"
  | "voice_assistant"
  | "in_app";

export type MorningBriefing = {
  length: MorningBriefingLength;
  text: string;
  paragraphs: string[];
  estimatedSeconds: number;
  wordCount: number;
};

/**
 * Editorial beats — the editor’s talking points before prose is written.
 * Surfaces can pick beats without re-running the full briefing.
 */
export type MorningEditionBeats = {
  welcome: string | null;
  leadWhy: string | null;
  overnight: string | null;
  continuing: string | null;
  balance: string | null;
  local: string | null;
  weather: string | null;
  seasonal: string | null;
  weekendTone: string | null;
  discoveries: string | null;
  knowledge: string | null;
  memory: string | null;
  bandit: string | null;
};

export type MorningEditionPayload = {
  version: 1;
  generatedAt: string;
  editionDate: string;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
  };
  /** Bandit’s short greeting — preserved for surfaces that show it alone. */
  banditLine: string | null;
  beats: MorningEditionBeats;
  briefings: Record<MorningBriefingLength, MorningBriefing>;
  /** Default for in-app / audio if no length chosen. */
  defaultLength: MorningBriefingLength;
  channelHints: MorningEditionChannel[];
  editorBrief: string;
  selectionMeta: {
    usedEngines: string[];
    polishedWithAi: boolean;
    editorNotes: string[];
  };
};

export type MorningEditionLeadInput = {
  headline: string;
  summary?: string | null;
  role?: string | null;
  source?: string | null;
  strategy?: string | null;
  reasons?: Array<{ code: string; label: string; weight: number }>;
};

export type MorningEditionComposeInput = {
  editionDate: string;
  now?: Date;
  location: {
    city: string | null;
    region?: string | null;
    state?: string | null;
  };
  reader?: {
    firstName?: string | null;
  };
  /** weekday | weekend labels from Newspaper Editor. */
  editionMode?: string | null;
  modeLabel?: string | null;
  isWeekend?: boolean;
  isSunday?: boolean;
  weatherSummary?: string | null;
  signals?: {
    hasBreakingNews?: boolean;
    hasLocalEvents?: boolean;
    weatherChange?: boolean;
    holidayTomorrow?: string | null;
    primaryInterests?: string[];
    sourceDiversity?: boolean;
    topicDiversity?: boolean;
    geoBalance?: boolean;
  };
  lead?: MorningEditionLeadInput | null;
  topStoryHeadlines?: string[];
  editorialNotes?: string[];
  editorBrief?: string | null;
  personalization?: {
    interests?: string[];
    favoriteSources?: string[];
    confidence?: number;
  };
  discoveryBrief?: string | null;
  discoveryPicks?: Array<{ title: string; category: string; why: string }>;
  knowledgeBrief?: string | null;
  knowledgeHighlights?: Array<{
    headline: string;
    facetType: string;
    why: string;
  }>;
  memoryBrief?: string | null;
  sinceYouLastRead?: {
    title: string;
    summary: string;
    daysAway: number | null;
    highlights: string[];
  } | null;
  continuityDays?: number;
  unfinishedTitles?: string[];
  localEvents?: Array<{ name: string; venue?: string; city?: string }>;
  onThisDay?: { year: number; text: string } | null;
  banditLine?: string | null;
  seasonHint?: string | null;
};
