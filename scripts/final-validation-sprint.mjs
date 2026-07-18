#!/usr/bin/env node
/**
 * Final validation sprint — migration check, flagship E2E builds, nationwide market audit.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/final-validation-sprint.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/final-validation-sprint.mjs --skip-builds
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/final-validation-sprint.mjs --flagship-only
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";
const USER_ID = process.env.AUDIT_USER_ID ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = process.env.AUDIT_EDITION_DATE ?? "2026-07-17";

const FLAGSHIP_METROS = [
  {
    label: "Gilbert",
    city: "Gilbert",
    state: "AZ",
    region: "Arizona",
    lat: 33.2748,
    lon: -111.7769,
    expectedMetroKey: "phoenix-az",
  },
  {
    label: "Seattle",
    city: "Seattle",
    state: "WA",
    region: "Washington",
    lat: 47.6062,
    lon: -122.3321,
    expectedMetroKey: "seattle-wa",
  },
];

const ADULT_SCAM =
  /\b(strip club|adult entertainment|escort|swinger|bdsm|fetish|mlm|timeshare|pyramid scheme|get rich quick|speed dating|christian singles)\b/i;

const args = process.argv.slice(2);
const argSet = new Set(args);
const skipBuilds = argSet.has("--skip-builds");
const flagshipOnly = argSet.has("--flagship-only");
const gilbertOnly = argSet.has("--gilbert-only");
const metroLabelArg = (() => {
  const index = args.indexOf("--metro");
  if (index === -1 || index + 1 >= args.length) return null;
  return args[index + 1]?.trim() || null;
})();

function readNumericArg(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return fallback;
  const parsed = Number(args[index + 1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Max poll window for async edition builds (cold Edge workers can exceed 8 minutes). */
const E2E_MAX_WAIT_MS = readNumericArg(
  "--max-wait-ms",
  readNumericArg("--max-wait-min", 15) * 60_000
);
/** Stop polling if the job shows no progress for this long while still processing. */
const E2E_STUCK_JOB_MS = readNumericArg("--stuck-job-ms", 20 * 60_000);
const GILBERT_RUN_COUNT = gilbertOnly ? readNumericArg("--runs", 3) : 1;
const METRO_RUN_COUNT = metroLabelArg ? readNumericArg("--runs", 1) : 1;

// Service key resolved above (env or project fallback for QA scripts).

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAccessToken() {
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(USER_ID);
  if (userErr || !userData?.user?.email) {
    throw new Error(`getUserById failed: ${userErr?.message ?? "no email"}`);
  }
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`generateLink failed: ${linkErr?.message ?? "no token"}`);
  }
  const anon = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY);
  const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !sessionData?.session?.access_token) {
    throw new Error(`verifyOtp failed: ${verifyErr?.message ?? "no session"}`);
  }
  return sessionData.session.access_token;
}

async function checkMigrations() {
  const checks = {
    generationJobsMetroKey: false,
    claimUserGenerationJobRpc: false,
    generationJobsUniqueIndex: false,
  };

  const { error: metroColErr } = await admin
    .from("generation_jobs")
    .select("metro_key")
    .limit(1);
  checks.generationJobsMetroKey = !metroColErr;

  const { error: rpcErr } = await admin.rpc("claim_user_generation_job", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_edition_date: EDITION_DATE,
    p_metro_key: "__migration_probe__",
    p_max_attempts: 3,
  });
  checks.claimUserGenerationJobRpc =
    !rpcErr || !/function.*does not exist/i.test(rpcErr.message ?? "");

  return checks;
}

async function enqueueEdition(token, place) {
  const started = Date.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-edition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY || SERVICE_KEY,
    },
    body: JSON.stringify({
      editionDate: EDITION_DATE,
      devPreview: true,
      temperatureUnit: "fahrenheit",
      location: place,
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, enqueueMs: Date.now() - started };
}

async function waitForReady(metroKey, options = {}) {
  const maxWaitMs = options.maxWaitMs ?? E2E_MAX_WAIT_MS;
  const pollStarted = Date.now();
  let workerStartMs = null;
  let lastProgressMs = pollStarted;
  let lastJobStatus = null;
  let lastEditionStatus = null;

  while (Date.now() - pollStarted < maxWaitMs) {
    const [{ data: edition, error: editionError }, { data: job, error: jobError }] =
      await Promise.all([
        admin
          .from("editions")
          .select("id, status, metro_key, created_at")
          .eq("user_id", USER_ID)
          .eq("edition_date", EDITION_DATE)
          .eq("metro_key", metroKey)
          .maybeSingle(),
        admin
          .from("generation_jobs")
          .select("status, last_error, attempts, created_at, updated_at")
          .eq("user_id", USER_ID)
          .eq("edition_date", EDITION_DATE)
          .eq("metro_key", metroKey)
          .maybeSingle(),
      ]);

    if (editionError) {
      return {
        outcome: "failed",
        error: `edition poll failed: ${editionError.message}`,
        waitMs: Date.now() - pollStarted,
        job,
        pollError: editionError.message,
      };
    }
    if (jobError) {
      return {
        outcome: "failed",
        error: `generation_jobs poll failed: ${jobError.message}`,
        waitMs: Date.now() - pollStarted,
        job,
        pollError: jobError.message,
      };
    }

    if (job?.status === "processing" && workerStartMs == null) {
      workerStartMs = Date.now() - pollStarted;
    }

    const statusChanged =
      job?.status !== lastJobStatus || edition?.status !== lastEditionStatus;
    if (statusChanged) {
      lastProgressMs = Date.now();
      lastJobStatus = job?.status ?? null;
      lastEditionStatus = edition?.status ?? null;
    }

    const editionReady = edition?.status === "ready" && edition.id;
    const jobReady = job?.status === "ready";

    if (editionReady || jobReady) {
      if (!editionReady && jobReady) {
        const { data: resolvedEdition, error: resolveError } = await admin
          .from("editions")
          .select("id, status, metro_key, created_at")
          .eq("user_id", USER_ID)
          .eq("edition_date", EDITION_DATE)
          .eq("metro_key", metroKey)
          .eq("status", "ready")
          .maybeSingle();

        if (resolveError) {
          return {
            outcome: "failed",
            error: `edition ready resolve failed: ${resolveError.message}`,
            waitMs: Date.now() - pollStarted,
            job,
          };
        }
        if (!resolvedEdition?.id) {
          return {
            outcome: "failed",
            error: "generation_jobs ready but editions row not ready",
            waitMs: Date.now() - pollStarted,
            job,
            warnings: ["job_ready_without_edition_ready"],
          };
        }
        return {
          outcome: "ready",
          editionId: resolvedEdition.id,
          waitMs: Date.now() - pollStarted,
          workerStartMs,
          readyMs: Date.now() - pollStarted,
          job,
          edition: resolvedEdition,
        };
      }

      return {
        outcome: "ready",
        editionId: edition.id,
        waitMs: Date.now() - pollStarted,
        workerStartMs,
        readyMs: Date.now() - pollStarted,
        job,
        edition,
      };
    }

    if (job?.status === "failed") {
      return {
        outcome: "failed",
        error: job.last_error ?? "generation failed",
        waitMs: Date.now() - pollStarted,
        workerStartMs,
        job,
        edition,
      };
    }
    if (edition?.status === "failed") {
      return {
        outcome: "failed",
        error: job?.last_error ?? "edition failed",
        waitMs: Date.now() - pollStarted,
        workerStartMs,
        job,
        edition,
      };
    }

    if (
      job?.status === "processing" &&
      Date.now() - lastProgressMs >= E2E_STUCK_JOB_MS
    ) {
      return {
        outcome: "stuck",
        error: `job processing with no status change for ${E2E_STUCK_JOB_MS}ms`,
        waitMs: Date.now() - pollStarted,
        workerStartMs,
        job,
        edition,
      };
    }

    await sleep(3000);
  }

  const [{ data: edition }, { data: job }] = await Promise.all([
    admin
      .from("editions")
      .select("id, status, metro_key, created_at")
      .eq("user_id", USER_ID)
      .eq("edition_date", EDITION_DATE)
      .eq("metro_key", metroKey)
      .maybeSingle(),
    admin
      .from("generation_jobs")
      .select("status, last_error, attempts, updated_at")
      .eq("user_id", USER_ID)
      .eq("edition_date", EDITION_DATE)
      .eq("metro_key", metroKey)
      .maybeSingle(),
  ]);

  if (edition?.status === "ready" && edition.id) {
    return {
      outcome: "ready",
      editionId: edition.id,
      waitMs: Date.now() - pollStarted,
      workerStartMs,
      readyMs: Date.now() - pollStarted,
      job,
      edition,
      warnings: ["ready_found_on_final_poll_after_timeout_window"],
    };
  }

  return {
    outcome: "timeout",
    error: `no ready edition within ${maxWaitMs}ms (edition=${edition?.status ?? "missing"}, job=${job?.status ?? "missing"})`,
    waitMs: Date.now() - pollStarted,
    workerStartMs,
    job,
    edition,
  };
}

function parseEvents(body) {
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed) ? parsed : parsed.events ?? [];
  } catch {
    return [];
  }
}

function discoveryCount(discovery, desk) {
  const surfaces = discovery?.surfaces ?? {};
  if (desk === "activities") {
    let n = 0;
    for (const [key, surface] of Object.entries(surfaces)) {
      if (!surface?.items) continue;
      if (/activities|museums|parks|beaches|hiking|hidden_gems/.test(key)) {
        n += surface.items.length;
      }
    }
    return n;
  }
  if (desk === "food_drinks") {
    let n = 0;
    for (const key of ["restaurants", "coffee", "bakeries"]) {
      n += surfaces[key]?.items?.length ?? 0;
    }
    return n;
  }
  return 0;
}

function analyzeFlagshipEdition(metro, edition, sections) {
  const findings = [];
  const sectionTypes = sections.map((s) => s.section_type);

  const required = [
    ["today_in_history", "Today in History"],
    ["greeting", "Morning greeting"],
    ["top_stories", "Local News"],
  ];

  for (const [type, label] of required) {
    if (!sectionTypes.includes(type)) {
      findings.push({ priority: "P0", category: "missing_section", message: `${label} missing` });
    }
  }

  const hasStoryOf =
    sectionTypes.includes("story_of") || sectionTypes.includes("your_city");
  if (!hasStoryOf) {
    findings.push({ priority: "P1", category: "missing_section", message: "Story of Your City missing" });
  }

  const eventsSection = sections.find((s) => s.section_type === "local_events");
  const events = parseEvents(eventsSection?.body);
  if (!eventsSection) {
    findings.push({ priority: "P0", category: "empty_section", message: "Local Events section missing" });
  } else if (events.length === 0) {
    findings.push({ priority: "P0", category: "empty_section", message: "Local Events empty after gate" });
  }

  for (const e of events) {
    if (ADULT_SCAM.test(`${e.name} ${e.venue ?? ""}`)) {
      findings.push({
        priority: "P0",
        category: "family_safety",
        message: `Unsafe event surfaced: ${e.name}`,
      });
    }
    if (!e.banditNote?.trim() || !e.editorialBody?.length) {
      findings.push({
        priority: "P0",
        category: "editorial",
        message: `Unpublishable event body: ${e.name}`,
      });
    }
    if (e.lat == null || e.lon == null) {
      findings.push({
        priority: "P1",
        category: "coordinates",
        message: `Event missing coordinates: ${e.name}`,
      });
    }
    if (!e.sourceUrl?.trim()) {
      findings.push({
        priority: "P1",
        category: "links",
        message: `Event missing official link: ${e.name}`,
      });
    }
  }

  if (events.length > 20) {
    findings.push({
      priority: "P1",
      category: "see_all_cap",
      message: `Local Events exceeds See All cap (${events.length}/20)`,
    });
  }

  const bandit = edition.bandit;
  const pickHeadline = bandit?.pick?.story?.headline ?? bandit?.pick?.story?.title;
  if (!pickHeadline?.trim()) {
    findings.push({ priority: "P0", category: "bandits_pick", message: "Bandit's Pick missing" });
  }

  const morningHero = edition.morning_edition?.morningHero;
  if (!morningHero?.hostedUrl?.trim()) {
    findings.push({ priority: "P1", category: "masterpiece", message: "Today's Masterpiece hero missing" });
  }

  const activities = discoveryCount(edition.discovery, "activities");
  const foodDrinks = discoveryCount(edition.discovery, "food_drinks");
  if (activities === 0) {
    findings.push({ priority: "P1", category: "empty_section", message: "Activities discovery empty" });
  }
  if (foodDrinks === 0) {
    findings.push({ priority: "P1", category: "empty_section", message: "Food & Drink discovery empty" });
  }

  if (edition.status !== "ready") {
    findings.unshift({
      priority: "P0",
      category: "edition_status",
      message: `Edition status ${edition.status}`,
    });
  }

  const p0 = findings.filter((f) => f.priority === "P0").length;
  const p1 = findings.filter((f) => f.priority === "P1").length;
  const score = Math.max(0, 100 - p0 * 25 - p1 * 8);

  return {
    metro: metro.label,
    metroKey: edition.metro_key,
    editionId: edition.id,
    status: edition.status,
    generationMs: null,
    healthScore: score,
    sections: {
      masterpiece: Boolean(morningHero?.hostedUrl),
      localEvents: events.length,
      activities,
      foodDrinks,
      storyOf: hasStoryOf,
      banditsPick: Boolean(pickHeadline),
      todayInHistory: sectionTypes.includes("today_in_history"),
      localNews: sectionTypes.includes("top_stories"),
    },
    findings,
  };
}

async function runFlagshipBuild(token, metro, runLabel = null) {
  const place = {
    city: metro.city,
    state: metro.state,
    region: metro.region,
    lat: metro.lat,
    lon: metro.lon,
  };

  await admin
    .from("editions")
    .delete()
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", metro.expectedMetroKey);

  await admin
    .from("generation_jobs")
    .delete()
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", metro.expectedMetroKey);

  const enqueue = await enqueueEdition(token, place);
  const totalStarted = Date.now();

  if (enqueue.status >= 400) {
    return {
      metro: metro.label,
      runLabel,
      ok: false,
      error: JSON.stringify(enqueue.body),
      enqueueMs: enqueue.enqueueMs,
      timing: {
        enqueueMs: enqueue.enqueueMs,
        workerStartMs: null,
        readyMs: null,
        totalMs: enqueue.enqueueMs,
      },
    };
  }

  const wait = await waitForReady(metro.expectedMetroKey);
  const totalMs = Date.now() - totalStarted;

  if (wait.outcome !== "ready") {
    return {
      metro: metro.label,
      runLabel,
      ok: false,
      error: wait.error ?? wait.outcome,
      enqueueMs: enqueue.enqueueMs,
      waitMs: wait.waitMs,
      totalMs,
      job: wait.job,
      editionStatus: wait.edition?.status ?? null,
      warnings: wait.warnings ?? [],
      timing: {
        enqueueMs: enqueue.enqueueMs,
        workerStartMs: wait.workerStartMs,
        readyMs: wait.readyMs ?? null,
        totalMs,
        pollMs: wait.waitMs,
      },
    };
  }

  const { data: edition, error: editionErr } = await admin
    .from("editions")
    .select(
      "id,status,metro_key,bandit,discovery,morning_edition,lead_story,created_at"
    )
    .eq("id", wait.editionId)
    .maybeSingle();

  if (editionErr || !edition) {
    return {
      metro: metro.label,
      runLabel,
      ok: false,
      error: editionErr?.message ?? "edition row missing after ready",
      totalMs,
      timing: {
        enqueueMs: enqueue.enqueueMs,
        workerStartMs: wait.workerStartMs,
        readyMs: wait.readyMs ?? wait.waitMs,
        totalMs,
        pollMs: wait.waitMs,
      },
    };
  }

  const { data: sections } = await admin
    .from("edition_sections")
    .select("section_type,headline,body,position")
    .eq("edition_id", edition.id)
    .order("position");

  const analysis = analyzeFlagshipEdition(metro, edition, sections ?? []);
  analysis.generationMs = totalMs;
  analysis.enqueueMs = enqueue.enqueueMs;
  analysis.waitMs = wait.waitMs;
  analysis.runLabel = runLabel;
  analysis.timing = {
    enqueueMs: enqueue.enqueueMs,
    workerStartMs: wait.workerStartMs,
    readyMs: wait.readyMs ?? wait.waitMs,
    totalMs,
    pollMs: wait.waitMs,
  };
  analysis.warnings = wait.warnings ?? [];
  analysis.persistedSections = (sections ?? []).map((s) => s.section_type);
  analysis.discoverySurfaceCount = edition.discovery?.surfaces
    ? Object.values(edition.discovery.surfaces).reduce(
        (n, surface) => n + (surface?.items?.length ?? 0),
        0
      )
    : 0;
  analysis.ok = analysis.findings.filter((f) => f.priority === "P0").length === 0;

  return analysis;
}

async function validateUsMarket(slug) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/build-market`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ slug, action: "validate" }),
  });
  const body = await res.json().catch(() => ({}));
  return { slug, ok: res.ok, status: res.status, body };
}

async function runNationwideAudit() {
  const catalogPath = join(__dirname, "../reports/us-market-catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const markets = catalog.markets ?? [];

  const results = [];
  let complete = 0;
  let foundation = 0;
  let failed = 0;

  for (const market of markets) {
    const row = await validateUsMarket(market.slug);
    const completeness = row.body?.completeness;
    const report = {
      slug: market.slug,
      metroKey: market.metro_key,
      displayName: market.display_name,
      state: market.state,
      ok: row.ok,
      status: row.body?.status ?? market.status,
      complete: completeness?.complete === true,
      foundationComplete: completeness?.foundationComplete === true,
      needsAttention: completeness?.needsAttention === true,
      deficiencies: completeness?.deficiencies ?? [],
      catalogCounts: completeness?.catalogCounts ?? null,
      error: row.ok ? null : row.body?.error ?? `HTTP ${row.status}`,
    };

    if (report.complete) complete += 1;
    else if (report.foundationComplete) foundation += 1;
    if (!row.ok) failed += 1;

    results.push(report);
    process.stdout.write(
      report.complete ? "✓" : report.foundationComplete ? "○" : "·"
    );
  }
  console.log("");

  const successRate = Math.round((complete / markets.length) * 100);
  const foundationRate = Math.round(
    ((complete + foundation) / markets.length) * 100
  );

  return {
    totalMarkets: markets.length,
    catalogComplete: complete,
    foundationReady: foundation,
    validateErrors: failed,
    successRate,
    foundationRate,
    results,
  };
}

function categorizeIssues(flagshipReports, nationwide) {
  const issues = [];

  for (const report of flagshipReports) {
    for (const f of report.findings ?? []) {
      issues.push({ ...f, scope: report.metro });
    }
  }

  const systemic = new Map();
  for (const row of nationwide.results) {
    for (const d of row.deficiencies ?? []) {
      const key = typeof d === "string" ? d : d.code ?? d.message ?? String(d);
      const entry = systemic.get(key) ?? { count: 0, markets: [] };
      entry.count += 1;
      entry.markets.push(row.displayName);
      systemic.set(key, entry);
    }
  }

  return {
    flagship: issues,
    systemic: [...systemic.entries()]
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  };
}

function formatTimingReport(report) {
  const t = report.timing ?? {};
  return [
    `enqueue=${t.enqueueMs ?? report.enqueueMs ?? "—"}ms`,
    `workerStart=${t.workerStartMs ?? "—"}ms`,
    `ready=${t.readyMs ?? report.waitMs ?? "—"}ms`,
    `total=${t.totalMs ?? report.generationMs ?? report.totalMs ?? "—"}ms`,
  ].join(" ");
}

function evaluateCompleteEditionReady(report) {
  const warnings = [...(report.warnings ?? [])];
  const sections = report.persistedSections ?? [];
  const checks = {
    statusReady: report.status === "ready",
    localEvents: (report.sections?.localEvents ?? 0) > 0,
    activities: (report.sections?.activities ?? 0) > 0,
    foodDrinks: (report.sections?.foodDrinks ?? 0) > 0,
    storyOf: sections.includes("story_of") || sections.includes("your_city"),
    masterpiece: report.sections?.masterpiece === true,
    todayInHistory: sections.includes("today_in_history"),
    banditsPick: report.sections?.banditsPick === true,
    discovery:
      report.discoverySurfaceCount != null
        ? report.discoverySurfaceCount > 0
        : true,
  };

  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) warnings.push(`missing_${key}`);
  }

  const ok = Object.values(checks).every(Boolean);
  return { ok, checks, warnings };
}

function evaluateGilbertEditionReady(report) {
  const full = evaluateCompleteEditionReady(report);
  const checks = {
    statusReady: full.checks.statusReady,
    localEvents: full.checks.localEvents,
    storyOf: full.checks.storyOf,
    todayInHistory: full.checks.todayInHistory,
    weather: (report.persistedSections ?? []).includes("weather"),
    banditsPick: full.checks.banditsPick,
  };
  const warnings = [...full.warnings];
  for (const [key, ok] of Object.entries(checks)) {
    if (!ok && !warnings.includes(`missing_${key}`)) warnings.push(`missing_${key}`);
  }
  const ok = Object.values(checks).every(Boolean);
  return { ok, checks, warnings };
}

function printMetroEditionReport(label, runIndex, runCount, report, gateFn) {
  const gate = gateFn(report);
  report.editionGate = gate;
  report.ok = gate.ok;

  console.log(`\n--- ${label} run ${runIndex}/${runCount} ---`);
  console.log(`  Status: ${gate.ok ? "PASS" : "FAIL"} (edition=${report.status ?? "unknown"})`);
  console.log(`  Timing: ${formatTimingReport(report)}`);
  console.log(
    `  Local Events: ${report.sections?.localEvents ?? 0} | Activities: ${report.sections?.activities ?? 0} | Food & Drink: ${report.sections?.foodDrinks ?? 0}`
  );
  console.log(
    `  Sections: ${(report.persistedSections ?? []).join(", ") || "none"}`
  );
  console.log(
    `  Masterpiece: ${report.sections?.masterpiece ? "yes" : "no"} | Bandit's Pick: ${report.sections?.banditsPick ? "yes" : "no"} | Discovery surfaces: ${report.discoverySurfaceCount ?? "—"}`
  );
  const failedChecks = Object.entries(gate.checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  if (failedChecks.length) {
    console.log(`  Failed checks: ${failedChecks.join(", ")}`);
  }
  const allWarnings = [...new Set([...(report.warnings ?? []), ...gate.warnings])];
  if (allWarnings.length) {
    console.log(`  Warnings: ${allWarnings.join("; ")}`);
  }
  if (report.error) console.log(`  Error: ${report.error}`);
  if (report.findings?.length) {
    const p1 = report.findings.filter((f) => f.priority === "P1");
    if (p1.length) {
      console.log(`  P1 notes: ${p1.map((f) => f.message).join("; ")}`);
    }
  }
}

function printGilbertRunReport(runIndex, report) {
  printMetroEditionReport("Gilbert", runIndex, GILBERT_RUN_COUNT, report, evaluateGilbertEditionReady);
  report.gilbertGate = report.editionGate;
}

async function main() {
  console.log("=== Kindred Final Validation Sprint ===");
  console.log(`Edition date: ${EDITION_DATE}`);
  console.log(`Project: ${SUPABASE_URL}`);
  console.log(
    `E2E poll window: ${E2E_MAX_WAIT_MS}ms | stuck-job guard: ${E2E_STUCK_JOB_MS}ms`
  );

  const migrationChecks = await checkMigrations();
  console.log("\nMigration checks:", migrationChecks);

  const token = skipBuilds ? null : await getAccessToken();

  let flagshipReports = [];
  if (!skipBuilds && token) {
    const metrosToBuild = metroLabelArg
      ? FLAGSHIP_METROS.filter(
          (m) => m.label.toLowerCase() === metroLabelArg.toLowerCase()
        )
      : gilbertOnly
        ? FLAGSHIP_METROS.filter((m) => m.label === "Gilbert")
        : FLAGSHIP_METROS;

    if (metroLabelArg && metrosToBuild.length === 0) {
      throw new Error(`Unknown metro label: ${metroLabelArg}`);
    }

    console.log("\n--- Flagship E2E builds ---");
    for (const metro of metrosToBuild) {
      const runCount =
        metro.label === "Gilbert" && gilbertOnly
          ? GILBERT_RUN_COUNT
          : metroLabelArg
            ? METRO_RUN_COUNT
            : 1;
      for (let run = 1; run <= runCount; run += 1) {
        const runLabel = runCount > 1 ? `run-${run}` : null;
        console.log(
          `Building ${metro.label}${runLabel ? ` (${runLabel})` : ""}...`
        );
        const report = await runFlagshipBuild(token, metro, runLabel);
        flagshipReports.push(report);
        if (gilbertOnly && metro.label === "Gilbert") {
          printGilbertRunReport(run, report);
        } else if (metroLabelArg) {
          printMetroEditionReport(
            metro.label,
            run,
            runCount,
            report,
            evaluateCompleteEditionReady
          );
        } else {
          console.log(
            `  ${metro.label}: ${report.ok ? "PASS" : "FAIL"} score=${report.healthScore ?? "—"} ${formatTimingReport(report)}`
          );
          if (report.error) console.log(`  error: ${report.error}`);
        }
        const shouldStop =
          (gilbertOnly && metro.label === "Gilbert" && !report.ok) ||
          (metroLabelArg && !report.ok);
        if (shouldStop) {
          console.error(
            `\nStopping after ${metro.label} ${runLabel ?? "run"} failure — fix before additional runs.`
          );
          break;
        }
      }
      if (gilbertOnly && metro.label === "Gilbert") {
        const gilbertRuns = flagshipReports.filter((r) => r.metro === "Gilbert");
        const allPass =
          gilbertRuns.length === GILBERT_RUN_COUNT &&
          gilbertRuns.every((r) => r.ok && r.status === "ready");
        console.log(
          `\nGilbert consecutive ready: ${gilbertRuns.filter((r) => r.ok).length}/${GILBERT_RUN_COUNT}${allPass ? " ✓" : ""}`
        );
      }
      if (metroLabelArg && metro.label === metrosToBuild[0]?.label) {
        const metroRuns = flagshipReports.filter((r) => r.metro === metro.label);
        const allPass =
          metroRuns.length === METRO_RUN_COUNT &&
          metroRuns.every((r) => r.ok && r.status === "ready");
        console.log(
          `\n${metro.label} consecutive ready: ${metroRuns.filter((r) => r.ok).length}/${METRO_RUN_COUNT}${allPass ? " ✓" : ""}`
        );
      }
    }
  }

  let nationwide = null;
  if (!flagshipOnly && !gilbertOnly && !metroLabelArg) {
    console.log("\n--- Nationwide market audit (115 U.S. markets) ---");
    nationwide = await runNationwideAudit();
    console.log(
      `Complete: ${nationwide.catalogComplete}/${nationwide.totalMarkets} (${nationwide.successRate}%)`
    );
    console.log(
      `Foundation-ready: ${nationwide.foundationReady} (${nationwide.foundationRate}% incl. complete)`
    );
    console.log(`Validate API errors: ${nationwide.validateErrors}`);
  }

  const issues = categorizeIssues(flagshipReports, nationwide ?? { results: [] });

  const gilbert = flagshipReports.find((r) => r.metro === "Gilbert");
  const seattle = flagshipReports.find((r) => r.metro === "Seattle");

  const avgFlagship =
    flagshipReports.length > 0
      ? Math.round(
          flagshipReports.reduce((s, r) => s + (r.healthScore ?? 0), 0) /
            flagshipReports.length
        )
      : null;

  const report = {
    generatedAt: new Date().toISOString(),
    editionDate: EDITION_DATE,
    migrationChecks,
    flagship: flagshipReports,
    nationwide,
    issues,
    scores: {
      productionReadiness: null,
      nationwideHealth: nationwide?.successRate ?? null,
      gilbertHealth: gilbert?.healthScore ?? null,
      seattleHealth: seattle?.healthScore ?? null,
      avgFlagshipHealth: avgFlagship,
    },
  };

  report.scores.productionReadiness = Math.round(
    (migrationChecks.claimUserGenerationJobRpc ? 15 : 0) +
      (migrationChecks.generationJobsMetroKey ? 10 : 0) +
      (avgFlagship ?? 0) * 0.35 +
      (nationwide?.foundationRate ?? 0) * 0.4
  );

  mkdirSync(join(__dirname, "../reports"), { recursive: true });
  const jsonPath = join(__dirname, "../reports/final-validation-sprint.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${jsonPath}`);

  return report;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
