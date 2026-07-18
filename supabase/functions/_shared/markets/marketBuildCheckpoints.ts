/**
 * Durable checkpoints for phased market builds.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { MarketBuildPhase } from "../../../../lib/markets/marketBuildEngine.ts";

export type CheckpointRow = {
  id: string;
  metro_key: string;
  slug: string;
  run_id: string;
  catalog: string;
  phase: string;
  checkpoint: string | null;
  status: string;
  attempts: number;
  rows_imported: number;
  api_calls: number;
  worker_exit_reason: string | null;
  last_error: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export async function getPhaseCheckpoint(
  admin: SupabaseClient,
  runId: string,
  phase: MarketBuildPhase,
  checkpoint: string | null = null
): Promise<CheckpointRow | null> {
  let q = admin
    .from("kindred_market_build_checkpoints")
    .select("*")
    .eq("run_id", runId)
    .eq("phase", phase);

  if (checkpoint == null || checkpoint === "") {
    q = q.eq("checkpoint", "");
  } else {
    q = q.eq("checkpoint", checkpoint);
  }

  const { data } = await q.maybeSingle();
  return (data as CheckpointRow | null) ?? null;
}

export async function isPhaseComplete(
  admin: SupabaseClient,
  runId: string,
  phase: MarketBuildPhase
): Promise<boolean> {
  const row = await getPhaseCheckpoint(admin, runId, phase, null);
  return row?.status === "completed" || row?.status === "skipped";
}

export async function startPhaseCheckpoint(
  admin: SupabaseClient,
  input: {
    metroKey: string;
    slug: string;
    runId: string;
    catalog: string;
    phase: MarketBuildPhase;
    checkpoint?: string | null;
    attempt: number;
  }
): Promise<CheckpointRow> {
  const now = new Date().toISOString();
  const checkpoint = input.checkpoint?.trim() || "";

  const { data, error } = await admin
    .from("kindred_market_build_checkpoints")
    .upsert(
      {
        metro_key: input.metroKey,
        slug: input.slug,
        run_id: input.runId,
        catalog: input.catalog,
        phase: input.phase,
        checkpoint,
        status: "running",
        attempts: input.attempt,
        started_at: now,
        updated_at: now,
      },
      { onConflict: "run_id,phase,checkpoint" }
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not start checkpoint");
  }
  return data as CheckpointRow;
}

export async function completePhaseCheckpoint(
  admin: SupabaseClient,
  checkpointId: string,
  input: {
    rowsImported?: number;
    apiCalls?: number;
    workerExitReason?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("kindred_market_build_checkpoints")
    .update({
      status: "completed",
      completed_at: now,
      rows_imported: input.rowsImported ?? 0,
      api_calls: input.apiCalls ?? 0,
      worker_exit_reason: input.workerExitReason ?? "success",
      updated_at: now,
      metadata: input.metadata ?? {},
    })
    .eq("id", checkpointId);
}

export async function failPhaseCheckpoint(
  admin: SupabaseClient,
  checkpointId: string,
  input: {
    workerExitReason: string;
    lastError: string;
    rowsImported?: number;
    apiCalls?: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("kindred_market_build_checkpoints")
    .update({
      status: "failed",
      worker_exit_reason: input.workerExitReason,
      last_error: input.lastError,
      rows_imported: input.rowsImported ?? 0,
      api_calls: input.apiCalls ?? 0,
      updated_at: now,
    })
    .eq("id", checkpointId);
}

export async function skipPhaseCheckpoint(
  admin: SupabaseClient,
  input: {
    metroKey: string;
    slug: string;
    runId: string;
    catalog: string;
    phase: MarketBuildPhase;
    reason: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("kindred_market_build_checkpoints")
    .upsert(
      {
        metro_key: input.metroKey,
        slug: input.slug,
        run_id: input.runId,
        catalog: input.catalog,
        phase: input.phase,
        checkpoint: "",
        status: "skipped",
        worker_exit_reason: "skipped",
        last_error: input.reason,
        completed_at: now,
        updated_at: now,
      },
      { onConflict: "run_id,phase,checkpoint" }
    );
}

export async function listCompletedActivityCategories(
  admin: SupabaseClient,
  runId: string,
  metroKey: string
): Promise<Set<string>> {
  const { data } = await admin
    .from("kindred_market_build_checkpoints")
    .select("checkpoint")
    .eq("run_id", runId)
    .eq("metro_key", metroKey)
    .eq("phase", "activities")
    .eq("status", "completed")
    .not("checkpoint", "eq", "");

  return new Set((data ?? []).map((r) => String(r.checkpoint)));
}
