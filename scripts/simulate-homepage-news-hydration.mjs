/**
 * Simulate National News homepage hydration paths (cold/warm/refresh).
 * Run: node scripts/simulate-homepage-news-hydration.mjs
 */
import { createClient } from "@supabase/supabase-js";
import {
  mergeNationalNewsHydration,
  nationalNewsStoryCount,
  resolveNationalNewsPackageForEdition,
} from "../lib/edition/nationalNewsHydration.ts";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const METRO_KEY = "phoenix-az";
const EDITION_DATE = process.env.EDITION_DATE ?? "2026-07-19";

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function localTopStoryCount(editorialContext) {
  const items =
    editorialContext?.sections?.find((s) => s.sectionType === "top_stories")
      ?.items ?? [];
  return items.filter((s) => /local/i.test(s.role ?? "")).length;
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: edition } = await admin
  .from("editions")
  .select("id, edition_date, national_news, editorial_context, lead_story")
  .eq("user_id", USER_ID)
  .eq("edition_date", EDITION_DATE)
  .eq("metro_key", METRO_KEY)
  .maybeSingle();

if (!edition?.id) {
  console.error("Edition not found");
  process.exit(1);
}

const nationalNews = resolveNationalNewsPackageForEdition(edition);

console.log("=== SUPABASE ROW ===");
console.log({
  editionId: edition.id,
  editionDate: edition.edition_date,
  nationalNewsPackageId: nationalNews?.packageId ?? null,
  nationalStoryCount: nationalNews?.stories?.length ?? 0,
  localTopStories: localTopStoryCount(edition.editorial_context),
});

console.log("\n=== COLD LAUNCH (legacy cache missing nationalNews) ===");
let hydrationRef = null;
const cachePaint = mergeNationalNewsHydration(hydrationRef, null);
hydrationRef = cachePaint.value;
const networkMerge = mergeNationalNewsHydration(hydrationRef, nationalNews);
hydrationRef = networkMerge.value ?? hydrationRef;
console.log({
  afterCachePaint: nationalNewsStoryCount(cachePaint.value),
  afterNetworkSync: nationalNewsStoryCount(networkMerge.value),
  packageId: hydrationRef?.packageId ?? null,
  preventedNullOverwrite: networkMerge.preventedNullOverwrite,
});

console.log("\n=== WARM LAUNCH (cached nationalNews present) ===");
console.log({
  cacheStoryCount: nationalNewsStoryCount(nationalNews),
  packageId: nationalNews?.packageId ?? null,
});

console.log("\n=== PULL-TO-REFRESH (null must not overwrite valid) ===");
const refreshMerge = mergeNationalNewsHydration(hydrationRef, null);
console.log({
  storyCountAfterNullIncoming: nationalNewsStoryCount(refreshMerge.value),
  preventedNullOverwrite: refreshMerge.preventedNullOverwrite,
});

console.log("\n=== EDITIONREADER PROPS (simulated) ===");
console.log({
  nationalNewsStoryCount: nationalNewsStoryCount(hydrationRef),
  localLeadPresent: Boolean(edition.lead_story),
  localTopStoryCount: localTopStoryCount(edition.editorial_context),
});
