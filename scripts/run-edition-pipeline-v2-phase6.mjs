#!/usr/bin/env node
/**
 * Edition Pipeline V2 Phase 6 — live production validation & launch sign-off.
 *
 * Read-only against persisted Supabase editions. Never mutates production.
 *
 * Usage:
 *   AUDIT_EDITION_DATE=YYYY-MM-DD npm run validate:edition-pipeline-v2-phase6 -- --live
 *   AUDIT_CITIES=gilbert-az,phoenix-az npm run validate:edition-pipeline-v2-phase6 -- --live
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnvLocal } from "./loadDotEnvLocal.mjs";
import {
  assessPhase6Environment,
  auditLiveCity,
  buildPhase4InputFromLiveRows,
  formatPhase6LaunchReport,
  parseAuditCityFilter,
  resolveEditionDatePreference,
  runPhase6LiveAudit,
  wrapReadOnlySupabaseClient,
} from "../lib/edition/pipelineV2Phase6LiveAudit.ts";
import { runPhase3ValidationSuite } from "../lib/edition/pipelineV2Simulation.ts";
import { runPhase4ValidationSuite } from "../lib/edition/pipelineV2Phase4QA.ts";
import { buildAllPhase4FixtureEditions } from "../lib/edition/pipelineV2Phase4Fixtures.ts";
import { PHASE4_FIXTURE_EDITION_DATE } from "../lib/edition/pipelineV2Phase4Fixtures.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnvLocal(root);

const args = process.argv.slice(2);
const live = args.includes("--live");
const requestedEditionDate =
  process.env.AUDIT_EDITION_DATE ??
  new Date().toISOString().slice(0, 10);

const EDITION_SELECT =
  "id, metro_key, edition_date, status, lead_story, national_news, bandit, discovery, editorial_context, us_national_daily_id, morning_edition, history_around_town";

async function loadLiveProductionData(cities, editionDate) {
  const env = assessPhase6Environment();
  if (!env.ok) {
    const cityResults = cities.map((spec) =>
      auditLiveCity({
        spec,
        resolution: {
          found: false,
          requestedEditionDate: editionDate,
          actualEditionDate: null,
          isStaleEdition: false,
          staleReason: "credentials unavailable — live load skipped",
          editionId: null,
          editionStatus: null,
        },
        edition: null,
        sections: [],
        job: null,
      })
    );
    return {
      env,
      cityResults,
      phase4Inputs: [],
      loadError: env.missing.join(", "),
    };
  }

  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.env.AUDIT_USER_ID;

  const { createClient } = await import("@supabase/supabase-js");
  const admin = wrapReadOnlySupabaseClient(
    createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  );

  const cityResults = [];
  const phase4Inputs = [];

  for (const spec of cities) {
    let edition = null;
    let resolution = {
      found: false,
      requestedEditionDate: editionDate,
      actualEditionDate: null,
      isStaleEdition: false,
      staleReason: "no ready edition found",
      editionId: null,
      editionStatus: null,
    };

    const exact = await admin
      .from("editions")
      .select(EDITION_SELECT)
      .eq("user_id", userId)
      .eq("edition_date", editionDate)
      .eq("metro_key", spec.expectedMetroKey)
      .eq("status", "ready")
      .maybeSingle();

    if (exact.error) {
      throw new Error(
        `[phase6] editions query failed for ${spec.label}: ${exact.error.message}`
      );
    }

    if (exact.data) {
      edition = exact.data;
      resolution = {
        found: true,
        requestedEditionDate: editionDate,
        actualEditionDate: edition.edition_date,
        isStaleEdition: false,
        staleReason: null,
        editionId: edition.id,
        editionStatus: edition.status,
      };
    } else {
      const newest = await admin
        .from("editions")
        .select(EDITION_SELECT)
        .eq("user_id", userId)
        .eq("metro_key", spec.expectedMetroKey)
        .eq("status", "ready")
        .order("edition_date", { ascending: false })
        .limit(1);

      if (newest.error) {
        throw new Error(
          `[phase6] newest edition query failed for ${spec.label}: ${newest.error.message}`
        );
      }

      const newestEdition = newest.data?.[0] ?? null;
      if (newestEdition) {
        edition = newestEdition;
        const pref = resolveEditionDatePreference(editionDate, edition.edition_date);
        resolution = {
          found: true,
          requestedEditionDate: editionDate,
          actualEditionDate: edition.edition_date,
          isStaleEdition: pref.isStaleEdition,
          staleReason: pref.staleReason,
          editionId: edition.id,
          editionStatus: edition.status,
        };
      }
    }

    let sections = [];
    let job = null;

    if (edition) {
      const sectionsRes = await admin
        .from("edition_sections")
        .select("id, section_type, position, headline, body, source_note")
        .eq("edition_id", edition.id)
        .order("position");

      if (sectionsRes.error) {
        throw new Error(
          `[phase6] edition_sections query failed for ${spec.label}: ${sectionsRes.error.message}`
        );
      }
      sections = sectionsRes.data ?? [];

      const jobRes = await admin
        .from("generation_jobs")
        .select(
          "id, status, build_state, stage_diagnostics, completed_stages, created_at, updated_at"
        )
        .eq("user_id", userId)
        .eq("edition_date", edition.edition_date)
        .eq("metro_key", spec.expectedMetroKey)
        .maybeSingle();

      if (jobRes.error) {
        throw new Error(
          `[phase6] generation_jobs query failed for ${spec.label}: ${jobRes.error.message}`
        );
      }
      job = jobRes.data ?? null;
    }

    const cityResult = auditLiveCity({
      spec,
      resolution,
      edition,
      sections,
      job,
    });
    cityResults.push(cityResult);

    if (edition) {
      phase4Inputs.push(
        buildPhase4InputFromLiveRows({
          spec,
          edition,
          sections,
          job,
          resolution,
        })
      );
    }
  }

  return { env, cityResults, phase4Inputs, loadError: null };
}

if (!live) {
  console.error(
    "Phase 6 requires --live for production validation. Fixture QA remains in Phase 4."
  );
  process.exitCode = 1;
  process.exit(1);
}

const cities = parseAuditCityFilter(process.env.AUDIT_CITIES);
const startedAt = Date.now();

let report;
let fixtureRegression = null;

try {
  const loaded = await loadLiveProductionData(cities, requestedEditionDate);
  report = runPhase6LiveAudit({
    requestedEditionDate,
    cities,
    cityResults: loaded.cityResults,
    environment: loaded.env,
    phase4Inputs: loaded.phase4Inputs,
  });

  if (!loaded.env.ok) {
    report.overallVerdict = "FAIL";
    report.launchBlockers.push({
      severity: "blocking",
      category: "environment_missing",
      message: `Missing credentials: ${loaded.loadError}`,
      publicationTier: "infrastructure",
    });
  }

  fixtureRegression = {
    phase3: runPhase3ValidationSuite(),
    phase4Fixtures: runPhase4ValidationSuite(
      buildAllPhase4FixtureEditions(),
      PHASE4_FIXTURE_EDITION_DATE
    ),
  };
} catch (err) {
  console.error("[phase6] live audit failed:", err);
  process.exitCode = 1;
  process.exit(1);
}

const elapsedMs = Date.now() - startedAt;

console.log(formatPhase6LaunchReport(report));
console.log("");
console.log("## Fixture regression (separate from live production)");
console.log(
  `Phase 3 fixtures: ${fixtureRegression.phase3.scenariosPassed}/${fixtureRegression.phase3.scenariosRun} scenarios`
);
console.log(
  `Phase 4 fixtures: ${fixtureRegression.phase4Fixtures.citiesPassed}/${fixtureRegression.phase4Fixtures.citiesRun} cities`
);
console.log("");
console.log("## Runtime");
console.log(`Live audit wall time: ${elapsedMs}ms`);
console.log("AI calls: 0");
console.log("Content generation calls: 0");
console.log("Write operations: 0");
console.log("API cost impact: read-only Supabase SELECT queries only");

const outDir = join(root, "reports");
mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, "edition-pipeline-v2-phase6-live.json");
const mdPath = join(outDir, "edition-pipeline-v2-phase6-live.md");

writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      elapsedMs,
      fixtureRegression,
      report,
    },
    null,
    2
  ),
  "utf8"
);
writeFileSync(mdPath, formatPhase6LaunchReport(report), "utf8");

console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${mdPath}`);

if (report.overallVerdict === "FAIL") {
  process.exitCode = 1;
}
