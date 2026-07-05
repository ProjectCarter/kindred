import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { enqueueInsightJob } from "./enqueueInsightJob";

type EnsureInsightParams = {
  userId: string;
  itemId: string;
};

export type EnsureInsightResult = {
  body: string | null;
  pending: boolean;
};

export async function ensureInsightForItem(
  supabase: SupabaseClient,
  params: EnsureInsightParams
): Promise<EnsureInsightResult> {
  const { userId, itemId } = params;
  const { INSIGHT_MAX_JOB_ATTEMPTS } = getEnv();

  const { data: existing } = await supabase
    .from("insights")
    .select("body")
    .eq("item_id", itemId)
    .maybeSingle();

  if (existing?.body) {
    return { body: existing.body, pending: false };
  }

  const { data: job } = await supabase
    .from("insight_jobs")
    .select("status, attempts")
    .eq("item_id", itemId)
    .maybeSingle();

  if (job) {
    const canRetry =
      (job.status === "pending" ||
        job.status === "processing" ||
        job.status === "failed") &&
      job.attempts < INSIGHT_MAX_JOB_ATTEMPTS;

    return { body: null, pending: canRetry };
  }

  await enqueueInsightJob(supabase, { userId, itemId });

  return { body: null, pending: true };
}
