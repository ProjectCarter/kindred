/**
 * Reset and regenerate today's full edition via deployed Edge worker.
 */
import { createClient } from "@supabase/supabase-js";
import { invokeEdgeViaVault } from "./lib/vaultEdgeInvoke.mjs";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const METRO_KEY = "phoenix-az";
const EDITION_DATE = process.env.EDITION_DATE ?? "2026-07-19";
const YESTERDAY = "2026-07-18";
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

async function snapshotDay(editionDate) {
  const { data: edition } = await admin
    .from("editions")
    .select(
      "id, edition_date, status, us_national_daily_id, morning_edition, national_news"
    )
    .eq("user_id", USER_ID)
    .eq("edition_date", editionDate)
    .eq("metro_key", METRO_KEY)
    .maybeSingle();

  const { data: national } = edition?.us_national_daily_id
    ? await admin
        .from("kindred_us_national_daily")
        .select(
          "id, edition_date, masterpiece_artwork_id, today_masterpiece, today_in_history, national_news"
        )
        .eq("id", edition.us_national_daily_id)
        .maybeSingle()
    : { data: null };

  const { data: tihSection } = edition?.id
    ? await admin
        .from("edition_sections")
        .select("headline, body")
        .eq("edition_id", edition.id)
        .eq("section_type", "today_in_history")
        .maybeSingle()
    : { data: null };

  const hero = edition?.morning_edition?.morningHero ?? edition?.morning_edition;
  return {
    editionDate,
    editionId: edition?.id ?? null,
    status: edition?.status ?? null,
    nationalDailyId: national?.id ?? null,
    masterpieceTitle: hero?.artworkTitle ?? national?.today_masterpiece?.presentation?.artworkTitle ?? null,
    masterpieceArtworkId:
      edition?.morning_edition?.heroArtworkId ??
      national?.masterpiece_artwork_id ??
      hero?.artworkId ??
      null,
    masterpieceEditionDate:
      hero?.editionDate ??
      national?.today_masterpiece?.presentation?.editionDate ??
      null,
    tihHeadline: tihSection?.headline ?? national?.today_in_history?.headline ?? null,
    tihCalendarMonthDay: national?.today_in_history?.selectionMeta?.calendarMonthDay ?? null,
    nationalNewsEditionDate:
      edition?.national_news?.editionDate ?? national?.national_news?.editionDate ?? null,
  };
}

async function resetJob() {
  await admin
    .from("editions")
    .update({
      status: "processing",
      us_national_daily_id: null,
      morning_edition: null,
      national_news: null,
    })
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", METRO_KEY);

  const { error } = await admin.from("generation_jobs").upsert(
    {
      user_id: USER_ID,
      edition_date: EDITION_DATE,
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

async function waitForReady(timeoutMs = 900_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { data: job } = await admin
      .from("generation_jobs")
      .select("status, build_stage, completed_stages, last_error")
      .eq("user_id", USER_ID)
      .eq("edition_date", EDITION_DATE)
      .eq("metro_key", METRO_KEY)
      .maybeSingle();

    const completed = job?.completed_stages ?? [];
    const finalized = completed.includes("finalize_edition");
    console.log("[poll]", {
      status: job?.status,
      stage: job?.build_stage,
      stages: completed.length,
      finalized,
      err: job?.last_error?.slice?.(0, 120),
    });

    if (job?.status === "failed") {
      throw new Error(job.last_error ?? "generation failed");
    }
    if (finalized && (job?.status === "completed" || job?.status === "ready")) {
      return job;
    }

    invokeEdgeViaVault(
      "process-user-edition-job",
      {
        userId: USER_ID,
        editionDate: EDITION_DATE,
        metroKey: METRO_KEY,
        editionTraceId: `live-verify-${EDITION_DATE}-${Date.now()}`,
        temperatureUnit: "fahrenheit",
        locationHint: LOCATION,
      },
      { timeoutMs: 900_000 }
    );

    await new Promise((r) => setTimeout(r, 15_000));
  }
  throw new Error("timed out waiting for finalize_edition");
}

const beforeYesterday = await snapshotDay(YESTERDAY);
console.log("[before] yesterday snapshot", beforeYesterday);

await resetJob();
console.log("[reset] cleared today edition attach + job for", EDITION_DATE);

await waitForReady();

const afterToday = await snapshotDay(EDITION_DATE);
console.log("[after] today snapshot", afterToday);

console.log(
  JSON.stringify(
    {
      ok: true,
      editionDate: EDITION_DATE,
      yesterday: beforeYesterday,
      today: afterToday,
      checks: {
        masterpieceDiffersFromYesterday:
          afterToday.masterpieceTitle !== beforeYesterday.masterpieceTitle,
        tihDiffersFromYesterday:
          afterToday.tihHeadline !== beforeYesterday.tihHeadline,
        embeddedEditionDateMatchesToday:
          afterToday.masterpieceEditionDate === EDITION_DATE &&
          afterToday.nationalNewsEditionDate === EDITION_DATE,
        tihCalendarMonthDayMatchesToday: afterToday.tihCalendarMonthDay === "07-19",
      },
    },
    null,
    2
  )
);
