/**
 * Run a full staged edition build locally — one stage per loop iteration.
 * Mirrors process-user-edition-job chaining without Edge memory limits.
 *
 * Usage:
 *   USER_ID=... EDITION_DATE=2026-07-18 AUDIT_CITY=Gilbert AUDIT_STATE=AZ \
 *   AUDIT_LAT=33.3528 AUDIT_LON=-111.7890 AUDIT_METRO_KEY=phoenix-az \
 *   npx deno run --allow-env --allow-net --allow-read scripts/run-staged-edition-build.ts
 */

import { createServiceClient } from "../supabase/functions/_shared/buildEdition.ts";
import { generationJobsConflictTarget } from "../supabase/functions/_shared/markets/editionIdentity.ts";
import {
  runEditionBuildStage,
} from "../supabase/functions/_shared/edition/runStagedEditionBuild.ts";

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
const traceId =
  Deno.env.get("EDITION_TRACE_ID")?.trim() ??
  `staged-${metroKey}-${editionDate}`;

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
  Deno.env.set(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk"
  );
}

if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()) {
  console.error(
    JSON.stringify({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY required" })
  );
  Deno.exit(1);
}

const admin = createServiceClient();
const pipelineStarted = performance.now();
let firstPaintMs: number | null = null;

const { data: jobRow, error: jobUpsertError } = await admin
  .from("generation_jobs")
  .upsert(
    {
      user_id: userId,
      edition_date: editionDate,
      metro_key: metroKey,
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
    { onConflict: generationJobsConflictTarget() }
  )
  .select("id")
  .single();

if (jobUpsertError || !jobRow?.id) {
  console.error(JSON.stringify({ ok: false, error: jobUpsertError?.message ?? "job upsert failed" }));
  Deno.exit(1);
}

const jobId = jobRow.id as string;
const locationHint = { city, state, region, lat, lon };
const input = {
  userId,
  editionDate,
  metroKey,
  editionTraceId: traceId,
  temperatureUnitPreference: "fahrenheit" as const,
  locationHint,
  jobId,
};

console.log("[run-staged-edition-build] starting", {
  userId,
  editionDate,
  metroKey,
  city,
  jobId,
  traceId,
});

const stageTimings: Array<{ stage: string; ms: number; ok: boolean }> = [];

for (let step = 0; step < 20; step += 1) {
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_user_generation_job",
    {
      p_user_id: userId,
      p_edition_date: editionDate,
      p_metro_key: metroKey,
      p_max_attempts: 3,
    }
  );
  if (claimError) {
    console.error(JSON.stringify({ ok: false, error: claimError.message, step }));
    Deno.exit(1);
  }
  if (!((claimed ?? []) as unknown[]).length) {
    console.error(JSON.stringify({ ok: false, error: "claim returned no row", step }));
    Deno.exit(1);
  }

  const stageStarted = performance.now();
  const result = await runEditionBuildStage(admin, input);
  const stageMs = Math.round(performance.now() - stageStarted);
  stageTimings.push({
    stage: result.ok ? result.stage : "failed",
    ms: stageMs,
    ok: result.ok,
  });

  console.log("[run-staged-edition-build] stage", {
    step,
    ok: result.ok,
    stage: result.ok ? result.stage : undefined,
    done: result.ok ? result.done : undefined,
    ms: stageMs,
    error: result.ok ? undefined : result.error,
  });

  if (!result.ok) {
    console.error(
      JSON.stringify({
        ok: false,
        error: result.error,
        stageTimings,
        totalMs: Math.round(performance.now() - pipelineStarted),
      })
    );
    Deno.exit(1);
  }

  const { data: edition } = await admin
    .from("editions")
    .select("status")
    .eq("id", result.editionId)
    .maybeSingle();

  if (firstPaintMs === null && edition?.status === "ready") {
    firstPaintMs = Math.round(performance.now() - pipelineStarted);
  }

  if (result.done) break;

  const { data: job } = await admin
    .from("generation_jobs")
    .select("status, build_stage, completed_stages")
    .eq("id", jobId)
    .maybeSingle();

  if (job?.status === "ready") break;
  if (!job?.build_stage && (job?.completed_stages?.length ?? 0) > 0) break;
}

const totalMs = Math.round(performance.now() - pipelineStarted);

const { data: finalJob } = await admin
  .from("generation_jobs")
  .select("status, completed_stages, stage_diagnostics, edition_id, last_error")
  .eq("id", jobId)
  .maybeSingle();

const { data: finalEdition } = finalJob?.edition_id
  ? await admin
      .from("editions")
      .select("id, status, metro_key")
      .eq("id", finalJob.edition_id)
      .maybeSingle()
  : { data: null };

const report = {
  ok: finalJob?.status === "ready" && finalEdition?.status === "ready",
  metroKey,
  city,
  editionDate,
  traceId,
  editionId: finalEdition?.id ?? null,
  jobStatus: finalJob?.status ?? null,
  completedStages: finalJob?.completed_stages ?? [],
  stageTimings,
  firstPaintMs,
  completionMs: totalMs,
  lastError: finalJob?.last_error ?? null,
  diagnosticsCount: Array.isArray(finalJob?.stage_diagnostics)
    ? finalJob.stage_diagnostics.length
    : 0,
};

console.log(JSON.stringify(report, null, 2));
Deno.exit(report.ok ? 0 : 1);
