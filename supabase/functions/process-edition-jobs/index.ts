// Kindred — process-edition-jobs
// Cron-triggered overnight worker. Enqueues and processes generation_jobs
// for users who have interests. Does not send email; auth is a shared secret.

import {
  buildEditionForUser,
  createServiceClient,
  getApproxLocation,
} from "../_shared/buildEdition.ts";

const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return false;

  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret && headerSecret === cronSecret) return true;

  const auth = req.headers.get("Authorization");
  if (auth === `Bearer ${cronSecret}`) return true;

  return false;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!isAuthorized(req)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createServiceClient();
    const editionDate = todayDateString();
    const location = await getApproxLocation();

    // 1) Enqueue: one pending job per user with interests who lacks today's ready edition.
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, interests");

    if (profilesError) {
      return json({ error: profilesError.message }, 500);
    }

    const eligible = (profiles ?? []).filter(
      (p: { id: string; interests?: string[] | null }) =>
        Array.isArray(p.interests) && p.interests.length > 0
    );

    let enqueued = 0;

    for (const profile of eligible) {
      const { data: existingEdition } = await supabaseAdmin
        .from("editions")
        .select("id")
        .eq("user_id", profile.id)
        .eq("edition_date", editionDate)
        .eq("status", "ready")
        .maybeSingle();

      if (existingEdition) continue;

      const { error: upsertError } = await supabaseAdmin
        .from("generation_jobs")
        .upsert(
          {
            user_id: profile.id,
            edition_date: editionDate,
            status: "pending",
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,edition_date",
            ignoreDuplicates: true,
          }
        );

      if (!upsertError) enqueued += 1;
    }

    // 2) Process a batch of pending (or retryable failed) jobs.
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from("generation_jobs")
      .select("*")
      .eq("edition_date", editionDate)
      .in("status", ["pending", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (jobsError) {
      return json({ error: jobsError.message }, 500);
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs ?? []) {
      processed += 1;

      await supabaseAdmin
        .from("generation_jobs")
        .update({
          status: "processing",
          attempts: job.attempts + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      const result = await buildEditionForUser(
        supabaseAdmin,
        job.user_id,
        location
      );

      if (result.ok) {
        succeeded += 1;
        await supabaseAdmin
          .from("generation_jobs")
          .update({
            status: "ready",
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      } else {
        failed += 1;
        await supabaseAdmin
          .from("generation_jobs")
          .update({
            status: "failed",
            last_error: result.error,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      }
    }

    return json({
      success: true,
      editionDate,
      enqueued,
      processed,
      succeeded,
      failed,
      // Push notifications ship in a follow-up; overnight copy is ready without them.
      push: "deferred",
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
