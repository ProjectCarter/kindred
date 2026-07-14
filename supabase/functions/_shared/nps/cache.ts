import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { NpsParkRecord } from "./types.ts";
import { NPS_CACHE_TTL_HOURS } from "./types.ts";

const CACHE_PROVIDER = "nps_parks";

async function hashQuery(provider: string, query: string): Promise<string> {
  const data = new TextEncoder().encode(`${provider}:${query}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cacheKey(input: { state?: string | null; lat: number; lon: number }): string {
  const state = input.state?.trim().toUpperCase() ?? "";
  return `${state || "geo"}:${input.lat.toFixed(1)},${input.lon.toFixed(1)}`;
}

export async function getCachedNpsParks(
  admin: SupabaseClient | null,
  input: { state?: string | null; lat: number; lon: number }
): Promise<NpsParkRecord[] | null> {
  if (!admin) return null;
  const query = cacheKey(input);
  const queryHash = await hashQuery(CACHE_PROVIDER, query);
  const { data } = await admin
    .from("kindred_image_search_cache")
    .select("results_json, expires_at")
    .eq("provider", CACHE_PROVIDER)
    .eq("query_hash", queryHash)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return Array.isArray(data.results_json)
    ? (data.results_json as NpsParkRecord[])
    : null;
}

export async function setCachedNpsParks(
  admin: SupabaseClient | null,
  input: { state?: string | null; lat: number; lon: number },
  parks: NpsParkRecord[]
): Promise<void> {
  if (!admin) return;
  const query = cacheKey(input);
  const queryHash = await hashQuery(CACHE_PROVIDER, query);
  const expiresAt = new Date(
    Date.now() + NPS_CACHE_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  await admin.from("kindred_image_search_cache").upsert(
    {
      provider: CACHE_PROVIDER,
      query_hash: queryHash,
      query_text: query,
      results_json: parks,
      expires_at: expiresAt,
    },
    { onConflict: "provider,query_hash" }
  );
}
