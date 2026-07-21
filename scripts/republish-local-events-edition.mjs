#!/usr/bin/env node
/**
 * Republish local_events edition section using verified editorial surfacing.
 * Usage: npx --yes tsx scripts/republish-local-events-edition.mjs [edition_id]
 */
process.env.KINDRED_SKIP_BUNDLED_ASSETS = "1";

const EDITION_ID =
  process.argv[2] ?? "caf63870-2525-480a-833c-818c572391cd";

const { createClient } = await import("@supabase/supabase-js");
const {
  resolveEditionMarket,
  catalogMetroKeyForMarket,
} = await import("../lib/markets/resolveEditionMarket.ts");
const { getLocalEvents, buildLocalEventsBody } = await import(
  "../supabase/functions/_shared/localEvents/provider.ts"
);
const { resolveEventTimezone } = await import(
  "../supabase/functions/_shared/localEvents/eventTimezone.ts"
);
const { filterLocalEventsByMarket } = await import(
  "../lib/markets/editionMarketIsolation.ts"
);
const { filterFamilyFriendlyEvents } = await import(
  "../supabase/functions/_shared/localEvents/familyFriendlyFilter.ts"
);
const { filterEventsForLocalEventsDesk } = await import(
  "../supabase/functions/_shared/edition/editionSectionOwnership.ts"
);
const { allocateLocalEventsByHorizon } = await import(
  "../supabase/functions/_shared/localEvents/horizonAllocator.ts"
);
const { surfaceLocalEventsForEdition } = await import(
  "../supabase/functions/_shared/localEvents/surfaceLocalEventsForEdition.ts"
);
const { assertEventsVerifiedForPublication } = await import(
  "../supabase/functions/_shared/localEvents/eventDateVerification.ts"
);
const {
  HOMEPAGE_INITIAL_RENDER_COUNT,
  LOCAL_EVENTS_EDITION_SURFACED_MAX,
} = await import("../supabase/functions/_shared/editorial/publishing.ts");
const { selectEditorialHomepageLocalEvents } = await import(
  "../lib/edition/localEventsHomepage.ts"
);

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: edition, error: editionError } = await admin
  .from("editions")
  .select("id, edition_date, metro_key, editorial_context")
  .eq("id", EDITION_ID)
  .maybeSingle();

if (editionError || !edition) {
  console.error("Edition not found", editionError?.message ?? EDITION_ID);
  process.exit(1);
}

const location = {
  city: "Gilbert",
  state: "AZ",
  region: "Arizona",
  lat: 33.2748,
  lon: -111.7769,
};

const market = resolveEditionMarket(location);
const catalogMetroKey = market ? catalogMetroKeyForMarket(market) : edition.metro_key;
const eventTimezone = resolveEventTimezone(location);
const editionDateObj = new Date(
  Number(edition.edition_date.slice(0, 4)),
  Number(edition.edition_date.slice(5, 7)) - 1,
  Number(edition.edition_date.slice(8, 10))
);

let raw = await getLocalEvents(location, {
  admin,
  catalogMetroKey,
  editionDate: edition.edition_date,
  timezone: eventTimezone,
});

if (market) {
  raw = filterLocalEventsByMarket(raw, market, {
    lat: location.lat,
    lon: location.lon,
    city: location.city,
    state: location.state,
  }).kept;
}

const familyFiltered = filterFamilyFriendlyEvents(raw);
const owned = filterEventsForLocalEventsDesk(familyFiltered.kept);
const allocated = allocateLocalEventsByHorizon(owned.kept, {
  maxTotal: LOCAL_EVENTS_EDITION_SURFACED_MAX,
  now: editionDateObj,
  readerCity: location.city,
  readerLat: location.lat,
  readerLon: location.lon,
});

const reservePool = owned.kept.filter(
  (candidate) =>
    !allocated.some(
      (picked) =>
        `${picked.name}|${picked.startDateTime}`.toLowerCase() ===
        `${candidate.name}|${candidate.startDateTime}`.toLowerCase()
    )
);

const surfaced = await surfaceLocalEventsForEdition(allocated, reservePool, {
  editionDate: edition.edition_date,
  allowAiEnrichment: false,
  homepageMinimum: HOMEPAGE_INITIAL_RENDER_COUNT,
  now: editionDateObj,
  readerCity: location.city,
  readerLat: location.lat,
  readerLon: location.lon,
});

const publishable = assertEventsVerifiedForPublication(surfaced, {
  now: editionDateObj,
  location,
  eventTimezone,
  editionDate: edition.edition_date,
});

const body = buildLocalEventsBody(publishable, { editionCity: location.city });

const { error: updateError } = await admin
  .from("edition_sections")
  .update({ body })
  .eq("edition_id", EDITION_ID)
  .eq("section_type", "local_events");

if (updateError) {
  console.error("Failed to update local_events section", updateError.message);
  process.exit(1);
}

const cards = JSON.parse(body).events ?? [];
const { homepage } = selectEditorialHomepageLocalEvents(cards, {
  maxTotal: HOMEPAGE_INITIAL_RENDER_COUNT,
  reference: editionDateObj,
});

console.log(`Republished local_events for edition ${EDITION_ID}`);
console.log(`Verified pool: ${publishable.length}`);
console.log(`Homepage spread: ${homepage.length}`);
for (const event of homepage) {
  console.log(`  - ${event.editorialHeadline ?? event.name}`);
}
