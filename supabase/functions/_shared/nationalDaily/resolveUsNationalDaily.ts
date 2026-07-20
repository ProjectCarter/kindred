/**
 * Shared U.S. national daily editorial layer — one Masterpiece + Today in History per date.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { HeroArtworkSelectionContext } from "../heroArtwork/types.ts";
import {
  resolveProductionMorningHero,
} from "../heroArtwork/production.ts";
import type { MorningHeroExperience } from "../heroArtwork/presentation.ts";
import { writeTodayInHistorySection } from "../history/writeTodayInHistory.ts";
import { buildTodayInHistoryGrounding } from "../knowledge/providers/synthesize.ts";
import type { TodayInHistorySelection } from "../history/selectStory.ts";
import type { HistoricalImageAsset } from "../history/types.ts";
import { historicalImageMatchesEvent } from "../history/imageEventMatch.ts";
import { getFrozenHeroArtworkSelection } from "../heroArtwork/library.ts";
import { resolveUsNationalNews } from "./resolveNationalNews.ts";
import type { UsNationalNewsPackagePayload } from "./types.ts";
import {
  calendarMonthDayFromEditionDate,
  formatNationalDailyValidationFailure,
  nationalDailyValidationPassed,
  priorCalendarEditionDate,
  snapshotFromNationalDailyRow,
  validateNationalDailyForAttach,
} from "./nationalDailyValidation.ts";

export const US_NATIONAL_COUNTRY_CODE = "US" as const;

export type UsNationalTodayInHistoryPayload = {
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
  };
};

export type UsNationalTodayMasterpiecePayload = {
  artworkId: string;
  presentation: MorningHeroExperience;
};

export type UsNationalDailyEditorial = {
  id: string;
  editionDate: string;
  countryCode: typeof US_NATIONAL_COUNTRY_CODE;
  todayMasterpiece: UsNationalTodayMasterpiecePayload | null;
  todayInHistory: UsNationalTodayInHistoryPayload | null;
  nationalNews: UsNationalNewsPackagePayload | null;
  diagnostic: UsNationalDailyDiagnostic;
  nationalNewsDiagnostic?: string | null;
};

export type UsNationalDailyDiagnostic =
  | "national_daily_cache_hit"
  | "national_daily_created"
  | "national_daily_reused"
  | "national_daily_partial_reused";

export type ResolveUsNationalDailyInput = {
  editionDate: string;
  editionTraceId?: string | null;
  anthropicApiKey?: string | null;
  historySelection: TodayInHistorySelection | null;
  onThisDay: { year: number; text: string } | null;
  onThisDayGrounding?: unknown;
  historyImage?: HistoricalImageAsset | null;
  heroContext?: HeroArtworkSelectionContext;
  newsApiKey?: string | null;
  /** Test-only escape hatch — production builds never clone the prior calendar day. */
  allowIdenticalFromPriorDay?: boolean;
};

type NationalDailyRow = {
  id: string;
  edition_date: string;
  country_code: string;
  today_masterpiece: UsNationalTodayMasterpiecePayload | null;
  masterpiece_artwork_id: string | null;
  today_in_history: UsNationalTodayInHistoryPayload | null;
  history_event_key: string | null;
  national_news: UsNationalNewsPackagePayload | null;
};

function historyTeaser(body: string): string {
  const first = body.trim().split(/\n{2,}/)[0]?.trim() ?? "";
  if (!first) return "";
  const words = first.split(/\s+/).filter(Boolean);
  return words.length <= 42 ? first : `${words.slice(0, 42).join(" ")}…`;
}

function parseMasterpiecePayload(
  raw: unknown
): UsNationalTodayMasterpiecePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as {
    artworkId?: string;
    artwork_id?: string;
    presentation?: MorningHeroExperience;
  };
  const presentation = row.presentation ?? null;
  const artworkId =
    row.artworkId?.trim() ||
    row.artwork_id?.trim() ||
    presentation?.artworkId?.trim() ||
    null;
  if (!presentation || !artworkId) return null;
  return { artworkId, presentation };
}

function historyImageVerified(
  history: UsNationalTodayInHistoryPayload | null | undefined
): boolean {
  const image = history?.image;
  if (!image?.url?.trim()) return false;
  if (!history?.year || !history.eventText?.trim()) return false;
  return historicalImageMatchesEvent({
    eventYear: history.year,
    eventText: history.eventText,
    articleBody: history.body ?? history.eventText,
    image,
  });
}

function parseHistoryPayload(raw: unknown): UsNationalTodayInHistoryPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as UsNationalTodayInHistoryPayload;
  if (!row.headline?.trim() || !row.body?.trim()) return null;

  const image = row.image?.url?.trim() ? row.image : null;
  if (image && !historyImageVerified({ ...row, image })) {
    console.warn("[usNationalDaily] rejecting cached history image — event mismatch", {
      year: row.year,
      caption: image.caption?.slice(0, 80) ?? null,
      url: image.url.slice(0, 120),
    });
    return { ...row, image: null };
  }

  return row;
}

async function fetchNationalDailyRow(
  admin: SupabaseClient,
  editionDate: string
): Promise<NationalDailyRow | null> {
  const { data, error } = await admin
    .from("kindred_us_national_daily")
    .select(
      "id, edition_date, country_code, today_masterpiece, masterpiece_artwork_id, today_in_history, history_event_key, national_news"
    )
    .eq("edition_date", editionDate)
    .eq("country_code", US_NATIONAL_COUNTRY_CODE)
    .maybeSingle();

  if (error) {
    console.warn("[usNationalDaily] fetch failed", {
      editionDate,
      message: error.message,
    });
    return null;
  }
  return (data as NationalDailyRow | null) ?? null;
}

function buildHistoryPayload(
  editionDate: string,
  selection: TodayInHistorySelection,
  written: { headline: string; body: string }
): UsNationalTodayInHistoryPayload {
  return {
    year: selection.event.year,
    eventText: selection.event.text,
    headline: written.headline,
    body: written.body,
    teaser: historyTeaser(written.body),
    sourceNote: "Sourced from Wikipedia",
    image: selection.image ?? null,
    selectionMeta: {
      editorialScore: selection.editorialScore,
      imageScore: selection.imageScore,
      candidateCount: selection.candidateCount,
      selectedRank: selection.selectedRank,
      editorNotes: selection.editorNotes,
      calendarMonthDay: calendarMonthDayFromEditionDate(editionDate) ?? undefined,
    },
  };
}

async function fetchNationalDailyValidationContext(
  admin: SupabaseClient,
  editionDate: string
) {
  const priorDate = priorCalendarEditionDate(editionDate);
  const [priorRow, heroSelection] = await Promise.all([
    priorDate ? fetchNationalDailyRow(admin, priorDate) : Promise.resolve(null),
    getFrozenHeroArtworkSelection(admin, editionDate),
  ]);

  return {
    priorDay: priorRow ? snapshotFromNationalDailyRow(priorRow) : null,
    heroSelectionArtworkId: heroSelection?.artworkId ?? null,
  };
}

async function forceClearNationalDailyDesks(
  admin: SupabaseClient,
  editionDate: string,
  clear: { masterpiece?: boolean; history?: boolean; news?: boolean }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (clear.masterpiece) {
    patch.today_masterpiece = null;
    patch.masterpiece_artwork_id = null;
  }
  if (clear.history) {
    patch.today_in_history = null;
    patch.history_event_key = null;
  }
  if (clear.news) {
    patch.national_news = null;
  }
  if (Object.keys(patch).length <= 1) return;

  await admin
    .from("kindred_us_national_daily")
    .upsert(
      {
        edition_date: editionDate,
        country_code: US_NATIONAL_COUNTRY_CODE,
      },
      { onConflict: "edition_date,country_code", ignoreDuplicates: true }
    );

  const { error } = await admin
    .from("kindred_us_national_daily")
    .update(patch)
    .eq("edition_date", editionDate)
    .eq("country_code", US_NATIONAL_COUNTRY_CODE);

  if (error) {
    console.warn("[usNationalDaily] stale desk clear failed", {
      editionDate,
      message: error.message,
      clear,
    });
  }
}

function desksToClearFromValidationIssues(
  issues: ReturnType<typeof validateNationalDailyForAttach>
): { masterpiece?: boolean; history?: boolean; news?: boolean } {
  const codes = new Set(issues.map((issue) => issue.code));
  return {
    masterpiece:
      codes.has("missing_masterpiece") ||
      codes.has("missing_hero_selection") ||
      codes.has("stale_masterpiece_edition_date") ||
      codes.has("identical_masterpiece_from_prior_day") ||
      codes.has("hero_selection_artwork_mismatch"),
    history:
      codes.has("missing_history") ||
      codes.has("history_calendar_month_day_mismatch") ||
      codes.has("identical_history_from_prior_day"),
    news:
      codes.has("missing_national_news") ||
      codes.has("stale_national_news_edition_date") ||
      codes.has("identical_national_news_from_prior_day"),
  };
}

async function validateStoredNationalDaily(
  admin: SupabaseClient,
  row: NationalDailyRow,
  allowIdenticalFromPriorDay = false
): Promise<ReturnType<typeof validateNationalDailyForAttach>> {
  const validationContext = await fetchNationalDailyValidationContext(
    admin,
    row.edition_date
  );
  return validateNationalDailyForAttach({
    row: snapshotFromNationalDailyRow(row),
    heroSelectionArtworkId: validationContext.heroSelectionArtworkId,
    priorDay: validationContext.priorDay,
    allowIdenticalFromPriorDay,
  });
}

async function upsertMasterpiece(
  admin: SupabaseClient,
  editionDate: string,
  morningHero: MorningHeroExperience
): Promise<NationalDailyRow | null> {
  const payload: UsNationalTodayMasterpiecePayload = {
    artworkId: morningHero.artworkId,
    presentation: morningHero,
  };

  const { data, error } = await admin
    .from("kindred_us_national_daily")
    .upsert(
      {
        edition_date: editionDate,
        country_code: US_NATIONAL_COUNTRY_CODE,
        today_masterpiece: payload,
        masterpiece_artwork_id: morningHero.artworkId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "edition_date,country_code" }
    )
    .select(
      "id, edition_date, country_code, today_masterpiece, masterpiece_artwork_id, today_in_history, history_event_key, national_news"
    )
    .maybeSingle();

  if (error) {
    console.warn("[usNationalDaily] masterpiece upsert failed", {
      editionDate,
      message: error.message,
    });
    return fetchNationalDailyRow(admin, editionDate);
  }
  return (data as NationalDailyRow | null) ?? fetchNationalDailyRow(admin, editionDate);
}

async function claimHistoryWrite(
  admin: SupabaseClient,
  editionDate: string,
  history: UsNationalTodayInHistoryPayload
): Promise<boolean> {
  const eventKey = `${history.year}:${history.eventText}`.slice(0, 512);
  const { data, error } = await admin.rpc("claim_us_national_history_write", {
    p_edition_date: editionDate,
    p_country_code: US_NATIONAL_COUNTRY_CODE,
    p_history: history,
    p_event_key: eventKey,
  });

  if (error) {
    console.warn("[usNationalDaily] history claim rpc failed", {
      editionDate,
      message: error.message,
    });
    return false;
  }
  return data === true;
}

function logNationalDaily(
  event: UsNationalDailyDiagnostic | "national_daily_attached_to_city",
  input: {
    traceId?: string | null;
    editionDate: string;
    elapsedMs: number;
    nationalDailyId?: string | null;
    masterpieceArtworkId?: string | null;
    historyEventKey?: string | null;
    metroKey?: string | null;
  }
): void {
  console.log(`[usNationalDaily] ${event}`, {
    traceId: input.traceId ?? null,
    editionDate: input.editionDate,
    elapsedMs: input.elapsedMs,
    nationalDailyId: input.nationalDailyId ?? null,
    masterpieceArtworkId: input.masterpieceArtworkId ?? null,
    historyEventKey: input.historyEventKey ?? null,
    metroKey: input.metroKey ?? null,
  });
}

function parseNationalNewsPayload(raw: unknown): UsNationalNewsPackagePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as UsNationalNewsPackagePayload;
  if (!row.packageId?.trim() || !row.editionDate?.trim()) return null;
  if (!Array.isArray(row.stories) || row.stories.length === 0) return null;
  const stories = row.stories.filter(
    (s) => s?.id?.trim() && s?.headline?.trim() && s?.summary?.trim()
  );
  if (stories.length === 0) return null;
  return { ...row, stories: stories.sort((a, b) => a.rank - b.rank) };
}

/** True when today's shared U.S. layer is fully populated and validated for city attach. */
export async function probeUsNationalDailyCache(
  admin: SupabaseClient,
  editionDate: string
): Promise<boolean> {
  const row = await fetchNationalDailyRow(admin, editionDate);
  if (
    !row ||
    !parseMasterpiecePayload(row.today_masterpiece) ||
    !parseHistoryPayload(row.today_in_history) ||
    !parseNationalNewsPayload(row.national_news)
  ) {
    return false;
  }

  const history = parseHistoryPayload(row.today_in_history);
  if (!history || !historyImageVerified(history)) return false;

  const issues = await validateStoredNationalDaily(admin, row, false);
  return nationalDailyValidationPassed(issues);
}

/** Attach cached national daily only — city workers must never generate national desks. */
export async function loadUsNationalDailyForCityAttach(
  admin: SupabaseClient,
  editionDate: string,
  editionTraceId?: string | null
): Promise<UsNationalDailyEditorial | null> {
  const row = await fetchNationalDailyRow(admin, editionDate);
  const masterpiece = parseMasterpiecePayload(row?.today_masterpiece);
  const history = parseHistoryPayload(row?.today_in_history);
  const nationalNews = parseNationalNewsPayload(row?.national_news);

  if (!row?.id || !masterpiece || !history || !nationalNews || !historyImageVerified(history)) {
    console.warn("[usNationalDaily] city attach cache miss — refusing generation", {
      traceId: editionTraceId ?? null,
      editionDate,
      hasRow: Boolean(row?.id),
      hasMasterpiece: Boolean(masterpiece),
      hasHistory: Boolean(history),
      hasVerifiedHistoryImage: historyImageVerified(history),
      hasNationalNews: Boolean(nationalNews),
    });
    return null;
  }

  const issues = await validateStoredNationalDaily(admin, row, false);
  if (!nationalDailyValidationPassed(issues)) {
    console.warn("[usNationalDaily] city attach rejected — stale or cloned national daily", {
      traceId: editionTraceId ?? null,
      editionDate,
      nationalDailyId: row.id,
      failure: formatNationalDailyValidationFailure(editionDate, issues),
    });
    return null;
  }

  logNationalDaily("national_daily_cache_hit", {
    traceId: editionTraceId ?? null,
    editionDate,
    elapsedMs: 0,
    nationalDailyId: row.id,
    masterpieceArtworkId: masterpiece.artworkId,
    historyEventKey: row.history_event_key,
  });

  return {
    id: row.id,
    editionDate,
    countryCode: US_NATIONAL_COUNTRY_CODE,
    todayMasterpiece: masterpiece,
    todayInHistory: history,
    nationalNews,
    diagnostic: "national_daily_cache_hit",
    nationalNewsDiagnostic: "national_news_cache_hit",
  };
}

export async function resolveUsNationalDailyEditorial(
  admin: SupabaseClient,
  input: ResolveUsNationalDailyInput
): Promise<UsNationalDailyEditorial | null> {
  const started = performance.now();
  const { editionDate } = input;

  let row = await fetchNationalDailyRow(admin, editionDate);
  let masterpiece = parseMasterpiecePayload(row?.today_masterpiece);
  let history = parseHistoryPayload(row?.today_in_history);
  let nationalNews = parseNationalNewsPayload(row?.national_news);
  let diagnostic: UsNationalDailyDiagnostic;
  let nationalNewsDiagnostic: string | null = null;

  if (
    row &&
    masterpiece &&
    history &&
    nationalNews &&
    historyImageVerified(history)
  ) {
    const cacheIssues = await validateStoredNationalDaily(
      admin,
      row,
      input.allowIdenticalFromPriorDay ?? false
    );
    if (nationalDailyValidationPassed(cacheIssues)) {
      diagnostic = "national_daily_cache_hit";
      nationalNewsDiagnostic = "national_news_cache_hit";
      logNationalDaily(diagnostic, {
        traceId: input.editionTraceId,
        editionDate,
        elapsedMs: Math.round(performance.now() - started),
        nationalDailyId: row.id,
        masterpieceArtworkId: masterpiece.artworkId,
        historyEventKey: row.history_event_key,
      });
      return {
        id: row.id,
        editionDate,
        countryCode: US_NATIONAL_COUNTRY_CODE,
        todayMasterpiece: masterpiece,
        todayInHistory: history,
        nationalNews,
        diagnostic,
        nationalNewsDiagnostic,
      };
    }

    console.warn("[usNationalDaily] cached national daily failed validation — regenerating", {
      traceId: input.editionTraceId,
      editionDate,
      nationalDailyId: row.id,
      failure: formatNationalDailyValidationFailure(editionDate, cacheIssues),
    });
    await forceClearNationalDailyDesks(
      admin,
      editionDate,
      desksToClearFromValidationIssues(cacheIssues)
    );
    row = await fetchNationalDailyRow(admin, editionDate);
    masterpiece = parseMasterpiecePayload(row?.today_masterpiece);
    history = parseHistoryPayload(row?.today_in_history);
    const parsedNews = parseNationalNewsPayload(row?.national_news);
    nationalNews =
      parsedNews && parsedNews.editionDate === editionDate ? parsedNews : null;
  }

  if (history && !historyImageVerified(history)) {
    console.warn("[usNationalDaily] re-resolving Today in History — cached image failed verification", {
      traceId: input.editionTraceId,
      editionDate,
      nationalDailyId: row?.id ?? null,
      year: history.year,
    });
    history = null;
  }

  const [resolvedHero, generatedHistory, newsResult] = await Promise.all([
    masterpiece
      ? Promise.resolve(masterpiece.presentation)
      : resolveProductionMorningHero(admin, {
          editionDate,
          context: input.heroContext,
        }),
    history
      ? Promise.resolve(history)
      : (async (): Promise<UsNationalTodayInHistoryPayload | null> => {
          if (!input.historySelection || !input.onThisDay || !input.anthropicApiKey) {
            return null;
          }
          const groundingData = buildTodayInHistoryGrounding(
            input.onThisDay,
            input.onThisDayGrounding as Parameters<typeof buildTodayInHistoryGrounding>[1],
            input.historyImage?.url
              ? {
                  image: input.historyImage,
                  editorNotes: input.historySelection.editorNotes,
                }
              : undefined
          );
          const written = await writeTodayInHistorySection({
            groundingData,
            instruction:
              `Write Today in History as Kindred's signature morning feature — a calm Sunday newspaper ` +
              `story someone would read over coffee for three or four minutes. ` +
              `Write 450–900 words across exactly 6 paragraphs (separated by blank lines). ` +
              `Ground ONLY in the dated event and verified background below.`,
            year: input.onThisDay.year,
            eventText: input.onThisDay.text,
            anthropicApiKey: input.anthropicApiKey,
            varietySeed: editionDate,
          });
          return buildHistoryPayload(editionDate, input.historySelection, written);
        })(),
    nationalNews
      ? Promise.resolve({
          package: nationalNews,
          nationalDailyId: row?.id ?? null,
          diagnostic: "national_news_cache_hit" as const,
        })
      : resolveUsNationalNews(admin, {
          editionDate,
          editionTraceId: input.editionTraceId,
          newsApiKey: input.newsApiKey,
          anthropicApiKey: input.anthropicApiKey,
          nationalDailyId: row?.id ?? null,
        }),
  ]);

  let createdAny = false;

  if (!masterpiece && resolvedHero) {
    row = await upsertMasterpiece(admin, editionDate, resolvedHero);
    masterpiece = parseMasterpiecePayload(row?.today_masterpiece);
    createdAny = true;
  }

  if (!history && generatedHistory) {
    const claimed = await claimHistoryWrite(admin, editionDate, generatedHistory);
    row = await fetchNationalDailyRow(admin, editionDate);
    history = parseHistoryPayload(row?.today_in_history) ?? (claimed ? generatedHistory : null);
    if (history) createdAny = true;
  }

  nationalNews = newsResult.package ?? parseNationalNewsPayload(row?.national_news);
  nationalNewsDiagnostic = newsResult.diagnostic;

  if (!row?.id) {
    row = await fetchNationalDailyRow(admin, editionDate);
  }

  masterpiece = masterpiece ?? parseMasterpiecePayload(row?.today_masterpiece);
  history = history ?? parseHistoryPayload(row?.today_in_history);
  nationalNews = nationalNews ?? parseNationalNewsPayload(row?.national_news);

  if (!row) {
    logNationalDaily("national_daily_partial_reused", {
      traceId: input.editionTraceId,
      editionDate,
      elapsedMs: Math.round(performance.now() - started),
    });
    return null;
  }

  const finalIssues = await validateStoredNationalDaily(
    admin,
    row,
    input.allowIdenticalFromPriorDay ?? false
  );
  if (!nationalDailyValidationPassed(finalIssues)) {
    console.warn("[usNationalDaily] generation finished but validation failed", {
      traceId: input.editionTraceId,
      editionDate,
      nationalDailyId: row.id,
      failure: formatNationalDailyValidationFailure(editionDate, finalIssues),
    });
    return null;
  }

  diagnostic = createdAny ? "national_daily_created" : "national_daily_reused";
  if (!createdAny && (masterpiece || history)) {
    diagnostic = "national_daily_reused";
  }

  logNationalDaily(diagnostic, {
    traceId: input.editionTraceId,
    editionDate,
    elapsedMs: Math.round(performance.now() - started),
    nationalDailyId: row.id,
    masterpieceArtworkId: masterpiece?.artworkId ?? null,
    historyEventKey: row.history_event_key,
  });

  return {
    id: row.id,
    editionDate,
    countryCode: US_NATIONAL_COUNTRY_CODE,
    todayMasterpiece: masterpiece,
    todayInHistory: history,
    nationalNews,
    diagnostic,
    nationalNewsDiagnostic,
  };
}

export function logNationalDailyAttachedToCity(input: {
  traceId?: string | null;
  editionDate: string;
  nationalDailyId: string;
  metroKey?: string | null;
  masterpieceArtworkId?: string | null;
  elapsedMs?: number;
}): void {
  logNationalDaily("national_daily_attached_to_city", {
    ...input,
    elapsedMs: input.elapsedMs ?? 0,
  });
}
