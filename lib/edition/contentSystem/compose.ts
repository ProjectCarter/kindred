/**
 * Compose magazine desk modules from a template + field answers.
 * Empty answers are omitted — never invent Yelp-style filler.
 */

import { getContentTemplate } from "./registry";
import type {
  ContentType,
  EditorialFieldAnswers,
  EditorialModule,
} from "./types";

/**
 * Build editorial modules for the reader.
 * Only fields with real prose are included.
 */
export function composeEditorialModules(
  type: ContentType,
  answers: EditorialFieldAnswers | null | undefined
): EditorialModule[] {
  if (!answers) return [];
  const template = getContentTemplate(type);
  const modules: EditorialModule[] = [];

  for (const field of template.fields) {
    const raw = answers[field.id];
    const body = typeof raw === "string" ? raw.trim() : "";
    if (!body) continue;
    if (body.length < 12) continue;
    modules.push({
      id: field.id,
      label: field.label,
      body,
    });
  }

  return modules;
}

/**
 * Soft-seed one primary desk note from a discovery dek —
 * story-adjacent atmosphere, not a fake fact sheet.
 */
export function seedAnswersFromDek(
  type: ContentType,
  dek: string | null | undefined
): EditorialFieldAnswers {
  const text = dek?.trim() || "";
  if (text.length < 20) return {};

  // Only seed story-adjacent fields — never invent trail stats or menus from a dek.
  const primaryByType: Partial<Record<ContentType, string>> = {
    coffee: "atmosphere",
    restaurant: "ambience",
    bakery: "atmosphere",
    park: "best_for",
    beach: "character",
    museum: "dont_miss",
    attraction: "what_to_expect",
    hidden_gem: "why_go",
    festival: "what_to_expect",
    local_event: "what_to_expect",
    travel: "why_go",
    recommendation: "why_today",
    science: "why_it_matters",
    history: "why_remember",
    news: "why_now",
    local_news: "who_affected",
  };

  const fieldId = primaryByType[type];
  if (!fieldId) return {};
  return { [fieldId]: text };
}
