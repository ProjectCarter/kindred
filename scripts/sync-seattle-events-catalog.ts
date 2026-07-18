/**
 * One-off ops helper — full Events catalog sync for Seattle gold standard pass.
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... npx --yes deno run --allow-net --allow-env scripts/sync-seattle-events-catalog.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { syncEventsCatalogForMetro } from "../supabase/functions/_shared/localEvents/eventsCatalogSync.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY required");
  Deno.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: metro, error } = await admin
  .from("events_catalog_metros")
  .select("*")
  .eq("metro_key", "seattle-wa")
  .maybeSingle();

if (error || !metro) {
  console.error("Seattle metro not registered:", error?.message ?? "missing row");
  Deno.exit(1);
}

console.log("[sync] starting full sync for seattle-wa");
const stats = await syncEventsCatalogForMetro(admin, metro, "full");
console.log(JSON.stringify(stats, null, 2));

const { data: providers } = await admin
  .from("events_catalog")
  .select("provider")
  .eq("metro_key", "seattle-wa")
  .in("lifecycle", ["verified", "upcoming", "today"]);

const counts: Record<string, number> = {};
for (const row of providers ?? []) {
  counts[row.provider] = (counts[row.provider] ?? 0) + 1;
}
console.log("[sync] active by provider:", counts);
