/**
 * Shared U.S. national daily editorial — client types and compatibility helpers.
 * City editions copy from this layer; cached rows without a reference still render.
 */

import type { MorningHeroExperience } from "./heroArtwork/types";
import type { HistoricalImageAsset } from "./knowledgeGrounding";
import type { NationalNewsPackage } from "./nationalNewsTypes.ts";
import { parseNationalNewsPackage } from "./nationalNewsTypes.ts";

export const US_NATIONAL_COUNTRY_CODE = "US" as const;

export type UsNationalTodayInHistory = {
  year: number;
  eventText: string;
  headline: string;
  body: string;
  teaser: string;
  sourceNote: string;
  image: HistoricalImageAsset | null;
  selectionMeta: {
    editorialScore: number;
    imageScore: number;
    candidateCount: number;
    selectedRank: number;
    editorNotes: string[];
    calendarMonthDay?: string;
  } | null;
};

export type UsNationalTodayMasterpiece = {
  artworkId: string;
  presentation: MorningHeroExperience;
};

export type UsNationalDailyRecord = {
  id: string;
  editionDate: string;
  countryCode: typeof US_NATIONAL_COUNTRY_CODE;
  todayMasterpiece: UsNationalTodayMasterpiece | null;
  todayInHistory: UsNationalTodayInHistory | null;
  nationalNews: NationalNewsPackage | null;
};

export function historyTeaserFromBody(body: string, maxWords = 42): string {
  const firstParagraph = body.trim().split(/\n{2,}/)[0]?.trim() ?? "";
  if (!firstParagraph) return "";
  const words = firstParagraph.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return firstParagraph;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function parseUsNationalDailyRow(row: {
  id: string;
  edition_date: string;
  country_code: string;
  today_masterpiece?: unknown;
  today_in_history?: unknown;
  national_news?: unknown;
}): UsNationalDailyRecord | null {
  if (!row?.id || !row.edition_date) return null;

  const masterpieceRaw = row.today_masterpiece as
    | { artworkId?: string; artwork_id?: string; presentation?: MorningHeroExperience }
    | null
    | undefined;
  const presentation = masterpieceRaw?.presentation ?? null;
  const artworkId =
    masterpieceRaw?.artworkId?.trim() ||
    masterpieceRaw?.artwork_id?.trim() ||
    presentation?.artworkId?.trim() ||
    null;

  const todayMasterpiece =
    presentation && artworkId
      ? { artworkId, presentation }
      : null;

  const historyRaw = row.today_in_history as UsNationalTodayInHistory | null | undefined;
  const todayInHistory =
    historyRaw?.headline?.trim() && historyRaw?.body?.trim()
      ? historyRaw
      : null;

  return {
    id: row.id,
    editionDate: row.edition_date,
    countryCode: US_NATIONAL_COUNTRY_CODE,
    todayMasterpiece,
    todayInHistory,
    nationalNews: parseNationalNewsPackage(row.national_news),
  };
}

/** True when a national row has both desks needed for parity checks. */
export function isCompleteUsNationalDaily(record: UsNationalDailyRecord | null): boolean {
  return Boolean(record?.todayMasterpiece?.artworkId && record?.todayInHistory?.headline);
}
