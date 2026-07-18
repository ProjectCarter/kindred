#!/usr/bin/env node
/**
 * Validate one U.S. market — read-only, no catalog sync, no API spend.
 * Usage: CRON_SECRET=... node scripts/validate-us-market.mjs seattle-wa-metro
 */

import { catalogAuthHeaders, supabaseUrl } from "./lib/catalogAuth.mjs";

const slug = process.argv[2]?.trim();
if (!slug) {
  console.error("Usage: node scripts/validate-us-market.mjs <market-slug>");
  process.exit(1);
}

const res = await fetch(`${supabaseUrl()}/functions/v1/build-market`, {
  method: "POST",
  headers: catalogAuthHeaders(),
  body: JSON.stringify({ slug, action: "validate" }),
});

const body = await res.json().catch(() => ({}));
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
