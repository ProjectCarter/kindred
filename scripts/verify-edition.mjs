/**
 * Verify persisted edition completeness in Supabase.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = "2026-07-15";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function discoverySurfaceItemCount(discovery) {
  if (!discovery?.surfaces) return 0;
  let total = 0;
  for (const surface of Object.values(discovery.surfaces)) {
    total += surface?.items?.length ?? 0;
  }
  return total;
}

function countBySurface(discovery) {
  if (!discovery?.surfaces) return {};
  const out = {};
  for (const [key, surface] of Object.entries(discovery.surfaces)) {
    out[key] = surface?.items?.length ?? 0;
  }
  return out;
}

const { data: editions, error } = await admin
  .from("editions")
  .select("id,status,edition_date,lead_story,bandit,discovery")
  .eq("user_id", USER_ID)
  .eq("edition_date", EDITION_DATE);

if (error || !editions?.length) {
  console.error("edition query failed", error);
  process.exit(1);
}

const edition = editions[0];
const { data: sections } = await admin
  .from("edition_sections")
  .select("section_type,position,headline")
  .eq("edition_id", edition.id)
  .order("position");

const sectionTypes = (sections ?? []).map((s) => s.section_type);
const discoveryItems = discoverySurfaceItemCount(edition.discovery);
const surfaceCounts = countBySurface(edition.discovery);
const hasBanditsPick = Boolean(edition.bandit?.pick);
const hasLeadStory = Boolean(edition.lead_story?.headline || edition.lead_story?.title);

const checks = {
  status: edition.status,
  editionId: edition.id,
  weather: sectionTypes.includes("weather"),
  local_events: sectionTypes.includes("local_events"),
  today_in_history: sectionTypes.includes("today_in_history"),
  discoverySurfaceItems: discoveryItems,
  discoverySurfaceBreakdown: surfaceCounts,
  bandits_pick: hasBanditsPick,
  local_news: hasLeadStory,
  sectionCount: sectionTypes.length,
  sectionTypes,
};

const complete =
  checks.status === "ready" &&
  checks.weather &&
  checks.local_events &&
  checks.today_in_history &&
  checks.discoverySurfaceItems > 0 &&
  checks.bandits_pick &&
  checks.local_news;

console.log(JSON.stringify({ complete, checks }, null, 2));
process.exit(complete ? 0 : 1);
