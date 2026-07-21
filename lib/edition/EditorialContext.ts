/**
 * Edition editorial intelligence — client contract.
 * Metadata is stored on editions.editorial_context and is not rendered yet.
 */

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
    /** Single-story body when this item is a Top Stories entry. */
    summary?: string;
    dek?: string | null;
    /** Story Editor paragraphs when present. */
    body?: string[];
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
    sourceDiversity?: boolean;
    topicDiversity?: boolean;
    geoBalance?: boolean;
  };
  editorBrief: string;
};

export type EditorialAIUseCase =
  | "bandit_greeting"
  | "weekly_picks"
  | "why_this_story"
  | "personalized_recommendations"
  | "audio_introduction";

export {
  editorialContextForAI,
  type EditorialAISlice,
} from "./editorialAi.ts";

import { editorialContextForAI } from "./editorialAi.ts";

/** Parse stored jsonb from editions.editorial_context. */
export function parseEditorialContext(
  value: unknown
): EditionEditorialContext | null {
  if (!value || typeof value !== "object") return null;
  const ctx = value as EditionEditorialContext;
  if (ctx.version !== 1 || !Array.isArray(ctx.sections)) return null;
  return ctx;
}

export function notesForSection(
  context: EditionEditorialContext,
  sectionType: string
): SectionEditorialNotes | null {
  return context.sections.find((s) => s.sectionType === sectionType) ?? null;
}

export const EditorialContextService = {
  parseEditorialContext,
  editorialContextForAI,
  notesForSection,
};

export default EditorialContextService;
