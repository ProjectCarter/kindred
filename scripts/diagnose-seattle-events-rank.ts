/**
 * Diagnose Seattle catalog ranking pool size.
 * Run: npx tsx scripts/diagnose-seattle-events-rank.ts
 */

import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  "https://zdqjeocdsbdzecawumdp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk"
);

const location = {
  city: "Seattle",
  state: "WA",
  region: "Washington",
  lat: 47.6062,
  lon: -122.3321,
};

async function main() {
  const metroKey = "seattle-wa";
  const { count } = await admin
    .from("events_catalog")
    .select("*", { count: "exact", head: true })
    .eq("metro_key", metroKey)
    .in("lifecycle", ["verified", "upcoming", "today"]);

  const { data: editions } = await admin
    .from("editions")
    .select("id,status,created_at,metro_key")
    .eq("metro_key", "seattle-wa")
    .eq("edition_date", "2026-07-17")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("catalog rows (lifecycle filter)", count);
  console.log("recent editions", editions);

  const { data: sections } = await admin
    .from("edition_sections")
    .select("section_type")
    .eq("edition_id", editions?.[0]?.id ?? "none");

  const { data: sample } = await admin
    .from("events_catalog")
    .select("name, verification_status, event_payload")
    .eq("metro_key", metroKey)
    .in("lifecycle", ["verified", "upcoming", "today"])
    .limit(5);

  console.log(
    "sample verification",
    sample?.map((row) => ({
      name: row.name?.slice(0, 40),
      dbStatus: row.verification_status,
      payloadStatus: row.event_payload?.dateVerification?.verificationStatus ?? null,
    }))
  );

  console.log("latest edition sections", sections?.map((s) => s.section_type));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
