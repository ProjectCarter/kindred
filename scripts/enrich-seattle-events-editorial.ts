/**
 * Pre-generate and persist Local Events editorial for Seattle catalog rows.
 * @deprecated Use scripts/enrich-events-catalog-editorial.ts --metro-key seattle-wa
 * Run before edition generation so buildEdition skips Claude for cached copy.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... \
 *   npx --yes deno run --allow-net --allow-env scripts/enrich-seattle-events-editorial.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { enrichEventsWithBanditNotes } from "../supabase/functions/_shared/localEvents/banditNotes.ts";
import { persistEventEditorialBatch } from "../supabase/functions/_shared/localEvents/eventsCatalog.ts";
import { loadEventsCatalogForEdition } from "../supabase/functions/_shared/localEvents/eventsCatalogSync.ts";
import { allocateLocalEventsByHorizon } from "../supabase/functions/_shared/localEvents/horizonAllocator.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX } from "../supabase/functions/_shared/editorial/publishing.ts";
import { resolveEventTimezone } from "../supabase/functions/_shared/localEvents/eventTimezone.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC = Deno.env.get("ANTHROPIC_API_KEY");

if (!SERVICE_KEY || !ANTHROPIC) {
  console.error("SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY required");
  Deno.exit(1);
}

const SEATTLE = {
  city: "Seattle",
  state: "WA",
  region: "Washington",
  lat: 47.6062,
  lon: -122.3321,
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const editionDate = Deno.env.get("AUDIT_EDITION_DATE") ?? "2026-07-17";
const now = new Date(`${editionDate}T12:00:00-07:00`);
const timezone = resolveEventTimezone(SEATTLE);

const ranked = await loadEventsCatalogForEdition(admin, SEATTLE, {
  now,
  editionDate,
  timezone,
});

const surfaced = allocateLocalEventsByHorizon(ranked, {
  maxTotal: LOCAL_EVENTS_EDITION_SURFACED_MAX,
  now,
  readerCity: SEATTLE.city,
});

console.log("[enrich] surfaced", surfaced.length, "from ranked", ranked.length);

const enriched = await enrichEventsWithBanditNotes(surfaced, {
  editionDate,
  maxGenerate: LOCAL_EVENTS_EDITION_SURFACED_MAX,
});

const withCopy = enriched.filter(
  (e) => e.banditNote?.trim() || e.editorialBody?.length
);
console.log("[enrich] with publishable copy", withCopy.length, "/", enriched.length);

const result = await persistEventEditorialBatch(admin, enriched, "seattle-wa");
console.log("[enrich] persisted", result);

for (const e of enriched.slice(0, 5)) {
  console.log({
    name: e.name.slice(0, 55),
    note: e.banditNote?.slice(0, 80) ?? null,
    bodyParas: e.editorialBody?.length ?? 0,
    image: Boolean(e.imageUrl),
    provider: e.sourceId,
  });
}
