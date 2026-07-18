#!/usr/bin/env node
/**
 * Phased U.S. market build orchestrator — one market, resumable phases.
 *
 * Usage:
 *   node scripts/build-us-market.mjs <market-slug> [--dry-run] [--resume] [--phase=<name>]
 *
 * Examples:
 *   node scripts/build-us-market.mjs seattle-wa-metro --dry-run
 *   node scripts/build-us-market.mjs phoenix-az-metro
 *   node scripts/build-us-market.mjs phoenix-az-metro --phase=activities --resume
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { catalogAuthHeaders, supabaseUrl } from "./lib/catalogAuth.mjs";

const MARKET_BUILD_PHASES = [
  "preflight",
  "events",
  "activities",
  "food_drinks",
  "reconcile",
  "validate",
  "finalize",
];

const CATALOG_PHASES = new Set(["events", "activities", "food_drinks"]);
const PHASE_MAX_ATTEMPTS = 3;
const PHASE_RETRY_WAIT_MS = 30_000;

const SUPABASE_URL = supabaseUrl();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"))?.trim();
const dryRun = args.includes("--dry-run");
const resume = args.includes("--resume");
const phaseArg = args.find((a) => a.startsWith("--phase="))?.split("=")[1]?.trim();

if (!slug) {
  console.error(
    "Usage: node scripts/build-us-market.mjs <market-slug> [--dry-run] [--resume] [--phase=<name>]"
  );
  process.exit(1);
}

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

try {
  catalogAuthHeaders();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN_STATE_DIR = join(process.cwd(), "reports", ".market-build-runs");

function classifyWorkerExit(httpStatus, body) {
  const text =
    typeof body === "object" && body !== null
      ? JSON.stringify(body)
      : String(body ?? "");

  if (httpStatus === 546) return "http_546";
  if (httpStatus === 504) return "http_504";
  if (/WORKER_RESOURCE_LIMIT/i.test(text)) return "resource_limit";
  if (/gateway.?timeout|504|timed out/i.test(text)) return "gateway_timeout";
  if (httpStatus != null && httpStatus >= 200 && httpStatus < 300) return "success";
  return "error";
}

function isRetriable(reason) {
  return (
    reason === "resource_limit" ||
    reason === "gateway_timeout" ||
    reason === "http_504" ||
    reason === "http_546"
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadRunState() {
  const path = join(RUN_STATE_DIR, `${slug}.json`);
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveRunState(state) {
  await mkdir(RUN_STATE_DIR, { recursive: true });
  const path = join(RUN_STATE_DIR, `${slug}.json`);
  await writeFile(path, JSON.stringify(state, null, 2));
}

async function loadMarket() {
  const { data, error } = await admin
    .from("kindred_us_markets")
    .select(
      "slug, metro_key, status, primary_city, completeness, build_lock_token, build_lock_expires_at"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Unknown market slug: ${slug}`);
  return data;
}

async function loadBootstrap(metroKey) {
  const [eventsMetro, activitiesMetro, foodMetro] = await Promise.all([
    admin
      .from("events_catalog_metros")
      .select("initial_import_completed_at")
      .eq("metro_key", metroKey)
      .maybeSingle(),
    admin
      .from("activities_catalog_metros")
      .select("initial_import_completed_at")
      .eq("metro_key", metroKey)
      .maybeSingle(),
    admin
      .from("food_drink_catalog_metros")
      .select("initial_import_completed_at")
      .eq("metro_key", metroKey)
      .maybeSingle(),
  ]);

  return {
    events: Boolean(eventsMetro.data?.initial_import_completed_at),
    activities: Boolean(activitiesMetro.data?.initial_import_completed_at),
    food_drinks: Boolean(foodMetro.data?.initial_import_completed_at),
  };
}

function shouldSkipCatalogPhase(phase, bootstrap, marketStatus) {
  if (!CATALOG_PHASES.has(phase)) return false;
  if (marketStatus === "complete") return true;
  if (phase === "events" && bootstrap.events) return true;
  if (phase === "activities" && bootstrap.activities) return true;
  if (phase === "food_drinks" && bootstrap.food_drinks) return true;
  return false;
}

async function invokePhase(runId, phase, attempt) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/build-market`, {
    method: "POST",
    headers: catalogAuthHeaders(),
    body: JSON.stringify({
      slug,
      action: "phase",
      phase,
      runId,
      attempt,
      dryRun: dryRun && phase === "preflight",
    }),
  });

  const body = await res.json().catch(() => ({}));
  const exitReason = classifyWorkerExit(res.status, body);
  return { ok: res.ok && body.success !== false, status: res.status, body, exitReason };
}

function formatTextReport(report) {
  const lines = [
    `Kindred Market Build — ${report.slug}`,
    `Run ID: ${report.runId}`,
    `Started: ${report.startedAt}`,
    `Finished: ${report.finishedAt}`,
    `Dry run: ${report.dryRun}`,
    `Market status: ${report.marketStatusBefore} → ${report.marketStatusAfter}`,
    `Complete: ${report.complete}`,
    `Total duration: ${(report.totalDurationMs / 1000).toFixed(1)}s`,
    "",
    "Phases:",
  ];

  for (const p of report.phases) {
    lines.push(
      `  - ${p.phase}: ${p.status}${p.skipped ? " (skipped)" : ""} — ${p.durationMs ?? 0}ms` +
        (p.rowsImported != null ? `, rows=${p.rowsImported}` : "") +
        (p.attempts > 1 ? `, attempts=${p.attempts}` : "") +
        (p.exitReason ? `, exit=${p.exitReason}` : "")
    );
    if (p.warnings?.length) {
      for (const w of p.warnings) lines.push(`      warn: ${w}`);
    }
    if (p.error) lines.push(`      error: ${p.error}`);
  }

  if (report.validation) {
    lines.push("", "Validation:");
    lines.push(`  complete: ${report.validation.complete}`);
    if (report.validation.deficiencies?.length) {
      lines.push(`  deficiencies: ${report.validation.deficiencies.join("; ")}`);
    }
  }

  if (report.estimatedRuntimeNote) {
    lines.push("", report.estimatedRuntimeNote);
  }

  return lines.join("\n");
}

async function writeMorningReport(report) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(process.cwd(), "reports", "market-builds");
  await mkdir(dir, { recursive: true });
  const base = join(dir, `${slug}-${ts}`);
  await writeFile(`${base}.json`, JSON.stringify(report, null, 2));
  await writeFile(`${base}.txt`, formatTextReport(report));
  console.log(`Morning report: ${base}.json`);
  console.log(`Morning report: ${base}.txt`);
}

async function main() {
  const startedAt = Date.now();
  const market = await loadMarket();
  const bootstrap = await loadBootstrap(market.metro_key);

  let runState = resume ? await loadRunState() : null;
  const runId = runState?.runId ?? randomUUID();

  if (!runState) {
    runState = {
      runId,
      slug,
      metroKey: market.metro_key,
      startedAt: new Date().toISOString(),
      phases: {},
    };
    await saveRunState(runState);
  }

  const report = {
    slug,
    metroKey: market.metro_key,
    runId,
    dryRun,
    startedAt: runState.startedAt,
    finishedAt: null,
    marketStatusBefore: market.status,
    marketStatusAfter: market.status,
    complete: false,
    totalDurationMs: 0,
    phases: [],
    validation: null,
    bootstrapBefore: bootstrap,
    estimatedRuntimeNote:
      "Expected optimized runtime ~7 min/market vs ~12–14 min pre-hardening (phased edge calls, batch upserts, deferred notes, parallel activity categories).",
  };

  if (dryRun) {
    console.log(`Dry run for ${slug} — validating existing market state (no catalog sync).`);
    const validate = await invokePhase(runId, "validate", 1);
    report.phases.push({
      phase: "validate",
      status: validate.ok ? "succeeded" : "failed",
      durationMs: validate.body.durationMs ?? 0,
      attempts: 1,
      exitReason: validate.exitReason,
      warnings: validate.body.warnings ?? [],
      error: validate.ok ? null : validate.body.error,
    });
    report.validation = validate.body.completeness ?? null;
    report.complete = Boolean(validate.body.completeness?.complete);
    report.marketStatusAfter = validate.body.status ?? market.status;
    report.finishedAt = new Date().toISOString();
    report.totalDurationMs = Date.now() - startedAt;
    await writeMorningReport(report);
    console.log(formatTextReport(report));
    process.exit(validate.ok && report.complete ? 0 : 1);
  }

  const phasesToRun = phaseArg ? [phaseArg] : MARKET_BUILD_PHASES;

  for (const phase of phasesToRun) {
    if (!MARKET_BUILD_PHASES.includes(phase)) {
      console.error(`Unknown phase: ${phase}`);
      process.exit(1);
    }

    if (shouldSkipCatalogPhase(phase, bootstrap, market.status)) {
      const skipReason =
        market.status === "complete"
          ? "market already complete"
          : "catalog bootstrap already finalized";
      console.log(`Skipping ${phase}: ${skipReason}`);
      report.phases.push({
        phase,
        status: "skipped",
        skipped: true,
        durationMs: 0,
        attempts: 0,
        warnings: [skipReason],
      });
      runState.phases[phase] = { status: "skipped", at: new Date().toISOString() };
      await saveRunState(runState);
      continue;
    }

    if (resume && runState.phases[phase]?.status === "completed") {
      console.log(`Skipping ${phase}: already completed in run ${runId}`);
      report.phases.push({
        phase,
        status: "skipped",
        skipped: true,
        durationMs: 0,
        attempts: 0,
        warnings: ["resume — phase already completed"],
      });
      continue;
    }

    let attempt = 1;
    let phaseResult = null;

    while (attempt <= PHASE_MAX_ATTEMPTS) {
      console.log(`Running phase ${phase} (attempt ${attempt}/${PHASE_MAX_ATTEMPTS})…`);
      const started = Date.now();
      phaseResult = await invokePhase(runId, phase, attempt);
      const durationMs = Date.now() - started;

      if (phaseResult.ok) {
        report.phases.push({
          phase,
          status: phaseResult.body.skipped ? "skipped" : "succeeded",
          skipped: Boolean(phaseResult.body.skipped),
          durationMs: phaseResult.body.durationMs ?? durationMs,
          rowsImported: phaseResult.body.rowsImported,
          apiCallCounts: phaseResult.body.apiCallCounts,
          attempts: attempt,
          exitReason: phaseResult.exitReason,
          warnings: phaseResult.body.warnings ?? [],
        });
        runState.phases[phase] = {
          status: "completed",
          at: new Date().toISOString(),
          attempts: attempt,
        };
        await saveRunState(runState);
        break;
      }

      const retriable = isRetriable(phaseResult.exitReason);
      console.warn(
        `Phase ${phase} failed (${phaseResult.exitReason}): ${phaseResult.body.error ?? "unknown"}`
      );

      if (!retriable || attempt >= PHASE_MAX_ATTEMPTS) {
        report.phases.push({
          phase,
          status: "failed",
          durationMs,
          attempts: attempt,
          exitReason: phaseResult.exitReason,
          error: phaseResult.body.error ?? `HTTP ${phaseResult.status}`,
        });
        runState.phases[phase] = {
          status: "failed",
          at: new Date().toISOString(),
          attempts: attempt,
          error: phaseResult.body.error,
        };
        await saveRunState(runState);

        await admin
          .from("kindred_us_markets")
          .update({
            status: "needs_attention",
            last_error: phaseResult.body.error ?? phaseResult.exitReason,
            updated_at: new Date().toISOString(),
          })
          .eq("slug", slug);

        report.finishedAt = new Date().toISOString();
        report.totalDurationMs = Date.now() - startedAt;
        await writeMorningReport(report);
        console.error(formatTextReport(report));
        process.exit(1);
      }

      console.log(`Waiting ${PHASE_RETRY_WAIT_MS / 1000}s before retry…`);
      await sleep(PHASE_RETRY_WAIT_MS);
      attempt += 1;
    }
  }

  const finalMarket = await loadMarket();
  report.marketStatusAfter = finalMarket.status;
  report.validation = finalMarket.completeness ?? phaseResult?.body?.completeness ?? null;
  report.complete = Boolean(report.validation?.complete);
  report.finishedAt = new Date().toISOString();
  report.totalDurationMs = Date.now() - startedAt;

  await writeMorningReport(report);
  console.log(formatTextReport(report));
  process.exit(report.complete ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
