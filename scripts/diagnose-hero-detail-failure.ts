import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { rowToRecord } from "../supabase/functions/_shared/heroArtwork/library.ts";
import { detailFromApprovedRecord } from "../supabase/functions/_shared/heroArtwork/presentation.ts";
import {
  isMasterpieceDetailComplete,
  validateLongStoryBody,
} from "../supabase/functions/_shared/heroArtwork/detailEditorial.ts";
import { isFrozenDetailComplete } from "../supabase/functions/_shared/heroArtwork/detailTemplate.ts";
import { masterpieceDetailIsCorrupt } from "../supabase/functions/_shared/heroArtwork/articleValidation.ts";
import { isHeroArtworkLicenseSafe } from "../supabase/functions/_shared/heroArtwork/licensing.ts";
import { validateAboutArtworkBody } from "../supabase/functions/_shared/heroArtwork/editorial.ts";

const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const id = Deno.args[0] ?? "c08e165f-463b-4716-9076-50fb43932534";
const admin = createClient(
  "https://zdqjeocdsbdzecawumdp.supabase.co",
  SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: row, error } = await admin
  .from("kindred_hero_artwork")
  .select("*")
  .eq("id", id)
  .single();

if (error || !row) {
  console.error(error?.message ?? "not found");
  Deno.exit(1);
}

const record = rowToRecord(row);
const fields = {
  longStoryBody: record.longStoryBody,
  artistBiography: record.artistBiography,
  lookCloserItems: record.lookCloserItems,
  didYouKnow: record.didYouKnow,
  museumName: record.museumName,
  museumLocation: record.museumLocation,
  officialMuseumUrl: record.officialMuseumUrl,
  officialArtworkUrl: record.officialArtworkUrl,
  sourceReferences: record.sourceReferences,
  detailEditorialStatus: record.detailEditorialStatus,
};

const story = validateLongStoryBody(record.longStoryBody);
const detailComplete = isMasterpieceDetailComplete(fields);
const detail = detailFromApprovedRecord(record);

console.log(
  JSON.stringify(
    {
      title: row.artwork_title,
      storyValid: story.valid,
      storyReason: story.reason,
      aboutReason: validateAboutArtworkBody(record.aboutArtworkBody).reason,
      detailComplete,
      editorialSectionsKeys: record.editorialSections
        ? Object.keys(record.editorialSections)
        : null,
      rawEditorialKeys:
        row.editorial_sections && typeof row.editorial_sections === "object"
          ? Object.keys(row.editorial_sections as Record<string, unknown>)
          : null,
      verifiedAt: record.verifiedAt,
      licenseSafe: isHeroArtworkLicenseSafe(record),
      detailIsNull: detail === null,
      frozenComplete: detail ? isFrozenDetailComplete(detail) : false,
      corrupt: detail ? masterpieceDetailIsCorrupt(detail) : null,
    },
    null,
    2
  )
);
