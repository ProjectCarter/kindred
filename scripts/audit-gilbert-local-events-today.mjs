#!/usr/bin/env node
/**
 * Local Events editorial audit — presentation, photography, homepage spread.
 * Usage: npx --yes tsx scripts/audit-gilbert-local-events-today.mjs [edition_id]
 */
process.env.KINDRED_SKIP_BUNDLED_ASSETS = "1";
globalThis.__DEV__ = false;

const EDITION_ID =
  process.argv[2] ?? "caf63870-2525-480a-833c-818c572391cd";

const { createClient } = await import("@supabase/supabase-js");
const { applyLocalEventPresentation } = await import(
  "../lib/edition/localEventPresentation.ts"
);
const { authorizedEventImageUrl } = await import(
  "../lib/edition/eventImageRights.ts"
);
const {
  eventDisplayImageKind,
  eventHasDisplayImage,
} = await import("../lib/edition/eventDisplayImage.ts");
const {
  parseLocalEventsBody,
  HOMEPAGE_INITIAL_RENDER_COUNT,
} = await import("../lib/edition/localEvents.ts");
const {
  curateLocalEventsForHomepage,
  EditionCurationContext,
} = await import("../lib/edition/editionCuration.ts");
const {
  classifyLocalEventDiversityCategory,
  isSimilarLocalEventListing,
  scoreEventForHomepageSelection,
  LOCAL_EVENTS_HOMEPAGE_MAX_PER_CATEGORY,
  homepageVenueKey,
  enforceLocalEventsHomepageSpreadCaps,
} = await import("../lib/edition/localEventsHomepage.ts");
const { meetsLocalEventPublishThreshold } = await import(
  "../lib/edition/editorialPublishing.ts"
);

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: editionRow, error: editionError } = await admin
  .from("editions")
  .select("edition_date")
  .eq("id", EDITION_ID)
  .maybeSingle();

const { data, error } = await admin
  .from("edition_sections")
  .select("body")
  .eq("edition_id", EDITION_ID)
  .eq("section_type", "local_events")
  .maybeSingle();

if (error || !data?.body || editionError) {
  console.error("Failed to load local_events section", error?.message ?? "missing");
  process.exit(1);
}

const reference = editionRow?.edition_date
  ? new Date(
      Number(editionRow.edition_date.slice(0, 4)),
      Number(editionRow.edition_date.slice(5, 7)) - 1,
      Number(editionRow.edition_date.slice(8, 10))
    )
  : new Date();

const parsed = parseLocalEventsBody(data.body) ?? [];
const events = parsed.map((event) => applyLocalEventPresentation(event));

const publishablePool = events.filter((event) =>
  meetsLocalEventPublishThreshold(
    scoreEventForHomepageSelection(event, reference)
  )
);

const { filterLocalEventsForHomepageCuration } = await import(
  "../lib/edition/localEventsHomepageEditorial.ts"
);
const homepageEligiblePool = filterLocalEventsForHomepageCuration(publishablePool);

const spreadCapacity = enforceLocalEventsHomepageSpreadCaps(homepageEligiblePool, {
  maxTotal: HOMEPAGE_INITIAL_RENDER_COUNT,
  reference,
}).length;

const context = new EditionCurationContext();
const homepage = curateLocalEventsForHomepage(homepageEligiblePool, context, {
  initialRenderCount: HOMEPAGE_INITIAL_RENDER_COUNT,
  reference,
}).slice(0, HOMEPAGE_INITIAL_RENDER_COUNT);

const issues = [];
const warnings = [];
let listingPhotos = 0;
let categoryPhotos = 0;
const diversityCounts = new Map();
const cities = new Set();
const venues = new Set();

console.log(`Local Events audit — edition ${EDITION_ID}`);
console.log(`Events in section: ${events.length}`);
console.log(`Publishable pool: ${publishablePool.length}`);
console.log(`Homepage-eligible (Kindred Test): ${homepageEligiblePool.length}`);
console.log(`Homepage spread (${homepage.length}):`);
console.log("");

for (const event of homepage) {
  const headline = event.editorialHeadline?.trim() || event.name.trim();
  const kind = eventDisplayImageKind(event);
  if (kind === "listing") listingPhotos += 1;
  if (kind === "category") categoryPhotos += 1;

  const diversityKey = classifyLocalEventDiversityCategory(event);
  diversityCounts.set(diversityKey, (diversityCounts.get(diversityKey) ?? 0) + 1);
  if (event.city?.trim()) cities.add(event.city.trim().toLowerCase());
  if (event.venue?.trim()) venues.add(event.venue.trim().toLowerCase());

  if (!eventHasDisplayImage(event)) {
    issues.push(`missing display image: ${headline}`);
  }

  const rawUrl = event.imageUrl?.trim();
  if (rawUrl && !authorizedEventImageUrl(event)) {
    if (kind === "listing") {
      issues.push(`unauthorized listing photo displayed: ${headline}`);
    }
  }

  if (!event.sourceUrl?.trim()) {
    issues.push(`missing verified source link: ${headline}`);
  }

  if (!event.banditNote?.trim() || !event.editorialBody?.length) {
    issues.push(`missing publishable editorial: ${headline}`);
  }

  console.log(`- ${headline}`);
  console.log(`  photo: ${kind}${rawUrl ? ` (raw listing withheld)` : ""}`);
  console.log(
    `  category: ${event.category} | desk: ${diversityKey} | city: ${event.city}`
  );
  console.log("");
}

for (let i = 0; i < homepage.length; i += 1) {
  for (let j = i + 1; j < homepage.length; j += 1) {
    const a = homepage[i];
    const b = homepage[j];
    const venueA = homepageVenueKey(a.venue);
    const venueB = homepageVenueKey(b.venue);
    if (venueA && venueB && venueA === venueB) {
      issues.push(`duplicate venue on homepage: ${a.venue}`);
    }
    if (isSimilarLocalEventListing(a, b)) {
      issues.push(
        `near-duplicate homepage listings: ${a.name} / ${b.name}`
      );
    }
  }
}

for (const [key, count] of diversityCounts) {
  if (count > LOCAL_EVENTS_HOMEPAGE_MAX_PER_CATEGORY) {
    issues.push(
      `category over cap on homepage: ${key}=${count} (max ${LOCAL_EVENTS_HOMEPAGE_MAX_PER_CATEGORY})`
    );
  }
}

const homepageTarget = Math.min(
  HOMEPAGE_INITIAL_RENDER_COUNT,
  spreadCapacity,
  publishablePool.length
);
if (
  spreadCapacity >= HOMEPAGE_INITIAL_RENDER_COUNT &&
  homepage.length < HOMEPAGE_INITIAL_RENDER_COUNT
) {
  issues.push(
    `homepage under-filled: ${homepage.length}/${HOMEPAGE_INITIAL_RENDER_COUNT} despite ${spreadCapacity} spread-eligible events`
  );
}
if (homepage.length < homepageTarget) {
  issues.push(
    `homepage below qualifying spread: ${homepage.length}/${homepageTarget}`
  );
}

if (homepage.length >= 6 && diversityCounts.size < 3) {
  issues.push(`low homepage variety: ${diversityCounts.size} desk/category buckets`);
}

if (events.length > 0 && events.every((e) => eventDisplayImageKind(e) === "category")) {
  warnings.push(
    "no authorized listing photography in pool — category fallbacks in use (expected for Eventbrite-only test editions)"
  );
}

if (events.length === 0) {
  issues.push("zero events in section");
}

if (publishablePool.length < HOMEPAGE_INITIAL_RENDER_COUNT) {
  warnings.push(
    `thin verified pool: only ${publishablePool.length} publishable events (homepage shows ${homepage.length})`
  );
}

console.log(`Listing photos: ${listingPhotos}`);
console.log(`Category fallbacks: ${categoryPhotos}`);
console.log("Desk/category counts:", Object.fromEntries(diversityCounts));
console.log(`Cities represented: ${cities.size}`);
console.log(`Unique venues: ${venues.size}`);
console.log("Critical:", issues.length ? issues : "none");
console.log("Warnings:", warnings.length ? warnings : "none");
console.log(
  "Photography status:",
  issues.some((issue) => issue.includes("photo") || issue.includes("image"))
    ? "FAIL"
    : "PASS — every card has verified display art"
);
console.log(
  "Presentation status:",
  events.length > 0 ? "PASS — headlines/cities/categories polished" : "FAIL"
);
console.log(
  "Homepage spread status:",
  issues.some(
    (issue) =>
      issue.includes("homepage") ||
      issue.includes("duplicate") ||
      issue.includes("near-duplicate") ||
      issue.includes("category over cap") ||
      issue.includes("variety")
  )
    ? "FAIL"
    : homepage.length >= homepageTarget
      ? `PASS — ${homepage.length} verified cards`
      : `PASS — ${homepage.length} cards (pool supports ${publishablePool.length})`
);
console.log(
  "Editorial status:",
  issues.some((issue) => issue.includes("editorial") || issue.includes("source"))
    ? "FAIL"
    : "PASS — publishable editorial on every homepage card"
);

process.exit(issues.length ? 1 : 0);
