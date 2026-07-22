#!/usr/bin/env node
/**
 * Edition Pipeline V2 Phase 4 — cross-city QA validation runner.
 *
 * Offline (default): runs fixture-based QA for all seven target metros.
 * Live (--live): fetches persisted editions from Supabase when credentials exist.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE4_QA_CITIES } from "../lib/edition/pipelineV2Phase4Cities.ts";
import {
  formatPhase4Report,
  runPhase4ValidationSuite,
} from "../lib/edition/pipelineV2Phase4QA.ts";
import {
  buildAllPhase4FixtureEditions,
  PHASE4_FIXTURE_EDITION_DATE,
} from "../lib/edition/pipelineV2Phase4Fixtures.ts";
import { runPhase3ValidationSuite } from "../lib/edition/pipelineV2Simulation.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const live = args.includes("--live");
const editionDate = process.env.AUDIT_EDITION_DATE ?? PHASE4_FIXTURE_EDITION_DATE;

async function loadLiveEditions() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.env.AUDIT_USER_ID;
  if (!url || !key || !userId) return null;

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const inputs = [];

  for (const spec of PHASE4_QA_CITIES) {
    const { data: edition } = await admin
      .from("editions")
      .select(
        "id, metro_key, edition_date, lead_story, national_news, bandit, discovery, editorial_context, us_national_daily_id, morning_edition"
      )
      .eq("user_id", userId)
      .eq("edition_date", editionDate)
      .eq("metro_key", spec.expectedMetroKey)
      .eq("status", "ready")
      .maybeSingle();

    if (!edition) continue;

    const { data: sections } = await admin
      .from("edition_sections")
      .select("id, section_type, position, headline, body, source_note")
      .eq("edition_id", edition.id)
      .order("position");

    const { data: job } = await admin
      .from("generation_jobs")
      .select("build_state, stage_diagnostics")
      .eq("user_id", userId)
      .eq("edition_date", editionDate)
      .eq("metro_key", spec.expectedMetroKey)
      .maybeSingle();

    const buildState = job?.build_state ?? {};
    const validation = buildState.validation;
    const latestRepair = validation?.latestRepair;

    inputs.push({
      spec,
      editionDate,
      metroKey: edition.metro_key,
      editionId: edition.id,
      sections: sections ?? [],
      leadStory: edition.lead_story,
      nationalNews: edition.national_news,
      bandit: edition.bandit,
      intelligence: null,
      morningHero: edition.morning_edition?.morningHero ?? null,
      usNationalDailyId: edition.us_national_daily_id,
      editorialContext: edition.editorial_context,
      discovery: edition.discovery,
      pipeline: {
        validationStatus: validation?.latestReport?.overallStatus ?? null,
        validationMs: validation?.latestReport?.durationMs ?? null,
        repairStagesRequeued: latestRepair?.stages ?? [],
        buildState,
      },
    });
  }

  return inputs.length ? inputs : null;
}

const phase3 = runPhase3ValidationSuite();
let editions = buildAllPhase4FixtureEditions();
let mode = "fixture";

if (live) {
  const liveEditions = await loadLiveEditions();
  if (liveEditions?.length) {
    editions = liveEditions;
    mode = "live";
  } else {
    console.warn("[phase4] --live requested but no ready editions found; using fixtures.");
  }
}

const report = runPhase4ValidationSuite(editions, editionDate);

console.log(formatPhase4Report(report));
console.log("");
console.log("## Pipeline V2 Phase 3 regression");
console.log(
  `Phase 3: ${phase3.scenariosPassed}/${phase3.scenariosRun} scenarios, unnecessary reruns: ${phase3.unnecessaryReruns}`
);
console.log(`Mode: ${mode}`);

const outDir = join(root, "reports");
try {
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "edition-pipeline-v2-phase4.json");
  writeFileSync(
    outPath,
    JSON.stringify({ mode, phase3Summary: phase3, report }, null, 2),
    "utf8"
  );
  console.log(`Wrote ${outPath}`);
} catch {
  /* ignore */
}

if (report.recommendation === "major_issues_remaining") {
  process.exitCode = 1;
}
