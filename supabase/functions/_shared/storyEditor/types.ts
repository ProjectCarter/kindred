/**
 * Kindred Story Editor — contracts for the editorial heart of the paper.
 * Transforms truthful reporting into exceptional reading.
 * Constitutions: Story Standard · Memorability · Global Language · Learning-ready.
 */

export type StorySurfaceRole =
  | "lead"
  | "top_story"
  | "top_stories_section"
  | "bandits_pick"
  | "discovery"
  | "knowledge"
  | "desk_section";

export type StoryEditorLocale = string; // BCP-47, e.g. "en", "es", "ja"

export type StoryEditorScores = {
  interest: number;
  curiosity: number;
  flow: number;
  human_connection: number;
  learning: number;
  memorability: number;
  reader_satisfaction: number;
};

export type StoryEditorLesson = {
  changeType:
    | "opening"
    | "delete_para"
    | "reorder"
    | "ending"
    | "curiosity"
    | "human_focus"
    | "insight"
    | "clarity"
    | "other";
  rationale: string;
  principleIds: string[];
};

/** Handed to the Story Editor before rewrite — Learning Engine fills this later. */
export type ConsultationPack = {
  principles: Array<{ id: string; title: string; guidance: string }>;
  playbookHints: string[];
  avoidPatterns: string[];
  readerNotes: string[];
  confidence: number;
};

export type StoryEditorIntake = {
  id: string;
  headline: string;
  /** Wire / reporter text — closed world of facts. */
  sourceText: string;
  source: string;
  url?: string | null;
  publishedAt?: string | null;
  surfaceRole: StorySurfaceRole;
  locale?: StoryEditorLocale;
  /** Optional prior draft for rewrite passes. */
  priorDraft?: {
    headline: string;
    dek?: string | null;
    paragraphs: string[];
  } | null;
  selectionWhy?: string[];
  consultation?: ConsultationPack | null;
};

export type StoryEditorDeskMeta = {
  version: 1;
  path: "full" | "thin_honest" | "fallback_wire";
  locale: StoryEditorLocale;
  scores: StoryEditorScores;
  voluntaryFinish: boolean;
  memorableInsight: string | null;
  passes: number;
  lessons: StoryEditorLesson[];
  constitutions: {
    storyStandard: boolean;
    memorability: boolean;
    globalLanguage: boolean;
    learningReady: boolean;
  };
  fourQuestions: {
    what: string;
    why: string;
    who: string;
    remember: string;
    limits: string[];
  };
  editedAt: string;
};

export type StoryEditorResult = {
  headline: string;
  dek: string | null;
  paragraphs: string[];
  /** Joined body for legacy `summary` fields. */
  bodyText: string;
  pullQuote: string | null;
  desk: StoryEditorDeskMeta;
  ok: boolean;
};

export const STORY_EDITOR_SCORE_KEYS: Array<keyof StoryEditorScores> = [
  "interest",
  "curiosity",
  "flow",
  "human_connection",
  "learning",
  "memorability",
  "reader_satisfaction",
];

/** Infrastructure breaker — editorial intent is excellence; builds must finish. */
export const STORY_EDITOR_MAX_PASSES = 4;
