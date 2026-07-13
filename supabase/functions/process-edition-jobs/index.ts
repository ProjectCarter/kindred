// Kindred — process-edition-jobs
// Frequently-swept overnight worker (see supabase/migrations/0015_edition_reliability.sql
// for the pg_cron schedule — every 10 minutes). Does not send email/push;
// auth is a shared secret. Each invocation:
//   1. Reaps jobs stuck in `processing` from a worker that crashed mid-build.
//   2. Enqueues one job per eligible user whose *local* clock says it's time
//      (>= EARLIEST_LOCAL_HOUR) and who doesn't already have a ready edition
//      for their own local date.
//   3. Atomically claims a batch of pending/failed jobs — `FOR UPDATE SKIP
//      LOCKED` under the hood, so overlapping sweeps can't double-build the
//      same job — and builds the whole batch concurrently.

import {
  buildEditionForUser,
  createServiceClient,
  resolveEditionLocation,
} from "../_shared/buildEdition.ts";

const BATCH_SIZE = 15;
const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MINUTES = 10;
// Don't build before 2am local — avoids generating on yesterday's news the
// instant a user's local midnight ticks over. Everything from here through
// end-of-day is "catch-up": if a user still has no ready edition, try now
// rather than waiting for a narrow window that might have been missed.
const EARLIEST_LOCAL_HOUR = 2;
// Fallback for any profile that hasn't reported a device timezone yet
// (lib/edition/timezone.ts populates this opportunistically on the client).
const DEFAULT_TIMEZONE = "America/Phoenix";

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

/** A user's local calendar date + hour, from an IANA timezone name. */
function localDateAndHour(
  timeZone: string,
  now: Date
): { dateStr: string; hour: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    let hour = Number(get("hour"));
    if (hour === 24) hour = 0; // some locales render midnight as "24"
    if (!year || !month || !day || Number.isNaN(hour)) {
      throw new Error("unparseable parts");
    }
    return { dateStr: `${year}-${month}-${day}`, hour };
  } catch {
    // Invalid/unknown IANA zone string stored on a profile — fall back
    // rather than let one bad value break the whole sweep.
    if (timeZone === DEFAULT_TIMEZONE) {
      // Guard against DEFAULT_TIMEZONE itself somehow failing.
      return { dateStr: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
    }
    return localDateAndHour(DEFAULT_TIMEZONE, now);
  }
}

type GenerationJobRow = {
  id: string;
  user_id: string;
  edition_date: string;
  status: string;
  attempts: number;
  last_error: string | null;
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!isAuthorized(req)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseAdmin = createServiceClient();
    const now = new Date();

    // 0) Recover jobs a crashed worker left stuck in `processing`.
    const { data: reapedCount, error: reapError } = await supabaseAdmin.rpc(
      "reap_stale_generation_jobs",
      { p_stale_after_minutes: STALE_PROCESSING_MINUTES }
    );
    if (reapError) {
      console.error("[process-edition-jobs] reap failed", reapError.message);
    }

    // 1) Enqueue: one pending job per eligible user whose local clock says
    // it's time, keyed to THEIR local date — not one shared UTC "today".
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, interests, timezone");

    if (profilesError) {
      return json({ error: profilesError.message }, 500);
    }

    const eligible = (profiles ?? []).filter(
      (p: { id: string; interests?: string[] | null }) =>
        Array.isArray(p.interests) && p.interests.length > 0
    ) as Array<{ id: string; timezone?: string | null }>;

    let enqueued = 0;
    let skippedTooEarly = 0;
    const localDatesInPlay = new Set<string>();

    for (const profile of eligible) {
      const tz = profile.timezone || DEFAULT_TIMEZONE;
      const { dateStr: localDate, hour: localHour } = localDateAndHour(tz, now);
      localDatesInPlay.add(localDate);

      if (localHour < EARLIEST_LOCAL_HOUR) {
        skippedTooEarly += 1;
        continue; // still the middle of this user's night — wait for the window
      }

      const { data: existingEdition } = await supabaseAdmin
        .from("editions")
        .select("id")
        .eq("user_id", profile.id)
        .eq("edition_date", localDate)
        .eq("status", "ready")
        .maybeSingle();

      if (existingEdition) continue;

      const { error: upsertError } = await supabaseAdmin
        .from("generation_jobs")
        .upsert(
          {
            user_id: profile.id,
            edition_date: localDate,
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

    // 2) Atomically claim a batch. Not scoped to one edition_date — every
    // job already carries the correct per-user local date from enqueue, so
    // a single global claim across all of them is simpler and still correct.
    const { data: claimedRaw, error: claimError } = await supabaseAdmin.rpc(
      "claim_generation_jobs",
      { p_max_attempts: MAX_ATTEMPTS, p_batch_size: BATCH_SIZE }
    );

    if (claimError) {
      return json({ error: claimError.message }, 500);
    }

    const claimed = (claimedRaw ?? []) as GenerationJobRow[];

    // 3) Build the claimed batch concurrently. Sequential would blow past
    // the Edge Function's own execution timeout well before a batch
    // finished — each build can take ~60-90s, so 15 in a row would take
    // 15-20+ minutes. Concurrent keeps one sweep to roughly one edition's
    // worth of wall time, regardless of batch size.
    const results = await Promise.all(
      claimed.map(async (job) => {
        const location = await resolveEditionLocation(
          supabaseAdmin,
          job.user_id,
          null
        );

        if (!location) {
          await supabaseAdmin
            .from("generation_jobs")
            .update({
              status: "failed",
              last_error:
                "No location set. Choose a home city or enable current location.",
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          return { ok: false };
        }

        const result = await buildEditionForUser(supabaseAdmin, job.user_id, location, {
          editionDate: job.edition_date,
          temperatureUnitPreference: "auto",
        });

        await supabaseAdmin
          .from("generation_jobs")
          .update(
            result.ok
              ? {
                  status: "ready",
                  last_error: null,
                  updated_at: new Date().toISOString(),
                }
              : {
                  status: "failed",
                  last_error: result.error,
                  updated_at: new Date().toISOString(),
                }
          )
          .eq("id", job.id);

        return { ok: result.ok };
      })
    );

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    return json({
      success: true,
      now: now.toISOString(),
      reaped: reapedCount ?? 0,
      localDatesInPlay: Array.from(localDatesInPlay),
      enqueued,
      skippedTooEarly,
      processed: results.length,
      succeeded,
      failed,
      // Push notifications ship in a follow-up; overnight copy is ready without them.
      push: "deferred",
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
