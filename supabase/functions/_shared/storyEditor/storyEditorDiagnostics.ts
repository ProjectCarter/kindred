/**
 * Story Editor acceptance diagnostics — development-safe, no model payloads.
 */

import type { StoryEditorIntake, StoryEditorResult } from "./types.ts";
import type { ValidationIssue } from "./validators.ts";
import { isFactIntegrityIssue, wordCount } from "./validators.ts";

export type StoryEditorSelectedPath =
  | "full"
  | "accepted_thin"
  | "thin_honest"
  | "unavailable";

export type StoryEditorDiagnostic = {
  storyId: string;
  sourceWordCount: number;
  sourceTitle: string;
  hasDescriptionOrContent: boolean;
  modelExecutionSuccess: boolean;
  validationIssueCodes: string[];
  remainingIssues: string[];
  factIssues: string[];
  returnedStoryType: string | null;
  populatedFieldAnswers: string[];
  paragraphCount: number;
  selectedPath: StoryEditorSelectedPath;
  recordedAt: string;
};

export function buildStoryEditorDiagnostic(input: {
  intake: StoryEditorIntake;
  issues: ValidationIssue[];
  draft?: {
    storyType?: string | null;
    fieldAnswers?: Record<string, string | undefined> | null;
    paragraphs?: string[];
  } | null;
  modelExecutionSuccess: boolean;
  selectedPath: StoryEditorSelectedPath;
  sourceHasDistinctDescription: boolean;
}): StoryEditorDiagnostic {
  const factIssues = input.issues
    .filter((i) => isFactIntegrityIssue(i.code))
    .map((i) => i.code);
  const remainingIssues = input.issues.map((i) => i.code);
  const fieldAnswers = input.draft?.fieldAnswers ?? {};
  const populatedFieldAnswers = Object.entries(fieldAnswers)
    .filter(([, value]) => typeof value === "string" && value.trim().length >= 12)
    .map(([key]) => key);

  return {
    storyId: input.intake.id,
    sourceWordCount: wordCount(input.intake.sourceText),
    sourceTitle: input.intake.headline,
    hasDescriptionOrContent: input.sourceHasDistinctDescription,
    modelExecutionSuccess: input.modelExecutionSuccess,
    validationIssueCodes: remainingIssues,
    remainingIssues,
    factIssues,
    returnedStoryType: input.draft?.storyType?.trim() || null,
    populatedFieldAnswers,
    paragraphCount: input.draft?.paragraphs?.length ?? 0,
    selectedPath: input.selectedPath,
    recordedAt: new Date().toISOString(),
  };
}

export function attachStoryEditorDiagnostic(
  result: StoryEditorResult,
  diagnostic: StoryEditorDiagnostic
): StoryEditorResult {
  return {
    ...result,
    desk: {
      ...result.desk,
      editorDiagnostic: diagnostic,
    },
  };
}

export function logStoryEditorDiagnostic(
  surface: string,
  diagnostic: StoryEditorDiagnostic
): void {
  console.log("[storyEditor:diagnostic]", {
    surface,
    storyId: diagnostic.storyId.slice(0, 48),
    sourceWordCount: diagnostic.sourceWordCount,
    hasDescriptionOrContent: diagnostic.hasDescriptionOrContent,
    modelExecutionSuccess: diagnostic.modelExecutionSuccess,
    selectedPath: diagnostic.selectedPath,
    factIssues: diagnostic.factIssues,
    remainingIssues: diagnostic.remainingIssues,
    returnedStoryType: diagnostic.returnedStoryType,
    populatedFieldAnswers: diagnostic.populatedFieldAnswers,
    paragraphCount: diagnostic.paragraphCount,
  });
}
