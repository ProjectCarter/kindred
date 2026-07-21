import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { rowToRecord } from "../supabase/functions/_shared/heroArtwork/library.ts";
import { validateLongStoryBody } from "../supabase/functions/_shared/heroArtwork/detailEditorial.ts";
import { isCompleteLibraryRecord } from "../supabase/functions/_shared/heroArtwork/presentation.ts";
import { sanitizeEditorialText } from "../supabase/functions/_shared/heroArtwork/sanitizeMetadata.ts";

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
  .select("id, artwork_title, long_story_body, about_artwork_body")
  .eq("approval_status", "approved");

let rawPass = 0;
let sanitizedPass = 0;
let complete = 0;
const closest: Array<{
  title: string;
  id: string;
  raw: boolean;
  sanitized: boolean;
  complete: boolean;
}> = [];

for (const row of rows ?? []) {
  const raw = validateLongStoryBody(row.long_story_body);
  const sanitized = validateLongStoryBody(
    sanitizeEditorialText(row.long_story_body)
  );
  const record = rowToRecord(row);
  const recVal = validateLongStoryBody(record.longStoryBody);
  if (raw.valid) rawPass++;
  if (sanitized.valid) sanitizedPass++;
  const isComplete = isCompleteLibraryRecord(record);
  if (isComplete) complete++;
  closest.push({
    title: row.artwork_title?.slice(0, 40) ?? "",
    id: row.id,
    raw: raw.valid,
    sanitized: sanitized.valid,
    complete: isComplete,
  });
}

closest.sort(
  (a, b) =>
    Number(b.complete) - Number(a.complete) ||
    Number(b.sanitized) - Number(a.sanitized) ||
    Number(b.raw) - Number(a.raw)
);

console.log(
  JSON.stringify(
    { total: rows?.length, rawPass, sanitizedPass, complete, top: closest.slice(0, 10) },
    null,
    2
  )
);
