/**
 * End-to-end verification: two consecutive calendar days through the
 * national daily production pipeline (generate → validate → city attach).
 *
 * Usage:
 *   npx deno run --allow-env --allow-net --allow-read \
 *     scripts/verify-national-daily-consecutive-days.ts
 */

import { createServiceClient } from "../supabase/functions/_shared/buildEdition.ts";
import { generateUsNationalDailyForEditionDate } from "../supabase/functions/_shared/nationalDaily/generateUsNationalDaily.ts";
import {
  loadUsNationalDailyForCityAttach,
  US_NATIONAL_COUNTRY_CODE,
} from "../supabase/functions/_shared/nationalDaily/resolveUsNationalDaily.ts";
import {
  calendarMonthDayFromEditionDate,
  formatNationalDailyValidationFailure,
  nationalDailyValidationPassed,
  snapshotFromNationalDailyRow,
  stableJsonFingerprint,
  validateNationalDailyForAttach,
} from "../lib/edition/nationalDailyValidation.ts";
import { upsertEditionSection } from "../supabase/functions/_shared/edition/upsertEditionSection.ts";
import { editionsConflictTarget } from "../supabase/functions/_shared/markets/editionIdentity.ts";

async function loadLocalEnv(): Promise<void> {
  try {
    const raw = await Deno.readTextFile(".env.local");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!Deno.env.get(key)) Deno.env.set(key, value);
    }
  } catch {
    /* optional */
  }
}

type StageFailure = {
  ok: false;
  stage: string;
  editionDate: string;
  message: string;
  details?: Record<string, unknown>;
};

type DaySnapshot = {
  editionDate: string;
  nationalDailyId: string;
  masterpieceArtworkId: string | null;
  masterpieceTitle: string | null;
  masterpieceEditionDate: string | null;
  historyHeadline: string | null;
  historyCalendarMonthDay: string | null;
  historyEventKey: string | null;
  nationalNewsEditionDate: string | null;
  nationalNewsPackageId: string | null;
  heroSelectionArtworkId: string | null;
  masterpieceFingerprint: string;
  historyFingerprint: string;
  newsFingerprint: string;
  cityEditionId: string | null;
  cityNationalDailyId: string | null;
  cityMasterpieceTitle: string | null;
  cityHistoryHeadline: string | null;
};

function fail(
  stage: string,
  editionDate: string,
  message: string,
  details?: Record<string, unknown>
): StageFailure {
  return { ok: false, stage, editionDate, message, details };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

await loadLocalEnv();

if (!Deno.env.get("SUPABASE_URL")?.trim()) {
  Deno.env.set(
    "SUPABASE_URL",
    Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ??
      "https://zdqjeocdsbdzecawumdp.supabase.co"
  );
}

if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()) {
  Deno.env.set(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk"
  );
}

const requiredSecrets = ["SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY"];
for (const key of requiredSecrets) {
  if (!Deno.env.get(key)?.trim()) {
    console.error(JSON.stringify(fail("preflight", "", `${key} missing`)));
    Deno.exit(1);
  }
}

if (!Deno.env.get("NEWS_API_KEY")?.trim()) {
  console.warn(
    "[verify-national-daily] NEWS_API_KEY not in local env — national news generation may fail unless set in Supabase Edge secrets and run via deployed worker"
  );
}

const admin = createServiceClient();
const userId =
  Deno.env.get("USER_ID") ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const metroKey = Deno.env.get("AUDIT_METRO_KEY")?.trim() ?? "phoenix-az";
const dates = ["2026-07-19", "2026-07-20"] as const;
const traceId = `verify-national-${Date.now()}`;
const snapshots: DaySnapshot[] = [];

console.log("[verify-national-daily] starting", {
  dates,
  metroKey,
  userId,
  traceId,
});

const { count: heroLibraryCount } = await admin
  .from("kindred_hero_artwork")
  .select("id", { count: "exact", head: true })
  .eq("status", "ready");

console.log("[verify-national-daily] hero library ready count", {
  heroLibraryCount: heroLibraryCount ?? 0,
});

for (const editionDate of dates) {
  console.log(`[verify-national-daily] --- ${editionDate} ---`);

  // STAGE: generate_national_daily
  let generated;
  try {
    generated = await generateUsNationalDailyForEditionDate(admin, {
      editionDate,
      editionTraceId: traceId,
      anthropicApiKey: Deno.env.get("ANTHROPIC_API_KEY")!.trim(),
      newsApiKey: Deno.env.get("NEWS_API_KEY")?.trim() ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify(
        fail("generate_national_daily", editionDate, message),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  // STAGE: fetch_national_row
  const { data: nationalRow, error: nationalError } = await admin
    .from("kindred_us_national_daily")
    .select(
      "id, edition_date, today_masterpiece, masterpiece_artwork_id, today_in_history, history_event_key, national_news"
    )
    .eq("edition_date", editionDate)
    .eq("country_code", US_NATIONAL_COUNTRY_CODE)
    .maybeSingle();

  if (nationalError || !nationalRow?.id) {
    console.error(
      JSON.stringify(
        fail(
          "fetch_national_row",
          editionDate,
          nationalError?.message ?? "national row missing after generation"
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  // STAGE: validate_national_row
  const { data: heroSelection } = await admin
    .from("kindred_hero_artwork_edition_selections")
    .select("artwork_id")
    .eq("edition_date", editionDate)
    .maybeSingle();

  const priorDate =
    editionDate === "2026-07-19"
      ? "2026-07-18"
      : dates[dates.indexOf(editionDate) - 1] ?? null;

  const { data: priorRow } = priorDate
    ? await admin
        .from("kindred_us_national_daily")
        .select(
          "edition_date, today_masterpiece, masterpiece_artwork_id, today_in_history, history_event_key, national_news"
        )
        .eq("edition_date", priorDate)
        .eq("country_code", US_NATIONAL_COUNTRY_CODE)
        .maybeSingle()
    : { data: null };

  const validationIssues = validateNationalDailyForAttach({
    row: snapshotFromNationalDailyRow(nationalRow),
    heroSelectionArtworkId: heroSelection?.artwork_id ?? null,
    priorDay: priorRow ? snapshotFromNationalDailyRow(priorRow) : null,
    allowIdenticalFromPriorDay: false,
  });

  if (!nationalDailyValidationPassed(validationIssues)) {
    console.error(
      JSON.stringify(
        fail(
          "validate_national_row",
          editionDate,
          formatNationalDailyValidationFailure(editionDate, validationIssues),
          { issues: validationIssues }
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  const masterpieceRaw = nationalRow.today_masterpiece as {
    presentation?: { editionDate?: string; artworkTitle?: string };
  } | null;
  const historyRaw = nationalRow.today_in_history as {
    headline?: string;
    selectionMeta?: { calendarMonthDay?: string };
  } | null;
  const newsRaw = nationalRow.national_news as {
    editionDate?: string;
    packageId?: string;
  } | null;

  const masterpieceEditionDate = readString(masterpieceRaw?.presentation?.editionDate);
  const nationalNewsEditionDate = readString(newsRaw?.editionDate);
  const historyCalendarMonthDay = readString(
    historyRaw?.selectionMeta?.calendarMonthDay
  );
  const expectedMonthDay = calendarMonthDayFromEditionDate(editionDate);

  if (masterpieceEditionDate !== editionDate) {
    console.error(
      JSON.stringify(
        fail(
          "embedded_edition_date_check",
          editionDate,
          `masterpiece.presentation.editionDate=${masterpieceEditionDate ?? "null"}`
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  if (nationalNewsEditionDate !== editionDate) {
    console.error(
      JSON.stringify(
        fail(
          "embedded_edition_date_check",
          editionDate,
          `national_news.editionDate=${nationalNewsEditionDate ?? "null"}`
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  if (historyCalendarMonthDay !== expectedMonthDay) {
    console.error(
      JSON.stringify(
        fail(
          "history_calendar_month_day_check",
          editionDate,
          `expected ${expectedMonthDay}, got ${historyCalendarMonthDay ?? "null"}`
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  // STAGE: attach_readiness
  const attachReady = await loadUsNationalDailyForCityAttach(
    admin,
    editionDate,
    traceId
  );
  if (!attachReady) {
    console.error(
      JSON.stringify(
        fail(
          "attach_readiness",
          editionDate,
          "loadUsNationalDailyForCityAttach returned null"
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  // STAGE: attach_national_daily (city edition)
  const { data: editionRow, error: editionError } = await admin
    .from("editions")
    .upsert(
      {
        user_id: userId,
        edition_date: editionDate,
        metro_key: metroKey,
        status: "processing",
      },
      { onConflict: editionsConflictTarget() }
    )
    .select("id")
    .single();

  if (editionError || !editionRow?.id) {
    console.error(
      JSON.stringify(
        fail(
          "attach_national_daily",
          editionDate,
          editionError?.message ?? "edition upsert failed"
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  const editionId = editionRow.id as string;
  const morningHero = attachReady.todayMasterpiece?.presentation ?? null;
  const { error: attachUpdateError } = await admin
    .from("editions")
    .update({
      us_national_daily_id: attachReady.id,
      national_news: attachReady.nationalNews,
      morning_edition: morningHero
        ? {
            morningHero,
            heroArtworkId: attachReady.todayMasterpiece?.artworkId ?? null,
          }
        : null,
    })
    .eq("id", editionId);

  if (attachUpdateError) {
    console.error(
      JSON.stringify(
        fail(
          "attach_national_daily",
          editionDate,
          attachUpdateError.message
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  if (attachReady.todayInHistory) {
    await upsertEditionSection(admin, {
      edition_id: editionId,
      section_type: "today_in_history",
      position: 4,
      headline: attachReady.todayInHistory.headline,
      body: attachReady.todayInHistory.body,
      source_note: attachReady.todayInHistory.sourceNote,
    });
  }

  const { data: attachedEdition, error: attachedReadError } = await admin
    .from("editions")
    .select("id, us_national_daily_id, morning_edition, national_news")
    .eq("id", editionId)
    .maybeSingle();

  if (attachedReadError || !attachedEdition) {
    console.error(
      JSON.stringify(
        fail(
          "verify_city_attach",
          editionDate,
          attachedReadError?.message ?? "attached edition missing"
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  if (attachedEdition.us_national_daily_id !== attachReady.id) {
    console.error(
      JSON.stringify(
        fail(
          "verify_city_attach",
          editionDate,
          `edition.us_national_daily_id=${attachedEdition.us_national_daily_id ?? "null"}`
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }

  const { data: historySection } = await admin
    .from("edition_sections")
    .select("headline")
    .eq("edition_id", editionId)
    .eq("section_type", "today_in_history")
    .maybeSingle();

  const cityMorning = attachedEdition.morning_edition as {
    morningHero?: { artworkTitle?: string; editionDate?: string };
  } | null;

  snapshots.push({
    editionDate,
    nationalDailyId: nationalRow.id,
    masterpieceArtworkId: nationalRow.masterpiece_artwork_id,
    masterpieceTitle: readString(masterpieceRaw?.presentation?.artworkTitle),
    masterpieceEditionDate,
    historyHeadline: readString(historyRaw?.headline),
    historyCalendarMonthDay,
    historyEventKey: readString(nationalRow.history_event_key),
    nationalNewsEditionDate,
    nationalNewsPackageId: readString(newsRaw?.packageId),
    heroSelectionArtworkId: heroSelection?.artwork_id ?? null,
    masterpieceFingerprint: stableJsonFingerprint(nationalRow.today_masterpiece),
    historyFingerprint: stableJsonFingerprint(nationalRow.today_in_history),
    newsFingerprint: stableJsonFingerprint(nationalRow.national_news),
    cityEditionId: editionId,
    cityNationalDailyId: attachedEdition.us_national_daily_id,
    cityMasterpieceTitle: readString(cityMorning?.morningHero?.artworkTitle),
    cityHistoryHeadline: readString(historySection?.headline),
  });

  console.log("[verify-national-daily] day complete", {
    editionDate,
    nationalDailyId: nationalRow.id,
    masterpieceArtworkId: nationalRow.masterpiece_artwork_id,
    masterpieceTitle: masterpieceRaw?.presentation?.artworkTitle ?? null,
    historyHeadline: historyRaw?.headline ?? null,
    historyCalendarMonthDay,
    generatedDiagnostic: generated.diagnostic,
  });
}

// STAGE: consecutive_day_comparison
const [july19, july20] = snapshots;
if (!july19 || !july20) {
  console.error(JSON.stringify(fail("consecutive_day_comparison", "", "missing snapshots")));
  Deno.exit(1);
}

const comparisons: Array<{ check: string; pass: boolean; detail: string }> = [
  {
    check: "distinct_national_daily_ids",
    pass: july19.nationalDailyId !== july20.nationalDailyId,
    detail: `${july19.nationalDailyId} vs ${july20.nationalDailyId}`,
  },
  {
    check: "history_calendar_month_day_differs",
    pass:
      july19.historyCalendarMonthDay === "07-19" &&
      july20.historyCalendarMonthDay === "07-20",
    detail: `${july19.historyCalendarMonthDay} vs ${july20.historyCalendarMonthDay}`,
  },
  {
    check: "history_headline_differs",
    pass:
      Boolean(july19.historyHeadline) &&
      Boolean(july20.historyHeadline) &&
      july19.historyHeadline !== july20.historyHeadline,
    detail: `${july19.historyHeadline} vs ${july20.historyHeadline}`,
  },
  {
    check: "history_json_not_identical",
    pass: july19.historyFingerprint !== july20.historyFingerprint,
    detail: "history fingerprint match",
  },
  {
    check: "national_news_json_not_identical",
    pass: july19.newsFingerprint !== july20.newsFingerprint,
    detail: "news fingerprint match",
  },
  {
    check: "city_editions_receive_distinct_national_ids",
    pass:
      july19.cityNationalDailyId !== july20.cityNationalDailyId &&
      july19.cityNationalDailyId === july19.nationalDailyId &&
      july20.cityNationalDailyId === july20.nationalDailyId,
    detail: `${july19.cityNationalDailyId} vs ${july20.cityNationalDailyId}`,
  },
  {
    check: "app_would_show_different_history",
    pass:
      Boolean(july19.cityHistoryHeadline) &&
      Boolean(july20.cityHistoryHeadline) &&
      july19.cityHistoryHeadline !== july20.cityHistoryHeadline,
    detail: `${july19.cityHistoryHeadline} vs ${july20.cityHistoryHeadline}`,
  },
];

if ((heroLibraryCount ?? 0) > 1) {
  comparisons.push({
    check: "masterpiece_rotates_when_library_has_alternatives",
    pass:
      Boolean(july19.masterpieceArtworkId) &&
      Boolean(july20.masterpieceArtworkId) &&
      july19.masterpieceArtworkId !== july20.masterpieceArtworkId,
    detail: `${july19.masterpieceArtworkId} vs ${july20.masterpieceArtworkId}`,
  });
  comparisons.push({
    check: "masterpiece_json_not_identical",
    pass: july19.masterpieceFingerprint !== july20.masterpieceFingerprint,
    detail: "masterpiece fingerprint match",
  });
  comparisons.push({
    check: "app_would_show_different_masterpiece",
    pass:
      Boolean(july19.cityMasterpieceTitle) &&
      Boolean(july20.cityMasterpieceTitle) &&
      july19.cityMasterpieceTitle !== july20.cityMasterpieceTitle,
    detail: `${july19.cityMasterpieceTitle} vs ${july20.cityMasterpieceTitle}`,
  });
} else {
  comparisons.push({
    check: "masterpiece_rotation_skipped_single_artwork_library",
    pass: true,
    detail: `hero library ready count=${heroLibraryCount ?? 0}`,
  });
}

for (const comparison of comparisons) {
  if (!comparison.pass) {
    console.error(
      JSON.stringify(
        fail(
          "consecutive_day_comparison",
          "2026-07-19/2026-07-20",
          `${comparison.check} failed — ${comparison.detail}`,
          { comparisons }
        ),
        null,
        2
      )
    );
    Deno.exit(1);
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      stage: "complete",
      traceId,
      heroLibraryCount,
      snapshots,
      comparisons,
    },
    null,
    2
  )
);
