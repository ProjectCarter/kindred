import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { BanditReaderProfile } from "./types.ts";

/**
 * Load optional Bandit identity fields from the profile.
 * Missing columns / nulls are fine — Bandit stays calm without them.
 */
export async function loadBanditReaderProfile(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<BanditReaderProfile> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("first_name, birthday_mmdd, home_location, travel")
    .eq("id", userId)
    .single();

  if (error) {
    console.log("[bandit] reader profile", { error: error.message });
    return {};
  }

  const row = data as {
    first_name?: string | null;
    birthday_mmdd?: string | null;
    home_location?: {
      city?: string | null;
      region?: string | null;
      state?: string | null;
    } | null;
    travel?: BanditReaderProfile["travel"];
  } | null;

  return {
    firstName: row?.first_name ?? null,
    birthdayMMDD: row?.birthday_mmdd ?? null,
    homeCity: row?.home_location?.city ?? null,
    homeRegion: row?.home_location?.region ?? null,
    homeState: row?.home_location?.state ?? null,
    travel: row?.travel ?? null,
  };
}
