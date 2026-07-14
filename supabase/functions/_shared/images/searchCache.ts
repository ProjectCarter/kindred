import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SEARCH_CACHE_TTL_HOURS } from "./types.ts";

async function hashQuery(provider: string, query: string): Promise<string> {
  const data = new TextEncoder().encode(`${provider}:${query}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCachedSearch<T>(
  admin: SupabaseClient,
  provider: string,
  query: string
): Promise<T[] | null> {
  const queryHash = await hashQuery(provider, query);
  const { data } = await admin
    .from("kindred_image_search_cache")
    .select("results_json, expires_at")
    .eq("provider", provider)
    .eq("query_hash", queryHash)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return Array.isArray(data.results_json) ? (data.results_json as T[]) : null;
}

export async function setCachedSearch<T>(
  admin: SupabaseClient,
  provider: string,
  query: string,
  results: T[]
): Promise<void> {
  const queryHash = await hashQuery(provider, query);
  const expiresAt = new Date(
    Date.now() + SEARCH_CACHE_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();

  await admin.from("kindred_image_search_cache").upsert(
    {
      provider,
      query_hash: queryHash,
      query_text: query,
      results_json: results,
      expires_at: expiresAt,
    },
    { onConflict: "provider,query_hash" }
  );
}
