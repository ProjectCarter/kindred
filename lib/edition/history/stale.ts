/**
 * Detect placeholder Today in History copy stored in edition_sections.
 */

import type { EditionSection } from "../types";

const YEAR_HEADLINE_RE = /^(1[0-9]{3}|20[0-9]{2})\s*[\u2014\u2013-]\s*/;
const GENERIC_HEADLINE_RE =
  /^(today in history|on this day|this day in history|historical note)\b/i;

const STALE_BODY_MARKERS = [/rus flight 9633/i, /chkalovsky airport/i];

function wordCount(text: string): number {
  return text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

export function isStaleTodayInHistorySection(
  section: EditionSection | null | undefined
): boolean {
  if (!section || section.section_type !== "today_in_history") return false;

  const body = section.body?.trim() ?? "";
  const headline = section.headline?.trim() ?? "";
  if (!body) return true;

  if (STALE_BODY_MARKERS.some((re) => re.test(body))) return true;

  const words = wordCount(body);
  if (words < 200) return true;

  if (!YEAR_HEADLINE_RE.test(headline) || GENERIC_HEADLINE_RE.test(headline)) {
    return true;
  }

  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length < 2) return true;

  return false;
}

export function needsTodayInHistoryRecovery(sections: EditionSection[]): boolean {
  const history = sections.find((s) => s.section_type === "today_in_history");
  return isStaleTodayInHistorySection(history);
}
