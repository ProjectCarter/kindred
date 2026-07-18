/**
 * Fetch the shared U.S. national daily row — one Today in History image per date.
 * Public read; cached in-memory for the session so every city shares one lookup.
 */

import { supabase } from "../supabase";
import {
  parseUsNationalDailyRow,
  US_NATIONAL_COUNTRY_CODE,
  type UsNationalDailyRecord,
} from "./usNationalDaily.ts";
import {
  articleIdentityFromNationalDaily,
  imageIdentityFromAsset,
  logTodayInHistorySyncTrace,
} from "./todayInHistorySync.ts";
import { todayInHistoryImageFromNationalDaily } from "./todayInHistoryImage.ts";

const memoryByDate = new Map<string, UsNationalDailyRecord | null>();
const inflightByDate = new Map<string, Promise<UsNationalDailyRecord | null>>();

export async function fetchUsNationalDailyByDate(
  editionDate: string
): Promise<UsNationalDailyRecord | null> {
  const date = editionDate?.trim();
  if (!date) return null;

  if (memoryByDate.has(date)) {
    return memoryByDate.get(date) ?? null;
  }

  const existing = inflightByDate.get(date);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("kindred_us_national_daily")
      .select(
        "id, edition_date, country_code, today_masterpiece, today_in_history, national_news"
      )
      .eq("edition_date", date)
      .eq("country_code", US_NATIONAL_COUNTRY_CODE)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        console.warn("[nationalDaily:fetch] query failed", {
          editionDate: date,
          message: error.message,
        });
      }
      memoryByDate.set(date, null);
      return null;
    }

    const record = data ? parseUsNationalDailyRow(data) : null;
    memoryByDate.set(date, record);
    if (record) {
      const article = articleIdentityFromNationalDaily(record);
      const image = todayInHistoryImageFromNationalDaily(record);
      logTodayInHistorySyncTrace({
        step: "national_daily_record",
        editionDate: date,
        usNationalDailyId: record.id,
        article: article ?? {
          sectionId: null,
          year: null,
          headline: null,
          fingerprint: "missing",
        },
        image: imageIdentityFromAsset(image, {
          source: image ? "national_daily" : null,
          nationalDailyId: record.id,
          year: record.todayInHistory?.year ?? null,
        }),
        synced: Boolean(article && image),
        reason: article && image ? null : "incomplete_national_daily",
      });
    }
    return record;
  })();

  inflightByDate.set(date, promise);
  try {
    return await promise;
  } finally {
    inflightByDate.delete(date);
  }
}

/** Test helper — reset session cache between cases. */
export function clearUsNationalDailyFetchCache(): void {
  memoryByDate.clear();
  inflightByDate.clear();
}
