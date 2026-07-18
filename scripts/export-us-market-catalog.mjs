#!/usr/bin/env node
/**
 * Export ranked U.S. market catalog to JSON — no DB, no API calls.
 * Usage: node scripts/export-us-market-catalog.mjs [--top 100] [--out path]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildUsMarketCatalog, topUsMarkets } from "../lib/markets/marketCatalog.ts";
import { countUsMarketSeeds } from "../lib/markets/usMarketDirectory.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const topIdx = args.indexOf("--top");
const outIdx = args.indexOf("--out");
const top = topIdx >= 0 ? Number(args[topIdx + 1]) : null;
const outPath =
  outIdx >= 0
    ? args[outIdx + 1]
    : path.join(__dirname, "../reports/us-market-catalog.json");

const catalog = top != null && Number.isFinite(top) ? topUsMarkets(top) : buildUsMarketCatalog();
const counts = countUsMarketSeeds();

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      country: "US",
      counts,
      markets: catalog,
    },
    null,
    2
  )
);

console.log(`Wrote ${catalog.length} markets → ${outPath}`);
console.log(JSON.stringify(counts, null, 2));
