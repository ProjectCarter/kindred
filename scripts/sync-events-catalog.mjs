#!/usr/bin/env node
/**
 * Sync events catalog for one metro (full import).
 *
 * Usage:
 *   CRON_SECRET=... node scripts/sync-events-catalog.mjs phoenix-az
 */

import { catalogAuthHeaders, supabaseUrl } from "./lib/catalogAuth.mjs";

const metroKey = process.argv[2]?.trim();
if (!metroKey) {
  console.error("Usage: node scripts/sync-events-catalog.mjs <metro-key>");
  process.exit(1);
}

const res = await fetch(`${supabaseUrl()}/functions/v1/sync-events-catalog`, {
  method: "POST",
  headers: catalogAuthHeaders(),
  body: JSON.stringify({ mode: "full", metroKey }),
});

const body = await res.json().catch(() => ({}));
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
