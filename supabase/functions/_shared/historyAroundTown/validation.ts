import type { HistoryPlaceRow, HistoryPlaceValidationStatus } from "./types.ts";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isApprovedHistoryPlace(row: HistoryPlaceRow): boolean {
  if (row.validation_status === "rejected") return false;
  if (row.approval_status === "rejected") return false;
  if (!row.place_name?.trim()) return false;
  if (!row.editorial_teaser?.trim()) return false;
  if (!row.story_body?.trim()) return false;
  if (countWords(row.story_body) < 120) return false;
  if (!row.closing_note?.trim()) return false;
  if (!row.hosted_url?.trim() && !row.image_url?.trim()) return false;
  if (!row.image_source_url?.trim()) return false;
  if (!row.image_credit?.trim()) return false;
  if (!row.image_license?.trim()) return false;
  if (row.source_provider?.trim()?.toLowerCase() === "ai") return false;
  if (row.lat == null || row.lon == null) return false;
  if (!row.history_summary?.trim()) return false;
  if (!row.why_it_matters?.trim()) return false;
  if (!Array.isArray(row.interesting_facts) || row.interesting_facts.length < 1) {
    return false;
  }
  return row.approval_status === "approved";
}

export function computeHistoryPlaceValidationStatus(
  row: HistoryPlaceRow
): HistoryPlaceValidationStatus {
  if (row.approval_status === "rejected") return "rejected";
  return isApprovedHistoryPlace(row) ? "approved" : "needs_review";
}
