/**
 * Generate the shared U.S. national daily layer for one calendar date.
 * Runs before city editions attach — never clones yesterday's payload.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { fetchOnThisDayCandidates } from "../history/onThisDay.ts";
import { selectTodayInHistoryStory } from "../history/selectStory.ts";
import { getFrozenHeroArtworkSelection } from "../heroArtwork/library.ts";
import type { HeroArtworkSelectionContext } from "../heroArtwork/types.ts";
import {
  formatNationalDailyValidationFailure,
  nationalDailyValidationPassed,
  priorCalendarEditionDate,
  snapshotFromNationalDailyRow,
  validateNationalDailyForAttach,
  type NationalDailyValidationSnapshot,
} from "./nationalDailyValidation.ts";
import {
  resolveUsNationalDailyEditorial,
  US_NATIONAL_COUNTRY_CODE,
  type UsNationalDailyEditorial,
} from "./resolveUsNationalDaily.ts";
import { getSeason, parseEditionDate } from "../heroArtwork/select.ts";

const BLOCKED_EVENTS = [/rus flight 9633/i, /chkalovsky/i];

export type GenerateUsNationalDailyInput = {
  editionDate: string;
  editionTraceId?: string | null;
  anthropicApiKey: string;
  newsApiKey: string;
  heroContext?: HeroArtworkSelectionContext;
  allowIdenticalFromPriorDay?: boolean;
};

type NationalDailyRow = {
  edition_date: string;
  today_masterpiece: unknown;
  masterpiece_artwork_id: string | null;
  today_in_history: unknown;
  history_event_key: string | null;
  national_news: unknown;
};

async function fetchNationalDailyRow(
  admin: SupabaseClient,
  editionDate: string
): Promise<NationalDailyRow | null> {
  const { data, error } = await admin
    .from("kindred_us_national_daily")
    .select(
      "edition_date, today_masterpiece, masterpiece_artwork_id, today_in_history, history_event_key, national_news"
    )
    .eq("edition_date", editionDate)
    .eq("country_code", US_NATIONAL_COUNTRY_CODE)
    .maybeSingle();

  if (error) {
    console.warn("[usNationalDaily:generate] fetch failed", {
      editionDate,
      message: error.message,
    });
    return null;
  }
  return (data as NationalDailyRow | null) ?? null;
}

async function loadValidationContext(
  admin: SupabaseClient,
  editionDate: string
): Promise<{
  priorDay: NationalDailyValidationSnapshot | null;
  heroSelectionArtworkId: string | null;
}> {
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

function defaultHeroContext(editionDate: string): HeroArtworkSelectionContext {
  const month = parseEditionDate(editionDate).getMonth() + 1;
  return {
    date: editionDate,
    season: getSeason(month),
  };
}

export async function generateUsNationalDailyForEditionDate(
  admin: SupabaseClient,
  input: GenerateUsNationalDailyInput
): Promise<UsNationalDailyEditorial> {
  const { editionDate } = input;

  const candidates = (await fetchOnThisDayCandidates(editionDate)).filter(
    (candidate) => !BLOCKED_EVENTS.some((pattern) => pattern.test(candidate.text))
  );
  if (!candidates.length) {
    throw new Error(`No Wikipedia On This Day candidates for ${editionDate}`);
  }

  const historySelection = await selectTodayInHistoryStory({
    candidates,
    nowYear: Number(editionDate.slice(0, 4)) || new Date().getFullYear(),
  });
  if (!historySelection?.event) {
    throw new Error(`No Today in History selection for ${editionDate}`);
  }

  const editorial = await resolveUsNationalDailyEditorial(admin, {
    editionDate,
    editionTraceId: input.editionTraceId ?? null,
    anthropicApiKey: input.anthropicApiKey,
    newsApiKey: input.newsApiKey,
    historySelection,
    onThisDay: historySelection.event,
    historyImage: historySelection.image ?? null,
    heroContext: input.heroContext ?? defaultHeroContext(editionDate),
    allowIdenticalFromPriorDay: input.allowIdenticalFromPriorDay ?? false,
  });

  if (!editorial?.todayMasterpiece || !editorial.todayInHistory || !editorial.nationalNews) {
    throw new Error(`National daily generation incomplete for ${editionDate}`);
  }

  const row = await fetchNationalDailyRow(admin, editionDate);
  if (!row) {
    throw new Error(`National daily row missing after generation for ${editionDate}`);
  }

  const validationContext = await loadValidationContext(admin, editionDate);
  const issues = validateNationalDailyForAttach({
    row: snapshotFromNationalDailyRow(row),
    heroSelectionArtworkId: validationContext.heroSelectionArtworkId,
    priorDay: validationContext.priorDay,
    allowIdenticalFromPriorDay: input.allowIdenticalFromPriorDay ?? false,
  });

  if (!nationalDailyValidationPassed(issues)) {
    throw new Error(formatNationalDailyValidationFailure(editionDate, issues));
  }

  return editorial;
}

export { loadValidationContext };
