import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { rowToRecord } from "../supabase/functions/_shared/heroArtwork/library.ts";
import { isCompleteLibraryRecord } from "../supabase/functions/_shared/heroArtwork/presentation.ts";
import { validateAboutArtworkBody } from "../supabase/functions/_shared/heroArtwork/editorial.ts";

const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const admin = createClient(
  "https://zdqjeocdsbdzecawumdp.supabase.co",
  SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: rows } = await admin
  .from("kindred_hero_artwork")
  .select("id, artwork_title, about_artwork_body")
  .eq("approval_status", "approved");

for (const row of rows ?? []) {
  const record = rowToRecord(row);
  if (isCompleteLibraryRecord(record)) continue;
  const about = validateAboutArtworkBody(record.aboutArtworkBody);
  console.log(
    JSON.stringify({
      id: row.id,
      title: row.artwork_title,
      aboutReason: about.reason,
      about: record.aboutArtworkBody?.slice(0, 120),
    })
  );
}
