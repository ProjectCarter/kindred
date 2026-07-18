#!/usr/bin/env node
/**
 * Validate one U.S. market — read-only, no catalog sync, no API spend.
 * Usage: node scripts/validate-us-market.mjs seattle-wa-metro
 */

import { createClient } from "@supabase/supabase-js";

const slug = process.argv[2]?.trim();
if (!slug) {
  console.error("Usage: node scripts/validate-us-market.mjs <market-slug>");
  process.exit(1);
}

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const res = await fetch(`${SUPABASE_URL}/functions/v1/build-market`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SERVICE_KEY}`,
  },
  body: JSON.stringify({ slug, action: "validate" }),
});

const body = await res.json().catch(() => ({}));
console.log(JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
