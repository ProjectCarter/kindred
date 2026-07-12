/**
 * Kindred Story Editor — public edge module.
 */

export type {
  ConsultationPack,
  StoryEditorDeskMeta,
  StoryEditorIntake,
  StoryEditorLesson,
  StoryEditorResult,
  StoryEditorScores,
  StorySurfaceRole,
} from "./types.ts";
export { STORY_EDITOR_MAX_PASSES, STORY_EDITOR_SCORE_KEYS } from "./types.ts";
export { buildConsultationPack } from "./consultation.ts";
export { runStoryEditor, runStoryEditorSafe } from "./runStoryEditor.ts";
export {
  validateStoryDraft,
  isThinSource,
  allScoresAreFive,
} from "./validators.ts";
