/**
 * Live Seattle generation test after migration 0047.
 * Usage: node scripts/live-test-seattle-edition.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY;

const USER_ID = "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = "2026-07-17";
const GILBERT_EDITION_ID = "fde3424a-b025-49f8-a7c9-c019bd2c458b";
const GILBERT_EDITION_DATE = "2026-07-15";

const SEATTLE = {
  city: "Seattle",
  state: "WA",
  region: "WA",
  lat: 47.6062,
  lon: -122.3321,
};

const AZ_CITIES = /gilbert|chandler|mesa|tempe|scottsdale|phoenix|arizona|\bAZ\b/i;

if (!SERVICE_KEY || !ANON_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or anon key");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function snapshotEdition(label, filter) {
  let q = admin.from("editions").select("id, edition_date, metro_key, status, discovery, lead_story, bandit");
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: sections } = await admin
    .from("edition_sections")
    .select("section_type, headline, body")
    .eq("edition_id", data.id);

  return { label, edition: data, sections: sections ?? [] };
}

function scanArizonaContent(snapshot) {
  const hits = [];
  const discovery = JSON.stringify(snapshot.edition.discovery ?? {});
  if (AZ_CITIES.test(discovery)) hits.push("discovery");

  for (const s of snapshot.sections) {
    const blob = `${s.headline} ${s.body}`;
    if (AZ_CITIES.test(blob)) {
      hits.push(`${s.section_type}:${s.headline?.slice(0, 40)}`);
    }
  }
  return hits;
}

async function main() {
  const beforeGilbert = await snapshotEdition("gilbert-before", {
    id: GILBERT_EDITION_ID,
  });
  const beforeSeattle = await snapshotEdition("seattle-before", {
    user_id: USER_ID,
    edition_date: EDITION_DATE,
    metro_key: "seattle-wa",
  });

  console.log("BEFORE Gilbert:", {
    id: beforeGilbert?.edition.id,
    metro_key: beforeGilbert?.edition.metro_key,
    status: beforeGilbert?.edition.status,
    sectionCount: beforeGilbert?.sections.length,
  });
  console.log("BEFORE Seattle:", {
    id: beforeSeattle?.edition.id,
    metro_key: beforeSeattle?.edition.metro_key,
    status: beforeSeattle?.edition.status,
    sectionCount: beforeSeattle?.sections.length,
  });

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(
    USER_ID
  );
  if (userErr || !userData?.user?.email) throw userErr ?? new Error("no user");

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) throw linkErr;

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !sessionData?.session?.access_token) throw verifyErr;

  console.log("Invoking generate-edition for Seattle (may take 60-180s)...");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-edition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      editionDate: EDITION_DATE,
      temperatureUnit: "fahrenheit",
      devPreview: true,
      location: SEATTLE,
    }),
  });

  const body = await res.json().catch(() => ({}));
  console.log("generate-edition status:", res.status);
  console.log("generate-edition body:", JSON.stringify(body, null, 2));

  if (!res.ok) {
    process.exit(1);
  }

  const afterSeattle = await snapshotEdition("seattle-after", {
    user_id: USER_ID,
    edition_date: EDITION_DATE,
    metro_key: "seattle-wa",
  });
  const afterGilbert = await snapshotEdition("gilbert-after", {
    id: GILBERT_EDITION_ID,
  });

  const gilbertPhoenixRows = await admin
    .from("editions")
    .select("id, edition_date, metro_key, status")
    .eq("user_id", USER_ID)
    .eq("metro_key", "phoenix-az")
    .eq("status", "ready");

  const azHits = scanArizonaContent(afterSeattle);

  console.log("\n=== LIVE TEST RESULT ===");
  console.log({
    editionId: body.editionId,
    metroKey: body.metroKey,
    distinctSeattleRecord: afterSeattle?.edition.id === body.editionId,
    seattleMetroKey: afterSeattle?.edition.metro_key,
    seattleStatus: afterSeattle?.edition.status,
    seattleSectionCount: afterSeattle?.sections.length,
    gilbertUntouched:
      beforeGilbert?.edition.id === afterGilbert?.edition.id &&
      beforeGilbert?.edition.metro_key === afterGilbert?.edition.metro_key &&
      beforeGilbert?.sections.length === afterGilbert?.sections.length,
    gilbertId: afterGilbert?.edition.id,
    gilbertMetroKey: afterGilbert?.edition.metro_key,
    readyPhoenixAzCount: gilbertPhoenixRows.data?.length ?? 0,
    arizonaContentHits: azHits,
    seattleIdChanged: beforeSeattle?.edition.id !== afterSeattle?.edition.id,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
