export type EditorialNoteCategory =
  | "breaking"
  | "interest"
  | "local"
  | "editorial"
  | "lifestyle"
  | "weather"
  | "calendar"
  | "traffic"
  | "event"
  | "feature"
  | "history"
  | "greeting";

export type EditorialNote = {
  code: string;
  label: string;
  category: EditorialNoteCategory;
  weight?: number;
};

export type SectionEditorialNotes = {
  sectionType: string;
  notes: EditorialNote[];
  items?: Array<{
    id?: string;
    title: string;
    role?: string;
    notes: EditorialNote[];
    /** Single-story body for Top Stories — never a mashup of unrelated wires. */
    summary?: string;
    dek?: string | null;
    source?: string | null;
    url?: string | null;
    imageUrl?: string | null;
    publishedAt?: string | null;
  }>;
};

export type EditionEditorialContext = {
  version: 1;
  editionDate: string;
  generatedAt: string;
  location: {
    city: string | null;
    region: string | null;
    state: string | null;
  };
  profile: {
    interests: string[];
    followedTopics: string[];
  };
  /** Optional personalization summary for future Bandit / Weekly Picks. */
  personalization?: {
    favoriteSources: string[];
    skippedTopics: string[];
    confidence: number;
  };
  sections: SectionEditorialNotes[];
  signals: {
    hasBreakingNews: boolean;
    hasLocalEvents: boolean;
    weatherChange: boolean;
    holidayTomorrow: string | null;
    majorLocalEventTomorrow: boolean;
    primaryInterests: string[];
    /** Editorial composition quality signals (invisible). */
    sourceDiversity?: boolean;
    topicDiversity?: boolean;
    geoBalance?: boolean;
  };
  /** Compact brief for future AI writers (Bandit, audio, Weekly Picks). */
  editorBrief: string;
};

export type BuildEditorialContextInput = {
  editionDate: string;
  location: {
    city: string | null;
    region?: string | null;
    state?: string | null;
  };
  interests: string[];
  followedTopics?: string[];
  favoriteSources?: string[];
  skippedTopics?: string[];
  personalizationConfidence?: number;
  weather?: {
    currentTempC?: number | null;
    todayHighC?: number | null;
    todayLowC?: number | null;
    tomorrowHighC?: number | null;
    tomorrowLowC?: number | null;
  } | null;
  frontPage?: {
    stories: Array<{
      id?: string;
      title: string;
      /** Wire or Story Editor body for this single story. */
      description?: string;
      dek?: string | null;
      url?: string | null;
      imageUrl?: string | null;
      role: string;
      score: number;
      source: string;
      reasons: Array<{ code: string; label: string; weight: number }>;
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
    } | null;
    editorialDecisions?: unknown;
  } | null;
  localEvents?: Array<{
    name: string;
    startDateTime: string;
    venue: string;
    city: string;
  }> | null;
  onThisDay?: { year: number; text: string } | null;
  discovery?: {
    picks: Array<{
      title: string;
      category: string;
      surface: string;
      why: string;
    }>;
    surfaces: string[];
    editorNotes: string[];
  } | null;
  knowledge?: {
    storyCount: number;
    facetCount: number;
    highlights: Array<{
      storyKey: string;
      headline: string;
      facetType: string;
      why: string;
    }>;
    editorNotes: string[];
  } | null;
  memory?: {
    threadCount: number;
    continuityDays: number;
    sinceYouLastRead: {
      title: string;
      summary: string;
      daysAway: number | null;
      highlights: string[];
    } | null;
    highlights: Array<{
      threadId: string;
      type: string;
      title: string;
      why: string;
    }>;
    editorNotes: string[];
  } | null;
  morningEdition?: {
    usedEngines: string[];
    polishedWithAi: boolean;
    openingPreview: string;
    briefingPreview: string;
    editorNotes: string[];
  } | null;
  now?: Date;
};
