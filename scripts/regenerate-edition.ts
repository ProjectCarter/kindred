/**
 * Regenerate one user's edition through buildEditionForUser (server pipeline).
 *
 * Requires Edge Function secrets locally — NOT for Expo / client bundles.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx deno run \
 *     --allow-env --allow-net --allow-read scripts/regenerate-edition.ts
 *
 *   USER_ID=... EDITION_DATE=2026-07-17 npx deno run ...
 */
import {
  buildEditionForUser,
  createServiceClient,
  resolveEditionLocation,
} from "../supabase/functions/_shared/buildEdition.ts";

async function loadLocalEnv(): Promise<void> {
  try {
    const raw = await Deno.readTextFile(".env.local");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!Deno.env.get(key)) Deno.env.set(key, value);
    }
  } catch {
    /* optional */
  }
}

const userId =
  Deno.env.get("USER_ID") ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const editionDate =
  Deno.env.get("EDITION_DATE") ?? new Date().toISOString().slice(0, 10);

await loadLocalEnv();

if (!Deno.env.get("SUPABASE_URL")?.trim()) {
  Deno.env.set(
    "SUPABASE_URL",
    Deno.env.get("EXPO_PUBLIC_SUPABASE_URL") ??
      "https://zdqjeocdsbdzecawumdp.supabase.co"
  );
}

if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()) {
  console.error(
    "Set SUPABASE_SERVICE_ROLE_KEY — Supabase Dashboard → Project Settings → API → service_role,\n" +
      "or: npx supabase projects api-keys --project-ref zdqjeocdsbdzecawumdp"
  );
  Deno.exit(1);
}

const admin = createServiceClient();

const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("location, home_location, interests")
  .eq("id", userId)
  .maybeSingle();

if (profileError || !profile) {
  console.error("Profile fetch failed:", profileError?.message ?? "missing");
  Deno.exit(1);
}

const locationHint =
  profile.location && typeof profile.location === "object"
    ? {
        lat: (profile.location as { lat?: number }).lat,
        lon: (profile.location as { lon?: number }).lon,
        city: (profile.location as { city?: string }).city,
        region: (profile.location as { region?: string | null }).region ?? null,
        state: (profile.location as { state?: string | null }).state ?? null,
      }
    : null;

const location = await resolveEditionLocation(admin, userId, locationHint);
if (!location) {
  console.error("No resolvable location for user", userId);
  Deno.exit(1);
}

console.log("[regenerate-edition] building", {
  userId,
  editionDate,
  city: location.city,
});

const result = await buildEditionForUser(admin, userId, location, {
  editionDate,
  temperatureUnitPreference: "auto",
});

if (!result.ok) {
  console.error("Build failed:", result.error);
  Deno.exit(1);
}

const { data: edition } = await admin
  .from("editions")
  .select("id, status, morning_edition")
  .eq("id", result.editionId)
  .maybeSingle();

const hero = (
  edition?.morning_edition as {
    morningHero?: {
      artworkId?: string;
      artworkTitle?: string;
      artist?: string;
      hostedUrl?: string;
    } | null;
  } | null
)?.morningHero;

const { data: frozen } = await admin
  .from("kindred_hero_artwork_edition_selections")
  .select("artwork_id, presentation_snapshot")
  .eq("edition_date", editionDate)
  .maybeSingle();

console.log(
  JSON.stringify(
    {
      ok: true,
      editionId: result.editionId,
      status: edition?.status ?? null,
      morningHero: hero
        ? {
            artworkId: hero.artworkId,
            title: hero.artworkTitle,
            artist: hero.artist,
            hostedUrl: hero.hostedUrl,
          }
        : null,
      frozenSelection: frozen
        ? {
            artworkId: frozen.artwork_id,
            title: (
              frozen.presentation_snapshot as { artworkTitle?: string } | null
            )?.artworkTitle,
          }
        : null,
    },
    null,
    2
  )
);

if (!hero?.hostedUrl || !frozen?.artwork_id) {
  Deno.exit(1);
}
