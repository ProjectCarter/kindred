/**
 * Minimum viable edition — core desks that unlock first paint.
 * Optional desks (Bandit's Pick, Activities, Recommendations, Masterpiece)
 * may arrive later via background refresh.
 */

import type { EditionSection } from "./types";

export type MinimumViableAssessment = {
  paintable: boolean;
  reasons: string[];
};

export function assessMinimumViableEdition(
  sections: Pick<EditionSection, "section_type">[]
): MinimumViableAssessment {
  const types = sections.map((s) => s.section_type);
  const reasons: string[] = [];

  if (types.length === 0) {
    reasons.push("no edition_sections");
    return { paintable: false, reasons };
  }

  const hasCoreDesk =
    types.includes("today_in_history") ||
    types.includes("story_of") ||
    types.includes("your_city") ||
    types.includes("local_events") ||
    types.includes("weather");

  if (!hasCoreDesk) {
    reasons.push("no core desk section");
    return { paintable: false, reasons };
  }

  return { paintable: true, reasons };
}

/** True when a processing row already has enough sections to open the folio. */
export function isProcessingEditionPaintable(
  status: string | null | undefined,
  sections: Pick<EditionSection, "section_type">[]
): boolean {
  if (status === "ready") return sections.length > 0;
  if (status !== "processing") return false;
  return assessMinimumViableEdition(sections).paintable;
}
