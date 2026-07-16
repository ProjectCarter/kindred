/**
 * One-off: regenerate a user's edition via deployed generate-edition.
 * Usage: node scripts/regenerate-edition.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = "2026-07-15";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: userData, error: userErr } = await admin.auth.admin.getUserById(
  USER_ID
);
if (userErr || !userData?.user?.email) {
  console.error("getUserById failed", userErr);
  process.exit(1);
}

// Force rebuild: mark corrupt ready row failed so completeness gate re-runs.
await admin
  .from("editions")
  .update({ status: "failed" })
  .eq("user_id", USER_ID)
  .eq("edition_date", EDITION_DATE);

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: userData.user.email,
});
if (linkErr || !linkData?.properties?.hashed_token) {
  console.error("generateLink failed", linkErr);
  process.exit(1);
}

const anon = createClient(SUPABASE_URL, ANON_KEY);
const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
  type: "magiclink",
  token_hash: linkData.properties.hashed_token,
});
if (verifyErr || !sessionData?.session?.access_token) {
  console.error("verifyOtp failed", verifyErr);
  process.exit(1);
}

console.log("Invoking generate-edition (this may take 60-120s)...");
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
console.log("status:", res.status);
console.log("response:", text);
process.exit(res.ok ? 0 : 1);
