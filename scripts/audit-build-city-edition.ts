/**
 * Build one audit-city edition through the production server pipeline (local Deno).
 * Same code path as process-user-edition-job — avoids Edge compute limits during audits.
 *
 * Usage:
 *   USER_ID=... EDITION_DATE=2026-07-18 AUDIT_CITY=Seattle AUDIT_STATE=WA \
 *   AUDIT_LAT=47.6062 AUDIT_LON=-122.3321 AUDIT_METRO_KEY=seattle-wa \
 *   npx deno run --allow-env --allow-net --allow-read scripts/audit-build-city-edition.ts
 */

import {
  buildEditionForUser,
  createServiceClient,
} from "../supabase/functions/_shared/buildEdition.ts";
import { generationJobsConflictTarget } from "../supabase/functions/_shared/markets/editionIdentity.ts";

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

await loadLocalEnv();

if (!Deno.env.get("SUPABASE_URL")?.trim()) {
  Deno.env.set(
    "SUPABASE_URL",
    Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ??
      "https://zdqjeocdsbdzecawumdp.supabase.co"
  );
}

const userId =
  Deno.env.get("USER_ID") ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const editionDate =
  Deno.env.get("EDITION_DATE") ?? new Date().toISOString().slice(0, 10);
const metroKey = Deno.env.get("AUDIT_METRO_KEY")?.trim();
const city = Deno.env.get("AUDIT_CITY")?.trim();
const state = Deno.env.get("AUDIT_STATE")?.trim();
const region = Deno.env.get("AUDIT_REGION")?.trim() ?? state;
const lat = Number(Deno.env.get("AUDIT_LAT"));
const lon = Number(Deno.env.get("AUDIT_LON"));

if (!metroKey || !city || !state || !Number.isFinite(lat) || !Number.isFinite(lon)) {
  console.error(
    JSON.stringify({
      ok: false,
      error:
        "AUDIT_METRO_KEY, AUDIT_CITY, AUDIT_STATE, AUDIT_LAT, AUDIT_LON required",
    })
  );
  Deno.exit(1);
}

if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()) {
  console.error(
    JSON.stringify({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY required" })
  );
  Deno.exit(1);
}

const admin = createServiceClient();
const startedAt = performance.now();

await admin.from("generation_jobs").upsert(
  {
    user_id: userId,
    edition_date: editionDate,
    metro_key: metroKey,
    status: "processing",
    last_error: null,
    updated_at: new Date().toISOString(),
  },
  { onConflict: generationJobsConflictTarget() }
);

const locationHint = {
  city,
  state,
  region,
  lat,
  lon,
};

console.log("[audit-build-city-edition] building", {
  userId,
  editionDate,
  metroKey,
  city,
});

const result = await buildEditionForUser(admin, userId, locationHint, {
  editionDate,
  temperatureUnitPreference: "fahrenheit",
  editionTraceId: `audit-${metroKey}-${editionDate}`,
});

const durationMs = Math.round(performance.now() - startedAt);

if (!result.ok) {
  await admin
    .from("generation_jobs")
    .update({
      status: "failed",
      last_error: result.error,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("edition_date", editionDate)
    .eq("metro_key", metroKey);

  console.log(JSON.stringify({ ok: false, error: result.error, durationMs, metroKey }));
  Deno.exit(1);
}

const { data: edition } = await admin
  .from("editions")
  .select("id, status, metro_key, us_national_daily_id")
  .eq("id", result.editionId)
  .maybeSingle();

await admin
  .from("generation_jobs")
  .update({
    status: "ready",
    last_error: null,
    updated_at: new Date().toISOString(),
  })
  .eq("user_id", userId)
  .eq("edition_date", editionDate)
  .eq("metro_key", metroKey);

console.log(
  JSON.stringify(
    {
      ok: true,
      editionId: result.editionId,
      metroKey: edition?.metro_key ?? result.metroKey,
      status: edition?.status ?? null,
      usNationalDailyId: edition?.us_national_daily_id ?? null,
      durationMs,
    },
    null,
    0
  )
);

if (edition?.metro_key !== metroKey) {
  Deno.exit(1);
}
