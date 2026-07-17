import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  listApprovedHeroArtwork,
  listReadyHeroArtworkLibrary,
} from "../supabase/functions/_shared/heroArtwork/library.ts";
import {
  copyMorningHeroFromRecord,
  detailFromRecord,
  isCompleteLibraryRecord,
} from "../supabase/functions/_shared/heroArtwork/presentation.ts";
import { isFrozenDetailComplete } from "../supabase/functions/_shared/heroArtwork/detailTemplate.ts";
import { resolveProductionMorningHero } from "../supabase/functions/_shared/heroArtwork/production.ts";

const url =
  Deno.env.get("SUPABASE_URL") ??
  Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!key) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const approved = await listApprovedHeroArtwork(admin);
const ready = await listReadyHeroArtworkLibrary(admin);
console.log("approved", approved.length, "ready", ready.length);

const sample = approved[0];
if (sample) {
  console.log("sample", sample.artworkTitle);
  console.log("isCompleteLibraryRecord", isCompleteLibraryRecord(sample));
  const detail = detailFromRecord(sample);
  console.log(
    "detail",
    detail?.sections?.length,
    detail?.lookingCloser?.length,
    Boolean(detail?.didYouKnow)
  );
  console.log("isFrozenDetailComplete", isFrozenDetailComplete(detail));
  console.log("copyMorningHero", Boolean(copyMorningHeroFromRecord(sample, "2026-07-17")));
}

const hero = await resolveProductionMorningHero(admin, {
  editionDate: "2026-07-17",
  context: { date: "2026-07-17", season: "summer" },
});
console.log("resolveProductionMorningHero", hero?.artworkTitle ?? null);
