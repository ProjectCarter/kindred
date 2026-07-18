/**
 * Fire-and-forget trigger for the on-demand edition worker.
 * Uses service role — never blocks the generate-edition response.
 */

import type { RunUserGenerationJobInput } from "./runUserGenerationJob.ts";
import { fetchWithTimeout } from "../http/fetchWithTimeout.ts";

export function triggerUserEditionJobWorker(input: RunUserGenerationJobInput): void {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("[triggerUserEditionJobWorker] missing SUPABASE_URL or SERVICE_ROLE_KEY");
    return;
  }

  const url = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/process-user-edition-job`;
  const cronSecret = Deno.env.get("CRON_SECRET");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceKey}`,
  };
  if (cronSecret) {
    headers["x-cron-secret"] = cronSecret;
  }

  void fetchWithTimeout(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    },
    15_000
  ).catch((err) => {
    console.error("[triggerUserEditionJobWorker] invoke failed", {
      userId: input.userId,
      editionDate: input.editionDate,
      metroKey: input.metroKey,
      message: err instanceof Error ? err.message : String(err),
    });
  });
}
