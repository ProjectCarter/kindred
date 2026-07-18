/**
 * Client helpers for US market management (Developer Tools).
 */

import { supabase, isSupabaseConfigured } from "../supabase";
import type { UsMarketRecord, MarketBuildLogRecord } from "./types";
import { MARKET_BATCH_ACTIONS_ENABLED, SUPPORTED_REGION_MESSAGE } from "./constants";

export type MarketListFilters = {
  marketType?: string | null;
  status?: string | null;
  query?: string | null;
};

async function invokeMarketAction(body: Record<string, unknown>): Promise<{
  success: boolean;
  error?: string;
  body?: unknown;
}> {
  if (!isSupabaseConfigured) {
    return { success: false, error: "Supabase not configured" };
  }

  const { data, error } = await supabase.functions.invoke("build-market", { body });

  if (error) {
    return { success: false, error: error.message, body: data };
  }

  if (data && typeof data === "object" && "error" in data && data.error) {
    return { success: false, error: String(data.error), body: data };
  }

  return { success: true, body: data };
}

export async function listUsMarkets(
  filters: MarketListFilters = {}
): Promise<UsMarketRecord[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from("kindred_us_markets")
    .select("*")
    .eq("country_code", "US")
    .order("overall_rank", { ascending: true });

  if (filters.marketType) {
    query = query.eq("market_type", filters.marketType);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.limit(200);
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as UsMarketRecord[];
  const q = filters.query?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) => {
      const hay = `${row.market_name} ${row.primary_city} ${row.state_code} ${row.state_name} ${row.slug}`.toLowerCase();
      return hay.includes(q);
    });
  }
  return rows;
}

export function invokeBuildUsMarket(slug: string) {
  return invokeMarketAction({ slug, action: "build" });
}

export function invokeRefreshUsMarket(slug: string) {
  return invokeMarketAction({ slug, action: "refresh" });
}

export function invokeRetryUsMarket(slug: string) {
  return invokeMarketAction({ slug, action: "retry", retryCount: 1 });
}

export function invokeValidateUsMarket(slug: string) {
  return invokeMarketAction({ slug, action: "validate" });
}

export async function setUsMarketPaused(
  slug: string,
  paused: boolean
): Promise<void> {
  const result = await invokeMarketAction({
    slug,
    action: paused ? "pause" : "enable",
  });
  if (!result.success) {
    throw new Error(result.error ?? "Could not update market status");
  }
}

export async function fetchMarketBuildLogs(
  marketId: string,
  limit = 8
): Promise<MarketBuildLogRecord[]> {
  const { data, error } = await supabase
    .from("kindred_market_build_logs")
    .select("*")
    .eq("market_id", marketId)
    .eq("country_code", "US")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MarketBuildLogRecord[];
}

export function batchMarketActionBlockedReason(action: string): string {
  if (MARKET_BATCH_ACTIONS_ENABLED) return "";
  return `${action} is disabled until explicitly approved. Build one United States market at a time.`;
}

export { SUPPORTED_REGION_MESSAGE };
