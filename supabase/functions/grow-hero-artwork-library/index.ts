// Kindred — grow-hero-artwork-library
// Background worker that quietly expands the permanent Hero Artwork Library.
// Never runs during edition build — see librarySelection.ts for daily picks.
// Auth: shared CRON_SECRET (same pattern as process-edition-jobs).

import { createServiceClient } from "../_shared/buildEdition.ts";
import { growHeroArtworkLibrary } from "../_shared/heroArtwork/backgroundDiscovery.ts";

const DEFAULT_TARGET_NEW = 8;

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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  if (!isAuthorized(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!anthropicApiKey) {
    return json({ error: "missing_anthropic_api_key" }, 500);
  }

  let targetNewCount = DEFAULT_TARGET_NEW;
  try {
    const body = await req.json();
    if (typeof body?.targetNewCount === "number" && body.targetNewCount > 0) {
      targetNewCount = Math.min(body.targetNewCount, 20);
    }
  } catch {
    // empty body is fine
  }

  const admin = createServiceClient();
  const result = await growHeroArtworkLibrary(admin, {
    anthropicApiKey,
    targetNewCount,
  });

  return json({
    ok: true,
    ...result,
  });
});
