import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export async function isRateLimited(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { INSIGHT_RATE_LIMIT_PER_HOUR } = getEnv();
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("insight_generation_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  if (error) {
    return false;
  }

  return (count ?? 0) >= INSIGHT_RATE_LIMIT_PER_HOUR;
}

export async function recordGenerationAttempt(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase.from("insight_generation_log").insert({ user_id: userId });
}
