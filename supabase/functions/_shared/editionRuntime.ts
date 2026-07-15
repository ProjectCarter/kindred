import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type EditionLocation = {
  lat: number;
  lon: number;
  city: string;
  region?: string | null;
  state?: string | null;
};

function placeFromProfileBlob(raw: unknown): EditionLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const loc = raw as {
    city?: string | null;
    region?: string | null;
    state?: string | null;
    lat?: number | null;
    lon?: number | null;
  };
  if (
    loc.lat == null ||
    loc.lon == null ||
    !loc.city ||
    loc.city === "your area"
  ) {
    return null;
  }
  return {
    lat: loc.lat,
    lon: loc.lon,
    city: loc.city,
    region: loc.region ?? null,
    state: loc.state ?? null,
  };
}

export function createServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets"
    );
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Prefer client GPS → profiles.location → travel → home_location.
 * Never silently defaults to a hard-coded city.
 */
export async function resolveEditionLocation(
  supabaseAdmin: SupabaseClient,
  userId: string,
  hint?: EditionLocation | null
): Promise<EditionLocation | null> {
  const hintUsable =
    hint &&
    hint.city &&
    hint.city !== "your area" &&
    Number.isFinite(hint.lat) &&
    Number.isFinite(hint.lon);

  if (hintUsable) {
    return {
      lat: hint!.lat,
      lon: hint!.lon,
      city: hint!.city,
      region: hint!.region ?? null,
      state: hint!.state ?? null,
    };
  }

  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("location, home_location, travel")
      .eq("id", userId)
      .maybeSingle();

    const active = placeFromProfileBlob(data?.location);
    if (active) return active;

    const travel = data?.travel as {
      away?: boolean;
      city?: string | null;
      lat?: number | null;
      lon?: number | null;
      region?: string | null;
      state?: string | null;
    } | null;
    if (travel?.away && travel.city && travel.lat != null && travel.lon != null) {
      return {
        lat: travel.lat,
        lon: travel.lon,
        city: travel.city,
        region: travel.region ?? null,
        state: travel.state ?? null,
      };
    }

    const home = placeFromProfileBlob(data?.home_location);
    if (home) return home;
  } catch {
    /* fall through */
  }

  if (
    hint &&
    Number.isFinite(hint.lat) &&
    Number.isFinite(hint.lon) &&
    hint.city &&
    hint.city !== "your area"
  ) {
    return hint;
  }

  return null;
}
