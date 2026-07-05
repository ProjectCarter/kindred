import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInsight } from "@/lib/ai/generateInsight";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { isRateLimited, recordGenerationAttempt } from "./rateLimit";
import type { InsightJob } from "./types";

export type ProcessInsightJobResult = "completed" | "failed" | "skipped";

async function markJob(
  supabase: SupabaseClient,
  jobId: string,
  updates: Partial<Pick<InsightJob, "status" | "attempts" | "last_error">>
) {
  await supabase
    .from("insight_jobs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export async function processInsightJob(
  supabase: SupabaseClient,
  job: InsightJob
): Promise<ProcessInsightJobResult> {
  const { INSIGHT_MAX_JOB_ATTEMPTS } = getEnv();

  if (job.status === "completed" || job.status === "processing") {
    return "skipped";
  }

  if (job.attempts >= INSIGHT_MAX_JOB_ATTEMPTS) {
    await markJob(supabase, job.id, {
      status: "failed",
      last_error: "Maximum processing attempts reached.",
    });
    return "failed";
  }

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, user_id, description, photo_path")
    .eq("id", job.item_id)
    .eq("user_id", job.user_id)
    .maybeSingle();

  if (itemError || !item) {
    await markJob(supabase, job.id, {
      status: "failed",
      attempts: job.attempts + 1,
      last_error: "Item not found for insight generation.",
    });
    log.error("Insight job item lookup failed", {
      userId: job.user_id,
      itemId: job.item_id,
      jobId: job.id,
      error: itemError?.message,
    });
    return "failed";
  }

  const { data: existingInsight } = await supabase
    .from("insights")
    .select("id")
    .eq("item_id", job.item_id)
    .maybeSingle();

  if (existingInsight) {
    await markJob(supabase, job.id, { status: "completed", last_error: null });
    return "completed";
  }

  if (await isRateLimited(supabase, job.user_id)) {
    log.warn("Insight generation rate limit reached", {
      userId: job.user_id,
      itemId: job.item_id,
      jobId: job.id,
    });
    return "skipped";
  }

  const nextAttempts = job.attempts + 1;

  await markJob(supabase, job.id, {
    status: "processing",
    attempts: nextAttempts,
    last_error: null,
  });

  await recordGenerationAttempt(supabase, job.user_id);

  const generated = await generateInsight({
    description: item.description,
    hasPhoto: !!item.photo_path,
  });

  if (!generated.ok) {
    const failed = nextAttempts >= INSIGHT_MAX_JOB_ATTEMPTS;

    await markJob(supabase, job.id, {
      status: failed ? "failed" : "pending",
      attempts: nextAttempts,
      last_error: generated.error,
    });

    log.error("Insight generation failed", {
      userId: job.user_id,
      itemId: job.item_id,
      jobId: job.id,
      error: generated.error,
    });

    return "failed";
  }

  const { error: insertError } = await supabase.from("insights").insert({
    user_id: job.user_id,
    item_id: job.item_id,
    body: generated.body,
  });

  if (insertError) {
    const { data: racedInsight } = await supabase
      .from("insights")
      .select("id")
      .eq("item_id", job.item_id)
      .maybeSingle();

    if (racedInsight) {
      await markJob(supabase, job.id, { status: "completed", last_error: null });
      return "completed";
    }

    await markJob(supabase, job.id, {
      status: "pending",
      attempts: nextAttempts,
      last_error: insertError.message,
    });

    log.error("Insight insert failed", {
      userId: job.user_id,
      itemId: job.item_id,
      jobId: job.id,
      error: insertError.message,
    });

    return "failed";
  }

  await markJob(supabase, job.id, { status: "completed", last_error: null });

  log.info("Insight generated", {
    userId: job.user_id,
    itemId: job.item_id,
    jobId: job.id,
  });

  return "completed";
}

export async function processPendingJobsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { INSIGHT_MAX_JOB_ATTEMPTS } = getEnv();

  const { data: jobs } = await supabase
    .from("insight_jobs")
    .select("id, user_id, item_id, status, attempts, last_error")
    .eq("user_id", userId)
    .in("status", ["pending", "failed"])
    .lt("attempts", INSIGHT_MAX_JOB_ATTEMPTS)
    .order("created_at", { ascending: true });

  let processed = 0;

  for (const job of jobs ?? []) {
    const result = await processInsightJob(supabase, job as InsightJob);
    if (result !== "skipped") {
      processed += 1;
    }
  }

  return processed;
}

export async function processStaleJobs(
  supabase: SupabaseClient,
  limit = 10
): Promise<number> {
  const { INSIGHT_MAX_JOB_ATTEMPTS } = getEnv();

  const { data: jobs } = await supabase
    .from("insight_jobs")
    .select("id, user_id, item_id, status, attempts, last_error")
    .in("status", ["pending", "failed"])
    .lt("attempts", INSIGHT_MAX_JOB_ATTEMPTS)
    .order("updated_at", { ascending: true })
    .limit(limit);

  let processed = 0;

  for (const job of jobs ?? []) {
    const result = await processInsightJob(supabase, job as InsightJob);
    if (result !== "skipped") {
      processed += 1;
    }
  }

  return processed;
}
