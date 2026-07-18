#!/usr/bin/env node
/**
 * Nationwide U.S. catalog build — one metro at a time, resumable.
 * Uses the same shared pipeline as build-us-market.mjs for every city.
 *
 * Usage:
 *   CRON_SECRET=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/build-us-nationwide.mjs
 *   CRON_SECRET=... node scripts/build-us-nationwide.mjs --from 10 --limit 5
 *   CRON_SECRET=... node scripts/build-us-nationwide.mjs --only phoenix-az-metro,seattle-wa-metro
 *   CRON_SECRET=... node scripts/build-us-nationwide.mjs --skip-complete
 *
 * After each metro catalog build, run editorial enrichment separately
 * (requires Anthropic billing):
 *   npm run content:enrich-events -- --metro-key <metro-key> --all
 */

import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { serviceRoleKey, supabaseUrl, catalogAuthHeaders } from "./lib/catalogAuth.mjs";

const args = process.argv.slice(2);
const fromIndex = Number(args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? 0);
const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Number(limitArg) : null;
const skipComplete = args.includes("--skip-complete");
const onlySlugs = args
  .find((a) => a.startsWith("--only="))
  ?.split("=")[1]
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const STATE_PATH = join(process.cwd(), "reports", "nationwide-build-state.json");

const admin = createClient(supabaseUrl(), serviceRoleKey(), {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8"));
  } catch {
    return { startedAt: new Date().toISOString(), completed: [], failed: [], lastSlug: null };
  }
}

async function saveState(state) {
  await mkdir(join(process.cwd(), "reports"), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2));
}

function runMarketBuild(slug) {
  console.log(`\n=== Building ${slug} ===`);
  const result = spawnSync("node", ["scripts/build-us-market.mjs", slug], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });
  return result.status === 0;
}

async function main() {
  try {
    catalogAuthHeaders();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  let query = admin
    .from("kindred_us_markets")
    .select("slug, metro_key, display_name, status, rollout_priority")
    .eq("country_code", "US")
    .order("rollout_priority", { ascending: true });

  const { data: markets, error } = await query;
  if (error) throw error;

  let queue = markets ?? [];
  if (onlySlugs?.length) {
    queue = queue.filter((m) => onlySlugs.includes(m.slug));
  }
  if (skipComplete) {
    queue = queue.filter((m) => m.status !== "complete");
  }
  if (fromIndex > 0) {
    queue = queue.slice(fromIndex);
  }
  if (limit != null && limit > 0) {
    queue = queue.slice(0, limit);
  }

  const state = await loadState();
  console.log(`Nationwide build: ${queue.length} metros queued (${markets?.length ?? 0} total U.S.)`);

  for (const market of queue) {
    state.lastSlug = market.slug;
    await saveState(state);

    const ok = runMarketBuild(market.slug);
    if (ok) {
      state.completed.push({
        slug: market.slug,
        metroKey: market.metro_key,
        at: new Date().toISOString(),
      });
    } else {
      state.failed.push({
        slug: market.slug,
        metroKey: market.metro_key,
        at: new Date().toISOString(),
      });
      console.warn(`Build failed for ${market.slug} — continuing to next metro.`);
    }
    await saveState(state);
  }

  state.finishedAt = new Date().toISOString();
  await saveState(state);

  console.log("\nNationwide batch complete.", {
    completed: state.completed.length,
    failed: state.failed.length,
    stateFile: STATE_PATH,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
