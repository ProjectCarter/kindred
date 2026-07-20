/**
 * Shared U.S. national daily attach validation — editionDate alignment,
 * hero freeze, and consecutive-day clone detection.
 */

export type NationalDailyValidationSnapshot = {
  editionDate: string;
  todayMasterpiece: unknown;
  todayInHistory: unknown;
  nationalNews: unknown;
  masterpieceArtworkId?: string | null;
  historyEventKey?: string | null;
};

export type NationalDailyAttachValidationInput = {
  row: NationalDailyValidationSnapshot;
  heroSelectionArtworkId?: string | null;
  priorDay?: NationalDailyValidationSnapshot | null;
  allowIdenticalFromPriorDay?: boolean;
};

export type NationalDailyValidationIssue = {
  code: string;
  message: string;
};

const EDITION_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function priorCalendarEditionDate(editionDate: string): string | null {
  const match = editionDate.match(EDITION_DATE_RE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function calendarMonthDayFromEditionDate(editionDate: string): string | null {
  const match = editionDate.match(EDITION_DATE_RE);
  if (!match) return null;
  return `${match[2]}-${match[3]}`;
}

export function stableJsonFingerprint(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function readPresentationEditionDate(todayMasterpiece: unknown): string | null {
  if (!todayMasterpiece || typeof todayMasterpiece !== "object") return null;
  const row = todayMasterpiece as {
    presentation?: { editionDate?: string | null };
  };
  const editionDate = row.presentation?.editionDate?.trim();
  return editionDate || null;
}

function readNationalNewsEditionDate(nationalNews: unknown): string | null {
  if (!nationalNews || typeof nationalNews !== "object") return null;
  const editionDate = (nationalNews as { editionDate?: string | null }).editionDate?.trim();
  return editionDate || null;
}

function readHistoryCalendarMonthDay(todayInHistory: unknown): string | null {
  if (!todayInHistory || typeof todayInHistory !== "object") return null;
  const meta = (todayInHistory as {
    selectionMeta?: { calendarMonthDay?: string | null };
  }).selectionMeta;
  const monthDay = meta?.calendarMonthDay?.trim();
  return monthDay || null;
}

export function validateNationalDailyForAttach(
  input: NationalDailyAttachValidationInput
): NationalDailyValidationIssue[] {
  const issues: NationalDailyValidationIssue[] = [];
  const { row, priorDay, allowIdenticalFromPriorDay = false } = input;
  const editionDate = row.editionDate;

  if (!row.todayMasterpiece) {
    issues.push({ code: "missing_masterpiece", message: "today_masterpiece is missing" });
  }
  if (!row.todayInHistory) {
    issues.push({ code: "missing_history", message: "today_in_history is missing" });
  }
  if (!row.nationalNews) {
    issues.push({ code: "missing_national_news", message: "national_news is missing" });
  }

  const masterpieceEditionDate = readPresentationEditionDate(row.todayMasterpiece);
  if (row.todayMasterpiece && masterpieceEditionDate !== editionDate) {
    issues.push({
      code: "stale_masterpiece_edition_date",
      message: `masterpiece.presentation.editionDate must be ${editionDate}, got ${masterpieceEditionDate ?? "null"}`,
    });
  }

  const nationalNewsEditionDate = readNationalNewsEditionDate(row.nationalNews);
  if (row.nationalNews && nationalNewsEditionDate !== editionDate) {
    issues.push({
      code: "stale_national_news_edition_date",
      message: `national_news.editionDate must be ${editionDate}, got ${nationalNewsEditionDate ?? "null"}`,
    });
  }

  const expectedMonthDay = calendarMonthDayFromEditionDate(editionDate);
  const historyMonthDay = readHistoryCalendarMonthDay(row.todayInHistory);
  if (row.todayInHistory && expectedMonthDay && historyMonthDay !== expectedMonthDay) {
    issues.push({
      code: "history_calendar_month_day_mismatch",
      message: `today_in_history selectionMeta.calendarMonthDay must be ${expectedMonthDay}, got ${historyMonthDay ?? "null"}`,
    });
  }

  if (!input.heroSelectionArtworkId?.trim()) {
    issues.push({
      code: "missing_hero_selection",
      message: `kindred_hero_artwork_edition_selections row missing for ${editionDate}`,
    });
  } else if (
    row.masterpieceArtworkId &&
    input.heroSelectionArtworkId !== row.masterpieceArtworkId
  ) {
    issues.push({
      code: "hero_selection_artwork_mismatch",
      message: `hero selection artwork ${input.heroSelectionArtworkId} does not match masterpiece_artwork_id ${row.masterpieceArtworkId}`,
    });
  }

  if (priorDay && !allowIdenticalFromPriorDay) {
    if (
      row.todayMasterpiece &&
      priorDay.todayMasterpiece &&
      stableJsonFingerprint(row.todayMasterpiece) ===
        stableJsonFingerprint(priorDay.todayMasterpiece)
    ) {
      issues.push({
        code: "identical_masterpiece_from_prior_day",
        message: `today_masterpiece is identical to ${priorDay.editionDate}`,
      });
    }
    if (
      row.todayInHistory &&
      priorDay.todayInHistory &&
      stableJsonFingerprint(row.todayInHistory) ===
        stableJsonFingerprint(priorDay.todayInHistory)
    ) {
      issues.push({
        code: "identical_history_from_prior_day",
        message: `today_in_history is identical to ${priorDay.editionDate}`,
      });
    }
    if (
      row.nationalNews &&
      priorDay.nationalNews &&
      stableJsonFingerprint(row.nationalNews) === stableJsonFingerprint(priorDay.nationalNews)
    ) {
      issues.push({
        code: "identical_national_news_from_prior_day",
        message: `national_news is identical to ${priorDay.editionDate}`,
      });
    }
  }

  return issues;
}

export function nationalDailyValidationPassed(
  issues: readonly NationalDailyValidationIssue[]
): boolean {
  return issues.length === 0;
}

export function formatNationalDailyValidationFailure(
  editionDate: string,
  issues: readonly NationalDailyValidationIssue[]
): string {
  const summary = issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
  return `National daily validation failed for ${editionDate} — ${summary}`;
}

export function snapshotFromNationalDailyRow(row: {
  edition_date: string;
  today_masterpiece?: unknown;
  today_in_history?: unknown;
  national_news?: unknown;
  masterpiece_artwork_id?: string | null;
  history_event_key?: string | null;
}): NationalDailyValidationSnapshot {
  return {
    editionDate: row.edition_date,
    todayMasterpiece: row.today_masterpiece ?? null,
    todayInHistory: row.today_in_history ?? null,
    nationalNews: row.national_news ?? null,
    masterpieceArtworkId: row.masterpiece_artwork_id ?? null,
    historyEventKey: row.history_event_key ?? null,
  };
}
