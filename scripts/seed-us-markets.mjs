#!/usr/bin/env node
/**
 * Seed ranked United States markets into kindred_us_markets.
 * Does NOT build catalogs or generate editions.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-us-markets.mjs
 */

import { createClient } from "@supabase/supabase-js";
import {
  buildUsMarketDirectorySeeds,
  countUsMarketSeeds,
} from "../lib/markets/usMarketDirectory.ts";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const ranked = buildUsMarketDirectorySeeds();
const counts = countUsMarketSeeds();

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("Seeding US markets", counts);

let inserted = 0;
let updated = 0;
let rejected = 0;

for (const market of ranked) {
  if (market.state_code?.length !== 2) {
    rejected += 1;
    continue;
  }

  const row = {
    slug: market.slug,
    metro_key: market.metro_key,
    display_name: market.display_name,
    market_name: market.market_name,
    primary_city: market.primary_city,
    state_name: market.state_name,
    state_code: market.state_code.toUpperCase(),
    country_code: "US",
    market_type: market.market_type,
    population: market.population,
    population_rank: market.population_rank,
    population_tier: market.population_tier ?? null,
    tourism_rank: market.tourism_rank,
    tourism_priority: market.tourism_priority ?? 0,
    regional_priority: market.regional_priority ?? 0,
    national_significance_score: market.national_significance_score ?? 0,
    future_user_demand_score: market.future_user_demand_score ?? 0,
    overall_rank: market.overall_rank,
    rollout_priority: market.rollout_priority ?? market.overall_rank,
    latitude: market.latitude,
    longitude: market.longitude,
    timezone: market.timezone,
    default_radius_miles: 25,
    fallback_radius_miles: 50,
    metro_cities: market.metro_cities ?? [market.primary_city],
    status: "planned",
    is_supported: false,
    is_daily_refresh_enabled: false,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await admin
    .from("kindred_us_markets")
    .select("id")
    .eq("slug", market.slug)
    .maybeSingle();

  const { error } = await admin
    .from("kindred_us_markets")
    .upsert(row, { onConflict: "slug" });

  if (error) {
    console.error("Failed", market.slug, error.message);
    rejected += 1;
    continue;
  }

  if (existing?.id) updated += 1;
  else inserted += 1;
}

console.log(JSON.stringify({ inserted, updated, rejected, total: ranked.length }, null, 2));
