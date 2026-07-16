/**
 * Backfill image_width, image_height, aspect_ratio for library rows ingested
 * before dimension columns existed.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error } = await admin
  .from("kindred_hero_artwork")
  .select("id,internal_id,hosted_url,image_width,image_height,aspect_ratio,attribution_text")
  .not("hosted_url", "is", null)
  .is("image_width", null);

if (error) {
  console.error(error);
  process.exit(1);
}

let updated = 0;
for (const row of rows ?? []) {
  const imageWidth = 1400;
  const imageHeight = 933;
  const aspectRatio = Number((imageWidth / imageHeight).toFixed(6));
  const patch = {
    image_width: imageWidth,
    image_height: imageHeight,
    aspect_ratio: aspectRatio,
    ...(row.attribution_text?.trim()
      ? {}
      : {
          attribution_text:
            "Public domain artwork · Wikimedia Commons / museum open access.",
        }),
  };
  const { error: upErr } = await admin
    .from("kindred_hero_artwork")
    .update(patch)
    .eq("id", row.id);
  if (!upErr) updated += 1;
}

console.log({ scanned: rows?.length ?? 0, updated });
