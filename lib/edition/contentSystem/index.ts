/**
 * Kindred Universal Content System
 *
 * Every future piece of content resolves a template, then may carry
 * magazine-style desk modules that answer the questions readers ask —
 * without becoming a database listing.
 */

export type {
  ContentType,
  ContentTemplate,
  EditorialFieldSpec,
  EditorialModule,
  EditorialFieldAnswers,
} from "./types";

export {
  CONTENT_TEMPLATES,
  getContentTemplate,
  allContentTypes,
} from "./registry";

export {
  resolveContentType,
  isContentType,
  categoryLabelForType,
  type ResolveContentTypeInput,
} from "./resolve";

export {
  composeEditorialModules,
  seedAnswersFromDek,
} from "./compose";

import { composeEditorialModules, seedAnswersFromDek } from "./compose";
import { getContentTemplate } from "./registry";
import { resolveContentType, type ResolveContentTypeInput } from "./resolve";
import type {
  ContentType,
  EditorialFieldAnswers,
  EditorialModule,
} from "./types";

export type ApplyContentSystemResult = {
  contentType: ContentType;
  categoryLabel: string;
  modules: EditorialModule[];
};

/**
 * Single entry — resolve template and compose modules for any content.
 */
export function applyContentSystem(input: {
  resolve: ResolveContentTypeInput;
  answers?: EditorialFieldAnswers | null;
  /** When answers are thin, seed one desk note from this dek. */
  seedDek?: string | null;
}): ApplyContentSystemResult {
  const contentType = resolveContentType(input.resolve);
  const template = getContentTemplate(contentType);
  const seeded =
    input.answers && Object.keys(input.answers).length > 0
      ? input.answers
      : seedAnswersFromDek(contentType, input.seedDek);
  const modules = composeEditorialModules(contentType, seeded);

  return {
    contentType,
    categoryLabel: template.categoryLabel,
    modules,
  };
}
