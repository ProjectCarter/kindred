// Kindred — sweep-live-refresh
// Frequently-swept worker (see supabase/migrations/0016_live_refresh.sql for
// the pg_cron schedule) that keeps today's *already-ready* editions' live
// metadata (event times/cancellations/tickets, qualifying recommendations)
// fresh even if nobody reopens the app for hours. Same shared logic as
// refresh-live-data — see _shared/liveRefresh.ts for exactly what it does
// and doesn't touch. Auth is a shared secret, same pattern as
// process-edition-jobs.

import {
  createServiceClient,
  resolveEditionLocation,
} from "../_shared/editionRuntime.ts";
import { refreshLiveDataForEdition } from "../_shared/liveRefresh.ts";

const BATCH_SIZE = 25;
// Editions refreshed more recently than this are left alone — keeps the
// sweep cheap and avoids hammering SerpAPI/Foursquare every run.
const MIN_REFRESH_INTERVAL_MINUTES = 20;
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

/** A user's local calendar date, from an IANA timezone name. */
function localDateFor(timeZone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  } catch {
    if (timeZone === DEFAULT_TIMEZONE) {
      return now.toISOString().slice(0, 10);
    }
    return localDateFor(DEFAULT_TIMEZONE, now);
  }
}

type EditionRow = {
  id: string;
  user_id: string;
  edition_date: string;
  live_refreshed_at: string | null;
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!isAuthorized(req)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createServiceClient();
    const now = new Date();
    const cutoff = new Date(
      now.getTime() - MIN_REFRESH_INTERVAL_MINUTES * 60_000
    ).toISOString();

    // Ready editions dated today-or-yesterday (UTC) cover every timezone's
    // "today" without a per-user query — each candidate's *own* local date
    // is re-checked below before it's touched.
    const yesterday = new Date(now.getTime() - 24 * 60 * 60_000)
      .toISOString()
      .slice(0, 10);

    const { data: candidatesRaw, error: candidatesError } = await admin
      .from("editions")
      .select("id, user_id, edition_date, live_refreshed_at")
      .eq("status", "ready")
      .gte("edition_date", yesterday)
      .or(`live_refreshed_at.is.null,live_refreshed_at.lt.${cutoff}`)
      .limit(BATCH_SIZE * 3); // profiles.timezone filter below narrows further

    if (candidatesError) {
      return json({ error: candidatesError.message }, 500);
    }

    const candidates = (candidatesRaw ?? []) as EditionRow[];
    if (candidates.length === 0) {
      return json({ success: true, now: now.toISOString(), processed: 0 });
    }

    const userIds = Array.from(new Set(candidates.map((c) => c.user_id)));
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, timezone, interests")
      .in("id", userIds);

    if (profilesError) {
      return json({ error: profilesError.message }, 500);
    }

    const profileById = new Map(
      (profiles ?? []).map((p) => [p.id as string, p])
    );

    // Only touch editions that are actually "today" for that user right now.
    const eligible = candidates
      .filter((c) => {
        const tz = profileById.get(c.user_id)?.timezone || DEFAULT_TIMEZONE;
        return localDateFor(tz, now) === c.edition_date;
      })
      .slice(0, BATCH_SIZE);

    const results = await Promise.all(
      eligible.map(async (edition) => {
        const location = await resolveEditionLocation(
          admin,
          edition.user_id,
          null
        );
        if (!location) {
          await admin
            .from("editions")
            .update({ live_refreshed_at: now.toISOString() })
            .eq("id", edition.id);
          return { ok: false, reason: "no_location" };
        }

        const interests = profileById.get(edition.user_id)?.interests ?? [];
        const result = await refreshLiveDataForEdition(admin, {
          editionId: edition.id,
          userId: edition.user_id,
          editionDate: edition.edition_date,
          location,
          interests,
        });

        await admin
          .from("editions")
          .update({ live_refreshed_at: now.toISOString() })
          .eq("id", edition.id);

        return {
          ok: result.events.ok && result.discovery.ok,
          changed: result.events.changed || result.discovery.changed,
        };
      })
    );

    const succeeded = results.filter((r) => r.ok).length;
    const changed = results.filter((r) => "changed" in r && r.changed).length;

    return json({
      success: true,
      now: now.toISOString(),
      candidates: candidates.length,
      processed: results.length,
      succeeded,
      failed: results.length - succeeded,
      changed,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
