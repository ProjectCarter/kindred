import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { BanditReaderProfile } from "./types.ts";

type PreloadedProfileRow = {
  first_name?: string | null;
  birthday_mmdd?: string | null;
  home_location?: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  } | null;
  travel?: BanditReaderProfile["travel"];
} | null;

function toBanditReaderProfile(row: PreloadedProfileRow): BanditReaderProfile {
  return {
    firstName: row?.first_name ?? null,
    birthdayMMDD: row?.birthday_mmdd ?? null,
    homeCity: row?.home_location?.city ?? null,
    homeRegion: row?.home_location?.region ?? null,
    homeState: row?.home_location?.state ?? null,
    travel: row?.travel ?? null,
  };
}

/**
 * Load optional Bandit identity fields from the profile.
 * Missing columns / nulls are fine — Bandit stays calm without them.
 *
 * Pass `preloadedProfile` when the caller already fetched this same
 * `profiles` row (buildEditionForUser does, once, up front) — this skips a
 * redundant DB round trip instead of re-querying the same row.
 */
export async function loadBanditReaderProfile(
  supabaseAdmin: SupabaseClient,
  userId: string,
  preloadedProfile?: PreloadedProfileRow
): Promise<BanditReaderProfile> {
  if (preloadedProfile !== undefined) {
    return toBanditReaderProfile(preloadedProfile);
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("first_name, birthday_mmdd, home_location, travel")
    .eq("id", userId)
    .single();

  if (error) {
    console.log("[bandit] reader profile", { error: error.message });
    return {};
  }

  return toBanditReaderProfile(data as PreloadedProfileRow);
}
