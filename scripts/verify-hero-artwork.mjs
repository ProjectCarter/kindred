/**
 * Verify Hero Artwork Library + edition morningHero payload.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = process.env.USER_ID ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = process.env.EDITION_DATE ?? "2026-07-15";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [{ count: libraryCount }, { data: sample }, { data: selection }, { data: editions }] =
  await Promise.all([
    admin
      .from("kindred_hero_artwork")
      .select("*", { count: "exact", head: true })
      .not("hosted_url", "is", null),
    admin
      .from("kindred_hero_artwork")
      .select("artwork_title,artist,hosted_url,collections")
      .not("hosted_url", "is", null)
      .limit(3),
    admin
      .from("kindred_hero_artwork_edition_selections")
      .select("*")
      .eq("edition_date", EDITION_DATE)
      .maybeSingle(),
    admin
      .from("editions")
      .select("id,morning_edition")
      .eq("user_id", USER_ID)
      .eq("edition_date", EDITION_DATE)
      .limit(1),
  ]);

const me = editions?.[0]?.morning_edition;
const morningHero = me?.morningHero ?? null;

console.log(
  JSON.stringify(
    {
      libraryHostedCount: libraryCount,
      librarySample: sample,
      editionSelection: selection
        ? {
            editionDate: selection.edition_date,
            artworkId: selection.artwork_id,
            hasSnapshot: Boolean(selection.presentation_snapshot?.artworkId),
          }
        : null,
      editionMorningHero: morningHero
        ? {
            artworkId: morningHero.artworkId,
            title: morningHero.artworkTitle,
            artist: morningHero.artist,
            hostedUrl: morningHero.hostedUrl,
            imageUrl: morningHero.imageUrl,
            aboutWordCount: morningHero.aboutWordCount,
          }
        : null,
      usedEngines: me?.selectionMeta?.usedEngines,
      heroNotes: (me?.selectionMeta?.editorNotes ?? []).filter((n) =>
        /hero/i.test(n)
      ),
      ok: Boolean(libraryCount > 0 && morningHero?.hostedUrl),
    },
    null,
    2
  )
);

process.exit(libraryCount > 0 && morningHero?.hostedUrl ? 0 : 1);
