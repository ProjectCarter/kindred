#!/usr/bin/env node
/**
 * Mark family-unsafe rows in events_catalog as rejected — shared nationwide cleanup.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-family-unsafe-catalog-events.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-family-unsafe-catalog-events.mjs --metro seattle-wa
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-family-unsafe-catalog-events.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { serviceRoleKey, supabaseUrl } from "./lib/catalogAuth.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const metroArg = process.argv.find((a) => a.startsWith("--metro="))?.split("=")[1]?.trim();

const UNSAFE =
  /\b(strip club|stripclub|gentlemen'?s club|adult entertainment|adult bookstore|escort|swinger|bdsm|fetish|mlm|multi[- ]level marketing|timeshare|pyramid scheme|get rich quick|speed dating|christian singles|singles mixer|networking seminar|leadership skills|management skills|1-day workshop|unlock additive|fancy a go\?)\b/i;

const admin = createClient(supabaseUrl(), serviceRoleKey(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

let query = admin
  .from("events_catalog")
  .select("id, metro_key, name, venue, lifecycle, verification_status")
  .in("lifecycle", ["verified", "upcoming", "today", "discovered"]);

if (metroArg) {
  query = query.eq("metro_key", metroArg);
}

const { data: rows, error } = await query.limit(5000);
if (error) throw error;

const flagged = (rows ?? []).filter((row) =>
  UNSAFE.test(`${row.name ?? ""} ${row.venue ?? ""}`)
);

console.log(
  JSON.stringify(
    {
      dryRun,
      metro: metroArg ?? "all",
      scanned: rows?.length ?? 0,
      flagged: flagged.length,
      samples: flagged.slice(0, 8).map((r) => ({
        metro: r.metro_key,
        name: r.name?.slice(0, 72),
      })),
    },
    null,
    2
  )
);

if (dryRun || !flagged.length) {
  process.exit(0);
}

for (const row of flagged) {
  const { error: updateError } = await admin
    .from("events_catalog")
    .update({
      lifecycle: "rejected",
      verification_status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateError) {
    console.error("update failed", row.id, updateError.message);
  }
}

console.log(`Rejected ${flagged.length} family-unsafe catalog rows.`);
