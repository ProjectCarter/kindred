/**
 * Server mirror — minimum desks before status=ready (early publish path).
 */

export type EditionSectionRow = {
  section_type: string;
};

export function assessMinimumViableEdition(
  sections: EditionSectionRow[]
): { paintable: boolean; reasons: string[] } {
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
