/**
 * Internal Kindred analytics report (service role).
 *
 * Usage:
 *   node scripts/analytics-report.mjs
 *   node scripts/analytics-report.mjs --days=7
 */
import { createClient } from "@supabase/supabase-js";
import { loadDotEnvLocal } from "./loadDotEnvLocal.mjs";

loadDotEnvLocal();

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

const args = process.argv.slice(2);
const daysArg = args.find((a) => a.startsWith("--days="));
const days = Number(daysArg?.split("=")[1] ?? args[args.indexOf("--days") + 1] ?? 7);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const since = new Date();
since.setDate(since.getDate() - Math.max(1, days));
const sinceIso = since.toISOString();

function countBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row) ?? "(unknown)";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function avg(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function fetchEvents(eventNames) {
  const { data, error } = await admin
    .from("analytics_events")
    .select(
      "event_name, anonymous_user_id, event_timestamp, edition_date, section_type, content_id, content_title, destination_domain, load_duration_ms, error_code, metadata"
    )
    .gte("event_timestamp", sinceIso)
    .in("event_name", eventNames)
    .order("event_timestamp", { ascending: false })
    .limit(50000);
  if (error) throw error;
  return data ?? [];
}

console.log(`\nKindred analytics — last ${days} day(s) since ${sinceIso.slice(0, 10)}\n`);

const opens = await fetchEvents(["app_open"]);
const dauIds = new Set(opens.map((row) => row.anonymous_user_id));
console.log(`Daily active anonymous users (unique app_open): ${dauIds.size}`);

const loadStarted = await fetchEvents(["edition_load_started"]);
const loadSucceeded = await fetchEvents(["edition_load_succeeded"]);
const loadFailed = await fetchEvents(["edition_load_failed"]);
const loadAttempts = loadStarted.length;
const successRate =
  loadAttempts > 0 ? (loadSucceeded.length / loadAttempts) * 100 : 0;
console.log(
  `Edition success rate: ${successRate.toFixed(1)}% (${loadSucceeded.length}/${loadAttempts} started)`
);
console.log(`Edition failures: ${loadFailed.length}`);
const durations = loadSucceeded
  .map((row) => row.load_duration_ms)
  .filter((n) => typeof n === "number" && n >= 0);
console.log(`Average edition load time: ${avg(durations).toFixed(0)} ms`);

const sections = await fetchEvents(["section_viewed"]);
console.log("\nMost-opened sections:");
for (const [section, count] of countBy(sections, (r) => r.section_type).slice(0, 10)) {
  console.log(`  ${section}: ${count}`);
}

const articles = await fetchEvents(["article_opened"]);
console.log("\nMost-opened articles:");
for (const [title, count] of countBy(
  articles,
  (r) => r.content_title ?? r.content_id
).slice(0, 10)) {
  console.log(`  ${title}: ${count}`);
}

const external = await fetchEvents(["external_link_opened", "ticket_link_opened"]);
console.log("\nExternal link clicks:");
for (const [domain, count] of countBy(external, (r) => r.destination_domain).slice(0, 15)) {
  console.log(`  ${domain}: ${count}`);
}

const shares = await fetchEvents(["article_shared"]);
console.log(`\nShares: ${shares.length}`);

const errors = await fetchEvents(["generation_error", "edition_load_failed"]);
console.log("\nErrors by type:");
for (const [code, count] of countBy(errors, (r) => r.error_code).slice(0, 15)) {
  console.log(`  ${code}: ${count}`);
}

console.log("");
