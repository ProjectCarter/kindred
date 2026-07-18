/**
 * Run a single user's edition generation job (shared by cron worker + on-demand worker).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  buildEditionForUser,
  resolveEditionLocation,
  type BuildEditionOptions,
} from "../buildEdition.ts";
import type { TemperatureUnitPreference } from "../weather/units.ts";
import { logEditionBuildOutcome } from "./editionBuildOutcome.ts";

const MAX_ATTEMPTS = 3;

export type RunUserGenerationJobInput = {
  userId: string;
  editionDate: string;
  metroKey: string;
  editionTraceId?: string | null;
  temperatureUnitPreference?: TemperatureUnitPreference;
  locationHint?: {
    city: string;
    state?: string | null;
    region?: string | null;
    lat: number;
    lon: number;
  } | null;
};

export type RunUserGenerationJobResult =
  | { ok: true; editionId: string; metroKey: string; skipped?: string }
  | { ok: false; error: string; skipped?: string };

export async function findReadyEditionId(
  admin: SupabaseClient,
  input: { userId: string; editionDate: string; metroKey: string }
): Promise<string | null> {
  const { data } = await admin
    .from("editions")
    .select("id")
    .eq("user_id", input.userId)
    .eq("edition_date", input.editionDate)
    .eq("metro_key", input.metroKey)
    .eq("status", "ready")
    .maybeSingle();
  return data?.id ?? null;
}

async function finalizeJob(
  admin: SupabaseClient,
  jobId: string,
  patch: { status: "ready" | "failed"; last_error?: string | null }
) {
  await admin
    .from("generation_jobs")
    .update({
      status: patch.status,
      last_error: patch.last_error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

async function finalizeJobByIdentity(
  admin: SupabaseClient,
  input: { userId: string; editionDate: string; metroKey: string },
  patch: { status: "ready" | "failed"; last_error?: string | null }
) {
  await admin
    .from("generation_jobs")
    .update({
      status: patch.status,
      last_error: patch.last_error ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId)
    .eq("edition_date", input.editionDate)
    .eq("metro_key", input.metroKey);
}

/** Build + finalize when the job row is already claimed (cron batch worker). */
export async function executeClaimedGenerationJob(
  admin: SupabaseClient,
  input: RunUserGenerationJobInput & { jobId: string }
): Promise<RunUserGenerationJobResult> {
  const readyId = await findReadyEditionId(admin, {
    userId: input.userId,
    editionDate: input.editionDate,
    metroKey: input.metroKey,
  });
  if (readyId) {
    await finalizeJob(admin, input.jobId, { status: "ready", last_error: null });
    return {
      ok: true,
      editionId: readyId,
      metroKey: input.metroKey,
      skipped: "edition_already_ready",
    };
  }

  const location = await resolveEditionLocation(
    admin,
    input.userId,
    input.locationHint ?? null
  );

  if (!location) {
    await finalizeJob(admin, input.jobId, {
      status: "failed",
      last_error: "No location set. Choose a home city or enable current location.",
    });
    return {
      ok: false,
      error: "No location set. Choose a home city or enable current location.",
    };
  }

  const buildOptions: BuildEditionOptions = {
    editionDate: input.editionDate,
    temperatureUnitPreference: input.temperatureUnitPreference ?? "auto",
    editionTraceId: input.editionTraceId ?? undefined,
  };

  const startedAt = performance.now();
  let result: Awaited<ReturnType<typeof buildEditionForUser>>;
  try {
    result = await buildEditionForUser(
      admin,
      input.userId,
      location,
      buildOptions
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await finalizeJob(admin, input.jobId, {
      status: "failed",
      last_error: error,
    });
    logEditionBuildOutcome({
      kind: "edition_build_outcome",
      at: new Date().toISOString(),
      userId: input.userId,
      jobId: input.jobId,
      metroKey: input.metroKey,
      traceId: input.editionTraceId ?? null,
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      error,
    });
    return { ok: false, error };
  }

  if (!result.ok) {
    await finalizeJob(admin, input.jobId, {
      status: "failed",
      last_error: result.error,
    });
    logEditionBuildOutcome({
      kind: "edition_build_outcome",
      at: new Date().toISOString(),
      userId: input.userId,
      jobId: input.jobId,
      metroKey: input.metroKey,
      traceId: input.editionTraceId ?? null,
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      error: result.error,
    });
    return { ok: false, error: result.error };
  }

  const { data: persistedEdition, error: editionReadError } = await admin
    .from("editions")
    .select("metro_key")
    .eq("id", result.editionId)
    .maybeSingle();

  if (editionReadError || !persistedEdition?.metro_key) {
    const error =
      editionReadError?.message ??
      "Edition row missing after successful build";
    await finalizeJob(admin, input.jobId, {
      status: "failed",
      last_error: error,
    });
    return { ok: false, error };
  }

  if (persistedEdition.metro_key !== input.metroKey) {
    const error = `edition_metro_mismatch: requested ${input.metroKey}, persisted ${persistedEdition.metro_key}`;
    console.error("[runUserGenerationJob] metro mismatch — refusing ready", {
      userId: input.userId,
      editionDate: input.editionDate,
      requestedMetro: input.metroKey,
      persistedMetro: persistedEdition.metro_key,
      editionId: result.editionId,
    });
    await finalizeJob(admin, input.jobId, {
      status: "failed",
      last_error: error,
    });
    logEditionBuildOutcome({
      kind: "edition_build_outcome",
      at: new Date().toISOString(),
      editionId: result.editionId,
      userId: input.userId,
      jobId: input.jobId,
      metroKey: input.metroKey,
      traceId: input.editionTraceId ?? null,
      status: "failed",
      durationMs: Math.round(performance.now() - startedAt),
      error,
    });
    return { ok: false, error };
  }

  await finalizeJob(admin, input.jobId, { status: "ready", last_error: null });

  logEditionBuildOutcome({
    kind: "edition_build_outcome",
    at: new Date().toISOString(),
    editionId: result.editionId,
    userId: input.userId,
    jobId: input.jobId,
    metroKey: result.metroKey,
    traceId: input.editionTraceId ?? null,
    status: "ready",
    durationMs: Math.round(performance.now() - startedAt),
  });

  return {
    ok: true,
    editionId: result.editionId,
    metroKey: result.metroKey,
  };
}

/** Claim (if needed) then build — used by on-demand worker. */
export async function runUserGenerationJob(
  admin: SupabaseClient,
  input: RunUserGenerationJobInput
): Promise<RunUserGenerationJobResult> {
  const readyId = await findReadyEditionId(admin, {
    userId: input.userId,
    editionDate: input.editionDate,
    metroKey: input.metroKey,
  });
  if (readyId) {
    await finalizeJobByIdentity(admin, input, { status: "ready", last_error: null });
    return {
      ok: true,
      editionId: readyId,
      metroKey: input.metroKey,
      skipped: "edition_already_ready",
    };
  }

  const { data: existingJob } = await admin
    .from("generation_jobs")
    .select("id, status, attempts")
    .eq("user_id", input.userId)
    .eq("edition_date", input.editionDate)
    .eq("metro_key", input.metroKey)
    .maybeSingle();

  if (existingJob?.status === "processing") {
    return {
      ok: false,
      error: "Job already processing",
      skipped: "already_processing",
    };
  }

  const { data: claimedRaw, error: claimError } = await admin.rpc(
    "claim_user_generation_job",
    {
      p_user_id: input.userId,
      p_edition_date: input.editionDate,
      p_metro_key: input.metroKey,
      p_max_attempts: MAX_ATTEMPTS,
    }
  );

  if (claimError) {
    console.error("[runUserGenerationJob] claim failed", claimError.message);
    return { ok: false, error: claimError.message };
  }

  const claimed = ((claimedRaw ?? []) as Array<{ id: string }>)[0];
  if (!claimed?.id) {
    if (existingJob?.status === "failed" && (existingJob.attempts ?? 0) >= MAX_ATTEMPTS) {
      return { ok: false, error: "Generation attempts exhausted", skipped: "max_attempts" };
    }
    return { ok: false, error: "Job not claimable", skipped: "not_claimable" };
  }

  return executeClaimedGenerationJob(admin, { ...input, jobId: claimed.id });
}

export { MAX_ATTEMPTS as GENERATION_JOB_MAX_ATTEMPTS };
