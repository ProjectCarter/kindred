// Kindred / D.R.O.P. — sync-deals-catalog
// Scheduled server-side Offers (deals) catalog sync + publish.
// Gathers from every configured affiliate connector (Awin, …), drops unsafe /
// non-redeemable offers, and upserts survivors into deals_catalog +
// deals_published. Auth: CRON_SECRET — never called from the client app, and no
// affiliate network is ever contacted during an app page load.

import { createServiceClient } from "../_shared/editionRuntime.ts";
import { runDealsSync } from "../_shared/deals/publish.ts";

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
  return auth === `Bearer ${cronSecret}`;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    if (!isAuthorized(req)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as {
      mode?: "incremental" | "full";
    };
    const mode = body.mode === "full" ? "full" : "incremental";

    const admin = createServiceClient();
    const stats = await runDealsSync(admin, { mode });

    console.log("[deals:catalog] scheduled run complete", { mode, ...stats });

    return json({ mode, ...stats }, stats.ok ? 200 : 500);
  } catch (err) {
    console.error("[deals:catalog] sync failure", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
