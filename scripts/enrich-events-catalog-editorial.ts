/**
 * Pre-generate and persist Local Events editorial for any U.S. metro catalog.
 * Run after events catalog sync so edition builds skip empty editorial gates.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... \
 *   npx --yes deno run --allow-net --allow-env --allow-read \
 *     scripts/enrich-events-catalog-editorial.ts --metro-key phoenix-az --all
 *
 *   # Verified-facts composer (no Anthropic — batch backfill):
 *   KINDRED_ALLOW_FALLBACK_SERVICE_KEY=1 \
 *   npx --yes deno run --allow-net --allow-env --allow-read \
 *     scripts/enrich-events-catalog-editorial.ts --metro-key phoenix-az --all --compose-verified
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  enrichEventsWithBanditNotes,
  eventHasPublishableEditorial,
} from "../supabase/functions/_shared/localEvents/banditNotes.ts";
import { persistEventEditorialBatch } from "../supabase/functions/_shared/localEvents/eventsCatalog.ts";
import {
  loadEventsCatalogForEdition,
  loadEventsCatalogForEnrichment,
} from "../supabase/functions/_shared/localEvents/eventsCatalogSync.ts";
import { allocateLocalEventsByHorizon } from "../supabase/functions/_shared/localEvents/horizonAllocator.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX } from "../supabase/functions/_shared/editorial/publishing.ts";
import { resolveEventTimezone } from "../supabase/functions/_shared/localEvents/eventTimezone.ts";
import type { LocalEvent, LocalEventLocation } from "../supabase/functions/_shared/localEvents/provider.ts";
import { composeVerifiedEventEditorialIfPublishable } from "../supabase/functions/_shared/localEvents/verifiedEventEditorialComposer.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ??
  (Deno.env.get("KINDRED_ALLOW_FALLBACK_SERVICE_KEY") === "1"
    ? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk"
    : undefined);
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");

const args = Deno.args;
const metroKey =
  args.find((a) => a.startsWith("--metro-key="))?.split("=")[1]?.trim() ??
  args[args.indexOf("--metro-key") + 1]?.trim();
const enrichAll = args.includes("--all");
const composeVerified = args.includes("--compose-verified");
/** Smaller batches — 6–10 paragraph articles need more tokens per event. */
const batchSize = composeVerified ? 20 : 2;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY required (or KINDRED_ALLOW_FALLBACK_SERVICE_KEY=1)");
  Deno.exit(1);
}
if (!composeVerified && !ANTHROPIC) {
  console.error("ANTHROPIC_API_KEY required unless --compose-verified");
  Deno.exit(1);
}
if (!metroKey) {
  console.error("Usage: --metro-key <metro-key> [--all] [--compose-verified]");
  Deno.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: market, error: marketError } = await admin
  .from("kindred_us_markets")
  .select("metro_key, primary_city, state_code, state_name, latitude, longitude")
  .eq("metro_key", metroKey)
  .maybeSingle();

if (marketError || !market) {
  console.error("Unknown metro_key:", metroKey, marketError?.message);
  Deno.exit(1);
}

const location: LocalEventLocation = {
  city: market.primary_city,
  state: market.state_code,
  region: market.state_name,
  lat: market.latitude,
  lon: market.longitude,
};

const editionDate = Deno.env.get("AUDIT_EDITION_DATE") ?? new Date().toISOString().slice(0, 10);
const now = new Date(`${editionDate}T12:00:00`);
const timezone = resolveEventTimezone(location);

console.log("[enrich] metro", metroKey, location.city, {
  mode: enrichAll ? "ALL verified" : "surfaced cap",
  composer: composeVerified ? "verified-facts" : "anthropic",
});

const ranked = enrichAll
  ? await loadEventsCatalogForEnrichment(admin, location, {
      now,
      editionDate,
      timezone,
      catalogMetroKey: metroKey,
    })
  : await loadEventsCatalogForEdition(admin, location, {
      now,
      editionDate,
      timezone,
      catalogMetroKey: metroKey,
    });

let targets = enrichAll
  ? ranked
  : allocateLocalEventsByHorizon(ranked, {
      maxTotal: LOCAL_EVENTS_EDITION_SURFACED_MAX,
      now,
      readerCity: location.city,
      readerLat: location.lat,
      readerLon: location.lon,
    });

targets = targets.filter((e) => !eventHasPublishableEditorial(e));

console.log("[enrich] need copy for", targets.length, "events (from pool", ranked.length, ")");

let enrichedTotal = 0;
let persistedTotal = 0;
let rejectedTotal = 0;

for (let i = 0; i < targets.length; i += batchSize) {
  const batch = targets.slice(i, i + batchSize);
  let publishable: LocalEvent[] = [];

  if (composeVerified) {
    for (const event of batch) {
      const copy = composeVerifiedEventEditorialIfPublishable(event, { editionDate });
      if (copy) {
        publishable.push({
          ...event,
          editorialHeadline: copy.editorialHeadline,
          banditNote: copy.banditNote,
          editorialBody: copy.editorialBody,
        });
      } else {
        rejectedTotal += 1;
        console.warn("[enrich] verified composer rejected", event.name.slice(0, 60));
      }
    }
    enrichedTotal += publishable.length;
  } else {
    const enriched = await enrichEventsWithBanditNotes(batch, {
      editionDate,
      maxGenerate: batch.length,
    });
    enrichedTotal += enriched.length;
    publishable = enriched.filter((e) => eventHasPublishableEditorial(e));
    rejectedTotal += batch.length - publishable.length;
  }

  const result = await persistEventEditorialBatch(admin, publishable, metroKey);
  persistedTotal += result.updated;

  console.log("[enrich] batch", {
    from: i + 1,
    to: Math.min(i + batchSize, targets.length),
    publishable: publishable.length,
    persisted: result.updated,
  });

  if (!composeVerified && i + batchSize < targets.length) {
    await new Promise((r) => setTimeout(r, 1500));
  }
}

console.log("[enrich] done", {
  metroKey,
  enrichedTotal,
  persistedTotal,
  rejectedTotal,
  remainingWithoutCopy: targets.length - persistedTotal,
});
