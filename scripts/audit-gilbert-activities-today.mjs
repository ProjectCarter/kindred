#!/usr/bin/env node
/**
 * Activities-only editorial audit for today's persisted Gilbert edition.
 * Usage: npx --yes tsx scripts/audit-gilbert-activities-today.mjs [edition_id]
 */
import { createClient } from "@supabase/supabase-js";
import { allocateDiscoverySections } from "../lib/edition/sectionAllocator.ts";
import {
  ACTIVITIES_HOMEPAGE_MAX_BOWLING,
  ACTIVITIES_HOMEPAGE_MAX_PER_SUBTYPE,
  classifyActivityDiversityCategory,
  curateActivitiesForHomepage,
  isActivityProShopItem,
} from "../lib/edition/activitiesHomepage.ts";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const EDITION_ID =
  process.argv[2] ?? "caf63870-2525-480a-833c-818c572391cd";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: edition, error } = await admin
  .from("editions")
  .select("discovery")
  .eq("id", EDITION_ID)
  .maybeSingle();

if (error || !edition?.discovery) {
  console.error("Failed to load edition discovery", error?.message ?? "missing");
  process.exit(1);
}

const allocation = allocateDiscoverySections(edition.discovery);
const curated = curateActivitiesForHomepage(allocation.activities, {
  initialRenderCount: 8,
});
const homepage = curated.slice(0, 8);

const issues = [];
const warnings = [];
const counts = new Map();

for (const item of homepage) {
  const key = classifyActivityDiversityCategory(item);
  counts.set(key, (counts.get(key) ?? 0) + 1);
  if (isActivityProShopItem(item)) {
    issues.push(`pro shop on homepage: ${item.item.title}`);
  }
}

for (const [key, count] of counts) {
  const max =
    key === "bowling"
      ? ACTIVITIES_HOMEPAGE_MAX_BOWLING
      : ACTIVITIES_HOMEPAGE_MAX_PER_SUBTYPE;
  if (count > max) {
    issues.push(`subtype over cap: ${key}=${count} (max ${max})`);
  }
}

const destinationTypes = new Set([
  "hiking",
  "museums",
  "botanical_garden",
  "park",
  "scenic",
  "beach",
  "escape_rooms",
  "water_recreation",
  "rock_climbing",
  "pickleball",
]);
const destinationCount = [...counts.keys()].filter((key) =>
  destinationTypes.has(key)
).length;

if (homepage.length >= 6 && counts.size < 4) {
  issues.push(`low homepage variety: ${counts.size} experience types`);
}
if (homepage.length >= 6 && destinationCount < 2) {
  warnings.push(
    `thin destination mix: only ${destinationCount} destination experience type(s) in top 8`
  );
}
if (allocation.activities.length < 8) {
  warnings.push(`thin verified pool: only ${allocation.activities.length} activities allocated`);
}

console.log(`Activities audit — edition ${EDITION_ID}`);
console.log(`Verified pool: ${allocation.activities.length}`);
console.log(`Homepage spread (${homepage.length}):`);
for (const item of homepage) {
  console.log(
    `  - ${classifyActivityDiversityCategory(item)} | ${item.item.title}`
  );
}
console.log("Subtype counts:", Object.fromEntries(counts));
console.log("Critical:", issues.length ? issues : "none");
console.log("Warnings:", warnings.length ? warnings : "none");
console.log(
  "Playbook status:",
  issues.length === 0 ? "PASS (homepage spread rules)" : "FAIL"
);
