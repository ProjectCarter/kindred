#!/usr/bin/env node
/**
 * Mark a ready-but-incomplete edition failed so the normal build pipeline can retry.
 * Usage: node scripts/repair-incomplete-ready-edition.mjs [edition_date] [user_id]
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = process.argv[3] ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE =
  process.argv[2] ??
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Phoenix" });

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: edition, error } = await admin
  .from("editions")
  .select("id,status,edition_date,discovery,bandit")
  .eq("user_id", USER_ID)
  .eq("edition_date", EDITION_DATE)
  .maybeSingle();

if (error || !edition) {
  console.error("edition lookup failed", error?.message ?? "no row");
  process.exit(1);
}

let surfaceItems = 0;
for (const surface of Object.values(edition.discovery?.surfaces ?? {})) {
  surfaceItems += surface?.items?.length ?? 0;
}

console.log("before", {
  editionId: edition.id,
  editionDate: EDITION_DATE,
  status: edition.status,
  surfaceItems,
});

const { error: updateError } = await admin
  .from("editions")
  .update({ status: "failed" })
  .eq("id", edition.id);

if (updateError) {
  console.error("failed to mark edition failed", updateError.message);
  process.exit(1);
}

await admin.from("generation_jobs").upsert(
  {
    user_id: USER_ID,
    edition_date: EDITION_DATE,
    status: "pending",
    last_error: "repair: demoted ready-but-incomplete edition for rebuild",
    updated_at: new Date().toISOString(),
  },
  { onConflict: "user_id,edition_date" }
);

const { data: after } = await admin
  .from("editions")
  .select("id,status")
  .eq("id", edition.id)
  .single();

console.log(
  JSON.stringify(
    {
      repaired: true,
      editionId: edition.id,
      editionDate: EDITION_DATE,
      statusAfter: after?.status ?? null,
      nextStep:
        "Deploy updated Edge Functions, then run scripts/regenerate-edition.mjs with the same date.",
    },
    null,
    2
  )
);
