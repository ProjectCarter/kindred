import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsightJob } from "./types";

type EnqueueParams = {
  userId: string;
  itemId: string;
};

export async function enqueueInsightJob(
  supabase: SupabaseClient,
  params: EnqueueParams
): Promise<InsightJob | null> {
  const { userId, itemId } = params;

  const { data: existingJob } = await supabase
    .from("insight_jobs")
    .select("id, user_id, item_id, status, attempts, last_error")
    .eq("item_id", itemId)
    .maybeSingle();

  if (existingJob) {
    return existingJob as InsightJob;
  }

  const { data: created, error } = await supabase
    .from("insight_jobs")
    .insert({
      user_id: userId,
      item_id: itemId,
      status: "pending",
    })
    .select("id, user_id, item_id, status, attempts, last_error")
    .single();

  if (error) {
    const { data: raced } = await supabase
      .from("insight_jobs")
      .select("id, user_id, item_id, status, attempts, last_error")
      .eq("item_id", itemId)
      .maybeSingle();

    return (raced as InsightJob | null) ?? null;
  }

  return created as InsightJob;
}
