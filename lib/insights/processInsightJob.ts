import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInsight } from "@/lib/ai/generateInsight";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { getStaleProcessingBefore, isProcessingStale } from "./jobUtils";
import { isRateLimited, recordGenerationAttempt } from "./rateLimit";
import { INSIGHT_JOB_SELECT, type InsightJob } from "./types";

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

async function tryClaimJob(
  supabase: SupabaseClient,
  job: InsightJob
): Promise<InsightJob | null> {
  const nextAttempts = job.attempts + 1;
  const claimPayload = {
    status: "processing" as const,
    attempts: nextAttempts,
    last_error: null,
    updated_at: new Date().toISOString(),
  };

  if (job.status === "pending" || job.status === "failed") {
    const { data } = await supabase
      .from("insight_jobs")
      .update(claimPayload)
      .eq("id", job.id)
      .eq("user_id", job.user_id)
      .eq("status", job.status)
      .select(INSIGHT_JOB_SELECT)
      .maybeSingle();

    return (data as InsightJob | null) ?? null;
  }

  if (job.status === "processing" && isProcessingStale(job.updated_at)) {
    const { data } = await supabase
      .from("insight_jobs")
      .update(claimPayload)
      .eq("id", job.id)
      .eq("user_id", job.user_id)
      .eq("status", "processing")
      .lt("updated_at", getStaleProcessingBefore())
      .select(INSIGHT_JOB_SELECT)
      .maybeSingle();

    if (data) {
      log.warn("Recovered stale insight job", {
        jobId: job.id,
        userId: job.user_id,
        itemId: job.item_id,
      });
    }

    return (data as InsightJob | null) ?? null;
  }

  return null;
}

async function fetchProcessableJobs(
  supabase: SupabaseClient,
  options: { userId?: string; limit?: number } = {}
): Promise<InsightJob[]> {
  const { INSIGHT_MAX_JOB_ATTEMPTS } = getEnv();
  const staleBefore = getStaleProcessingBefore();

  let activeQuery = supabase
    .from("insight_jobs")
    .select(INSIGHT_JOB_SELECT)
    .in("status", ["pending", "failed"])
    .lt("attempts", INSIGHT_MAX_JOB_ATTEMPTS);

  if (options.userId) {
    activeQuery = activeQuery.eq("user_id", options.userId);
  }

  const { data: activeJobs } = await activeQuery.order("created_at", {
    ascending: true,
  });

  let staleQuery = supabase
    .from("insight_jobs")
    .select(INSIGHT_JOB_SELECT)
    .eq("status", "processing")
    .lt("updated_at", staleBefore)
    .lt("attempts", INSIGHT_MAX_JOB_ATTEMPTS);

  if (options.userId) {
    staleQuery = staleQuery.eq("user_id", options.userId);
  }

  staleQuery = staleQuery.order("updated_at", { ascending: true });

  if (options.limit) {
    staleQuery = staleQuery.limit(options.limit);
  }

  const { data: staleJobs } = await staleQuery;

  const combined = [...(activeJobs ?? []), ...(staleJobs ?? [])] as InsightJob[];

  if (options.limit) {
    return combined.slice(0, options.limit);
  }

  return combined;
}

export async function processInsightJob(
  supabase: SupabaseClient,
  job: InsightJob
): Promise<ProcessInsightJobResult> {
  const { INSIGHT_MAX_JOB_ATTEMPTS } = getEnv();

  if (job.status === "completed") {
    return "skipped";
  }

  if (job.status === "processing" && !isProcessingStale(job.updated_at)) {
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

  const claimed = await tryClaimJob(supabase, job);

  if (!claimed) {
    return "skipped";
  }

  if (await isRateLimited(supabase, claimed.user_id)) {
    await markJob(supabase, claimed.id, {
      status: "pending",
      last_error: "rate_limited",
    });
    log.warn("Insight generation rate limit reached", {
      userId: claimed.user_id,
      itemId: claimed.item_id,
      jobId: claimed.id,
    });
    return "skipped";
  }

  await recordGenerationAttempt(supabase, claimed.user_id);

  const generated = await generateInsight({
    description: item.description,
    hasPhoto: !!item.photo_path,
  });

  if (!generated.ok) {
    const failed = claimed.attempts >= INSIGHT_MAX_JOB_ATTEMPTS;
    const lastError = `${generated.error}: ${generated.detail}`;

    await markJob(supabase, claimed.id, {
      status: failed ? "failed" : "pending",
      attempts: claimed.attempts,
      last_error: lastError,
    });

    log.error("Insight generation failed", {
      userId: claimed.user_id,
      itemId: claimed.item_id,
      jobId: claimed.id,
      error: generated.error,
      detail: generated.detail,
    });
    console.error(`[Kindred] Insight generation failed: ${lastError}`);

    return "failed";
  }

  const { error: insertError } = await supabase.from("insights").insert({
    user_id: claimed.user_id,
    item_id: claimed.item_id,
    body: generated.body,
  });

  if (insertError) {
    const { data: racedInsight } = await supabase
      .from("insights")
      .select("id")
      .eq("item_id", claimed.item_id)
      .maybeSingle();

    if (racedInsight) {
      await markJob(supabase, claimed.id, { status: "completed", last_error: null });
      return "completed";
    }

    await markJob(supabase, claimed.id, {
      status: "pending",
      attempts: claimed.attempts,
      last_error: insertError.message,
    });

    log.error("Insight insert failed", {
      userId: claimed.user_id,
      itemId: claimed.item_id,
      jobId: claimed.id,
      error: insertError.message,
    });

    return "failed";
  }

  await markJob(supabase, claimed.id, { status: "completed", last_error: null });

  log.info("Insight generated", {
    userId: claimed.user_id,
    itemId: claimed.item_id,
    jobId: claimed.id,
  });

  return "completed";
}

export async function processPendingJobsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const jobs = await fetchProcessableJobs(supabase, { userId });

  let processed = 0;

  for (const job of jobs) {
    const result = await processInsightJob(supabase, job);
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
  const jobs = await fetchProcessableJobs(supabase, { limit });

  let processed = 0;

  for (const job of jobs) {
    const result = await processInsightJob(supabase, job);
    if (result !== "skipped") {
      processed += 1;
    }
  }

  return processed;
}
