#!/usr/bin/env node
/**
 * Fail CI when known lib/server mirror pairs drift.
 * Re-export shims (files containing "Re-export — single source of truth") are skipped.
 * Run: node scripts/check-mirror-sync.mjs
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const EXACT_MIRROR_PAIRS = [
  [
    "lib/edition/uniqueConclusions.ts",
    "supabase/functions/_shared/editorial/uniqueConclusions.ts",
  ],
  [
    "lib/edition/memorableWriting.ts",
    "supabase/functions/_shared/editorial/memorableWriting.ts",
  ],
];

function isReExportShim(relPath) {
  const raw = readFileSync(join(root, relPath), "utf8");
  return /Re-export — single source of truth/.test(raw);
}

function normalizeMirrorSource(source) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/^\/\*\*[\s\S]*?\*\/\n+/m, "")
    .replace(/^\/\/[^\n]*keep in sync[^\n]*\n/gim, "")
    .replace(/^\/\/[^\n]*server mirror[^\n]*\n/gim, "")
    .replace(/\.ts("|')/g, ".ts$1")
    .trim();
}

function hashNormalized(relPath) {
  const raw = readFileSync(join(root, relPath), "utf8");
  return createHash("sha256").update(normalizeMirrorSource(raw)).digest("hex");
}

const failures = [];
let skipped = 0;

for (const [clientPath, serverPath] of EXACT_MIRROR_PAIRS) {
  if (isReExportShim(serverPath)) {
    skipped += 1;
    continue;
  }
  const clientHash = hashNormalized(clientPath);
  const serverHash = hashNormalized(serverPath);
  if (clientHash !== serverHash) {
    failures.push({ clientPath, serverPath, clientHash, serverHash });
  }
}

if (failures.length) {
  console.error("Mirror sync check failed:\n");
  for (const f of failures) {
    console.error(`  ${f.clientPath}`);
    console.error(`    ↔ ${f.serverPath}`);
    console.error(`    client=${f.clientHash.slice(0, 12)}… server=${f.serverHash.slice(0, 12)}…`);
  }
  process.exit(1);
}

console.log(
  `Mirror sync OK (${EXACT_MIRROR_PAIRS.length - skipped} pairs checked, ${skipped} re-export shims skipped)`
);
