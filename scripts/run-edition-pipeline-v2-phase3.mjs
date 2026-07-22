#!/usr/bin/env node
/**
 * Edition Pipeline V2 Phase 3 — run validation suite and print final report.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatPhase3Report,
  runPhase3StressBatch,
  runPhase3ValidationSuite,
} from "../lib/edition/pipelineV2Simulation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const report = runPhase3ValidationSuite();
const stress = runPhase3StressBatch(100);

console.log(formatPhase3Report(report));
console.log("");
console.log("## Stress batch (100 iterations)");
console.log(JSON.stringify(stress, null, 2));

const outPath = join(root, "reports", "edition-pipeline-v2-phase3.json");
try {
  writeFileSync(
    outPath,
    JSON.stringify({ report, stress }, null, 2),
    "utf8"
  );
  console.log("");
  console.log(`Wrote ${outPath}`);
} catch {
  // reports/ may not exist in all environments
}

if (report.phase4Recommendation !== "ready") {
  process.exitCode = 1;
}
