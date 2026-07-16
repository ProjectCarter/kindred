/**
 * Finish a near-complete edition: add Today in History, mark ready if complete.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = "2026-07-15";
const EDITION_ID = "fde3424a-b025-49f8-a7c9-c019bd2c458b";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// refresh-today-in-history requires status=ready
await admin
  .from("editions")
  .update({ status: "ready" })
  .eq("id", EDITION_ID);

const { data: userData } = await admin.auth.admin.getUserById(USER_ID);
const { data: linkData } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: userData.user.email,
});
const anon = createClient(SUPABASE_URL, ANON_KEY);
const { data: sessionData } = await anon.auth.verifyOtp({
  type: "magiclink",
  token_hash: linkData.properties.hashed_token,
});

console.log("Invoking refresh-today-in-history...");
const res = await fetch(`${SUPABASE_URL}/functions/v1/refresh-today-in-history`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionData.session.access_token}`,
    apikey: ANON_KEY,
  },
  body: JSON.stringify({
    editionDate: EDITION_DATE,
    location: {
      city: "Gilbert",
      state: "AZ",
      region: "AZ",
      lat: 33.27484080940824,
      lon: -111.77688787717592,
    },
  }),
});

const text = await res.text();
console.log("refresh status:", res.status);
console.log("refresh response:", text);

if (!res.ok) {
  await admin.from("editions").update({ status: "failed" }).eq("id", EDITION_ID);
  process.exit(1);
}

// Re-verify completeness; only leave ready if newspaper is complete
const { data: edition } = await admin
  .from("editions")
  .select("id,status,discovery,bandit,lead_story")
  .eq("id", EDITION_ID)
  .single();
const { data: sections } = await admin
  .from("edition_sections")
  .select("section_type")
  .eq("edition_id", EDITION_ID);

const types = (sections ?? []).map((s) => s.section_type);
let discoveryItems = 0;
for (const surface of Object.values(edition.discovery?.surfaces ?? {})) {
  discoveryItems += surface?.items?.length ?? 0;
}

const complete =
  types.includes("weather") &&
  types.includes("local_events") &&
  types.includes("today_in_history") &&
  discoveryItems > 0 &&
  Boolean(edition.bandit?.pick) &&
  Boolean(edition.lead_story);

await admin
  .from("editions")
  .update({ status: complete ? "ready" : "failed" })
  .eq("id", EDITION_ID);

console.log(
  JSON.stringify(
    {
      complete,
      status: complete ? "ready" : "failed",
      sectionTypes: types,
      discoverySurfaceItems: discoveryItems,
      bandits_pick: Boolean(edition.bandit?.pick),
      local_news: Boolean(edition.lead_story),
    },
    null,
    2
  )
);
process.exit(complete ? 0 : 1);
