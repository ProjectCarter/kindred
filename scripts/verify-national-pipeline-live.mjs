/**
 * Live consecutive-day verification through deployed Edge secrets +
 * production stage modules (generate_national_daily → attach_national_daily).
 *
 * Usage:
 *   node scripts/verify-national-pipeline-live.mjs
 */

import { createClient } from "@supabase/supabase-js";
import {
  calendarMonthDayFromEditionDate,
  formatNationalDailyValidationFailure,
  nationalDailyValidationPassed,
  snapshotFromNationalDailyRow,
  stableJsonFingerprint,
  validateNationalDailyForAttach,
} from "../lib/edition/nationalDailyValidation.ts";
import { invokeEdgeViaVault } from "./lib/vaultEdgeInvoke.mjs";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID =
  process.env.USER_ID ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const METRO_KEY = process.env.AUDIT_METRO_KEY ?? "phoenix-az";
const DATES = ["2026-07-19", "2026-07-20"];
const LOCATION = {
  city: "Gilbert",
  state: "AZ",
  region: "AZ",
  lat: 33.3528,
  lon: -111.789,
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(stage, editionDate, message, details = undefined) {
  return { ok: false, stage, editionDate, message, details };
}

async function invokeNationalStageOnEdge(editionDate, traceId) {
  const body = {
    userId: USER_ID,
    editionDate,
    metroKey: METRO_KEY,
    editionTraceId: traceId,
    temperatureUnit: "fahrenheit",
    locationHint: LOCATION,
  };

  const vault = invokeEdgeViaVault("process-user-edition-job", body, {
    timeoutMs: 900_000,
  });
  if (!vault.ok) {
    return {
      status: 500,
      body: { error: vault.stderr || vault.stdout || "vault invoke failed" },
    };
  }

  const { job, completed, failed } = await waitForStages(editionDate, [
    "generate_national_daily",
    "attach_national_daily",
  ]);

  if (failed || !completed.includes("generate_national_daily")) {
    return {
      status: 500,
      body: { error: job?.last_error ?? "generate_national_daily incomplete" },
    };
  }
  if (!completed.includes("attach_national_daily")) {
    return {
      status: 500,
      body: { error: job?.last_error ?? "attach_national_daily incomplete" },
    };
  }

  return { status: 200, body: { ok: true, completedStages: completed } };
}

async function resetJobForNationalOnly(editionDate) {
  const { error: editionError } = await admin
    .from("editions")
    .update({
      status: "processing",
      us_national_daily_id: null,
      morning_edition: null,
      national_news: null,
    })
    .eq("user_id", USER_ID)
    .eq("edition_date", editionDate)
    .eq("metro_key", METRO_KEY);
  if (editionError) throw new Error(editionError.message);

  const { error } = await admin.from("generation_jobs").upsert(
    {
      user_id: USER_ID,
      edition_date: editionDate,
      metro_key: METRO_KEY,
      status: "pending",
      attempts: 0,
      last_error: null,
      build_stage: null,
      completed_stages: [],
      stage_diagnostics: [],
      build_state: {},
      stage_started_at: null,
      edition_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,edition_date,metro_key" }
  );
  if (error) throw new Error(error.message);
}

async function waitForStages(editionDate, requiredStages, timeoutMs = 900_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data: job } = await admin
      .from("generation_jobs")
      .select("status, build_stage, completed_stages, last_error")
      .eq("user_id", USER_ID)
      .eq("edition_date", editionDate)
      .eq("metro_key", METRO_KEY)
      .maybeSingle();

    const completed = job?.completed_stages ?? [];
    const hasAll = requiredStages.every((stage) => completed.includes(stage));
    if (hasAll) return { job, completed };

    if (job?.status === "failed") {
      return { job, completed, failed: true };
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Timed out waiting for stages on ${editionDate}`);
}

async function loadNationalRow(editionDate) {
  const { data, error } = await admin
    .from("kindred_us_national_daily")
    .select(
      "id, edition_date, today_masterpiece, masterpiece_artwork_id, today_in_history, history_event_key, national_news"
    )
    .eq("edition_date", editionDate)
    .eq("country_code", "US")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadCityEdition(editionDate) {
  const { data, error } = await admin
    .from("editions")
    .select("id, us_national_daily_id, morning_edition, national_news, status")
    .eq("user_id", USER_ID)
    .eq("edition_date", editionDate)
    .eq("metro_key", METRO_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function loadHistorySection(editionId) {
  const { data } = await admin
    .from("edition_sections")
    .select("headline")
    .eq("edition_id", editionId)
    .eq("section_type", "today_in_history")
    .maybeSingle();
  return data;
}

async function main() {
  console.log("[verify-national-pipeline-live] starting", {
    dates: DATES,
    metroKey: METRO_KEY,
    userId: USER_ID,
  });

  const snapshots = [];

  for (const editionDate of DATES) {
    console.log(`\n=== ${editionDate} ===`);

    // STAGE: preflight_existing_row (July 19 clone should fail before regen)
    const before = await loadNationalRow(editionDate);
    if (before) {
      const priorDate =
        editionDate === "2026-07-19"
          ? "2026-07-18"
          : DATES[DATES.indexOf(editionDate) - 1];
      const priorRow = priorDate ? await loadNationalRow(priorDate) : null;
      const { data: heroBefore } = await admin
        .from("kindred_hero_artwork_edition_selections")
        .select("artwork_id")
        .eq("edition_date", editionDate)
        .maybeSingle();
      const preIssues = validateNationalDailyForAttach({
        row: snapshotFromNationalDailyRow(before),
        heroSelectionArtworkId: heroBefore?.artwork_id ?? null,
        priorDay: priorRow ? snapshotFromNationalDailyRow(priorRow) : null,
      });
      console.log("[preflight_existing_row]", {
        editionDate,
        passes: nationalDailyValidationPassed(preIssues),
        issueCodes: preIssues.map((i) => i.code),
      });
    } else {
      console.log("[preflight_existing_row]", { editionDate, passes: false, issueCodes: ["missing_row"] });
    }

    // STAGE: generate_national_daily (+ attach) via deployed Edge worker
    await resetJobForNationalOnly(editionDate);
    const traceId = `verify-live-${editionDate}-${Date.now()}`;
    console.log("[edge_invoke] process-user-edition-job", { editionDate, traceId });
    const invoke = await invokeNationalStageOnEdge(editionDate, traceId);
    if (invoke.status >= 500 && invoke.body?.error) {
      console.error(JSON.stringify(fail("edge_invoke", editionDate, invoke.body.error), null, 2));
      process.exit(1);
    }

    const { data: jobAfterInvoke } = await admin
      .from("generation_jobs")
      .select("status, build_stage, completed_stages, last_error")
      .eq("user_id", USER_ID)
      .eq("edition_date", editionDate)
      .eq("metro_key", METRO_KEY)
      .maybeSingle();

    const completed = jobAfterInvoke?.completed_stages ?? [];
    const hasGenerate = completed.includes("generate_national_daily");
    const hasAttach = completed.includes("attach_national_daily");

    if (jobAfterInvoke?.status === "failed" || !hasGenerate || !hasAttach) {
      console.error(
        JSON.stringify(
          fail(
            !hasGenerate ? "generate_national_daily" : "attach_national_daily",
            editionDate,
            jobAfterInvoke?.last_error ??
              invoke.body?.error ??
              "required national stages incomplete",
            { completedStages: completed, invokeStatus: invoke.status, invokeBody: invoke.body }
          ),
          null,
          2
        )
      );
      process.exit(1);
    }

    const jobState = { job: jobAfterInvoke, completed };

    // STAGE: validate_national_row
    const row = await loadNationalRow(editionDate);
    if (!row?.id) {
      console.error(JSON.stringify(fail("fetch_national_row", editionDate, "row missing"), null, 2));
      process.exit(1);
    }

    const priorDate =
      editionDate === "2026-07-19" ? "2026-07-18" : "2026-07-19";
    const priorRow = await loadNationalRow(priorDate);
    const { data: heroSelection } = await admin
      .from("kindred_hero_artwork_edition_selections")
      .select("artwork_id")
      .eq("edition_date", editionDate)
      .maybeSingle();

    const issues = validateNationalDailyForAttach({
      row: snapshotFromNationalDailyRow(row),
      heroSelectionArtworkId: heroSelection?.artwork_id ?? null,
      priorDay: priorRow ? snapshotFromNationalDailyRow(priorRow) : null,
    });

    if (!nationalDailyValidationPassed(issues)) {
      console.error(
        JSON.stringify(
          fail(
            "validate_national_row",
            editionDate,
            formatNationalDailyValidationFailure(editionDate, issues),
            { issues }
          ),
          null,
          2
        )
      );
      process.exit(1);
    }

    // STAGE: verify_city_attach
    const edition = await loadCityEdition(editionDate);
    if (!edition?.id || edition.us_national_daily_id !== row.id) {
      console.error(
        JSON.stringify(
          fail(
            "verify_city_attach",
            editionDate,
            `edition.us_national_daily_id=${edition?.us_national_daily_id ?? "null"} expected ${row.id}`
          ),
          null,
          2
        )
      );
      process.exit(1);
    }

    const historySection = await loadHistorySection(edition.id);
    const morning = edition.morning_edition?.morningHero ?? edition.morning_edition;
    snapshots.push({
      editionDate,
      nationalDailyId: row.id,
      masterpieceArtworkId: row.masterpiece_artwork_id,
      masterpieceTitle: row.today_masterpiece?.presentation?.artworkTitle ?? morning?.artworkTitle ?? null,
      masterpieceEditionDate: row.today_masterpiece?.presentation?.editionDate ?? null,
      historyHeadline: row.today_in_history?.headline ?? historySection?.headline ?? null,
      historyCalendarMonthDay:
        row.today_in_history?.selectionMeta?.calendarMonthDay ??
        calendarMonthDayFromEditionDate(editionDate),
      nationalNewsEditionDate: row.national_news?.editionDate ?? null,
      masterpieceFingerprint: stableJsonFingerprint(row.today_masterpiece),
      historyFingerprint: stableJsonFingerprint(row.today_in_history),
      newsFingerprint: stableJsonFingerprint(row.national_news),
      cityHistoryHeadline: historySection?.headline ?? null,
      cityMasterpieceTitle: morning?.artworkTitle ?? null,
    });

    console.log("[day_complete]", snapshots[snapshots.length - 1]);
  }

  const [j19, j20] = snapshots;
  const comparisons = [
    ["distinct_national_daily_ids", j19.nationalDailyId !== j20.nationalDailyId],
    ["history_calendar_month_day", j19.historyCalendarMonthDay === "07-19" && j20.historyCalendarMonthDay === "07-20"],
    ["history_headline_differs", j19.historyHeadline && j20.historyHeadline && j19.historyHeadline !== j20.historyHeadline],
    ["history_json_not_identical", j19.historyFingerprint !== j20.historyFingerprint],
    ["news_json_not_identical", j19.newsFingerprint !== j20.newsFingerprint],
    ["masterpiece_json_not_identical", j19.masterpieceFingerprint !== j20.masterpieceFingerprint],
    ["masterpiece_artwork_differs", j19.masterpieceArtworkId !== j20.masterpieceArtworkId],
    ["embedded_dates_match_rows", j19.masterpieceEditionDate === "2026-07-19" && j20.masterpieceEditionDate === "2026-07-20" && j19.nationalNewsEditionDate === "2026-07-19" && j20.nationalNewsEditionDate === "2026-07-20"],
    ["app_history_differs", j19.cityHistoryHeadline !== j20.cityHistoryHeadline],
    ["app_masterpiece_differs", j19.cityMasterpieceTitle !== j20.cityMasterpieceTitle],
  ];

  for (const [check, pass] of comparisons) {
    if (!pass) {
      console.error(
        JSON.stringify(
          fail("consecutive_day_comparison", "2026-07-19/2026-07-20", `${check} failed`, {
            j19,
            j20,
          }),
          null,
          2
        )
      );
      process.exit(1);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        stage: "complete",
        snapshots,
        comparisons: comparisons.map(([check, pass]) => ({ check, pass })),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(JSON.stringify(fail("unexpected", "", err instanceof Error ? err.message : String(err)), null, 2));
  process.exit(1);
});
