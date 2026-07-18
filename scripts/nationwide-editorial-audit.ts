#!/usr/bin/env node
/**
 * Nationwide editorial validation + performance audit.
 *
 * Proves shared U.S. national layer parity and local city isolation across
 * 10 flagship metros. Does not modify product behavior.
 *
 * Usage:
 *   npx --yes tsx scripts/nationwide-editorial-audit.ts
 *   npx --yes tsx scripts/nationwide-editorial-audit.ts --skip-builds
 *   npx --yes tsx scripts/nationwide-editorial-audit.ts --city Seattle
 */

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import {
  NATIONWIDE_AUDIT_CITIES,
  buildCitySnapshot,
  detectCityBleed,
  summarizePerformance,
  verifyLocalDistinct,
  verifyNationalParity,
  type AuditIssue,
  type CityTiming,
} from "../lib/edition/nationwideAudit.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(pathToFileURL(__filename));
(require("./loadDotEnvLocal.mjs") as { loadDotEnvLocal: (cwd?: string) => boolean }).loadDotEnvLocal(
  join(__dirname, "..")
);
const { invokeEdgeViaVault } = require("./lib/vaultEdgeInvoke.mjs") as {
  invokeEdgeViaVault: (
    functionPath: string,
    body: Record<string, unknown>,
    opts?: { timeoutMs?: number }
  ) => { ok: boolean; status: number; stdout: string; stderr: string };
};

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
const EDITION_DATE = process.env.AUDIT_EDITION_DATE ?? "2026-07-18";
const MAX_WAIT_MS = Number(process.env.AUDIT_MAX_WAIT_MS ?? 15 * 60_000);

const args = process.argv.slice(2);
const skipBuilds = args.includes("--skip-builds");
const useLocalBuild = args.includes("--local-build");
const cityFilter = (() => {
  const i = args.indexOf("--city");
  return i >= 0 && args[i + 1] ? args[i + 1].trim() : null;
})();

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function reapStaleGenerationJobs(staleAfterMinutes = 1): Promise<number> {
  const { data, error } = await admin.rpc("reap_stale_generation_jobs", {
    p_stale_after_minutes: staleAfterMinutes,
  });
  if (error) {
    console.warn(`  [reap] ${error.message}`);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

async function resetStuckJob(metroKey: string): Promise<void> {
  const { data: job } = await admin
    .from("generation_jobs")
    .select("status, updated_at")
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", metroKey)
    .maybeSingle();

  if (job?.status !== "processing") return;

  const { data: edition } = await admin
    .from("editions")
    .select("id, status")
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", metroKey)
    .maybeSingle();

  if (edition?.status === "ready") return;

  await admin
    .from("generation_jobs")
    .update({
      status: "pending",
      last_error: "[audit: reset stuck processing job]",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", metroKey)
    .eq("status", "processing");

  console.log(`  [audit] reset stuck processing job for ${metroKey}`);
}

function triggerEditionWorker(spec: (typeof NATIONWIDE_AUDIT_CITIES)[0]): boolean {
  const result = invokeEdgeViaVault(
    "process-user-edition-job",
    {
      userId: USER_ID,
      editionDate: EDITION_DATE,
      metroKey: spec.expectedMetroKey,
      location: {
        city: spec.city,
        state: spec.state,
        region: spec.region,
        lat: spec.lat,
        lon: spec.lon,
      },
    },
    { timeoutMs: 900_000 }
  );
  if (!result.ok) {
    console.warn(`  [worker] vault invoke failed (${result.status})`);
    if (result.stderr) console.warn(result.stderr.slice(0, 300));
    return false;
  }
  console.log("  [worker] vault invoke queued");
  return true;
}

async function getAccessToken(): Promise<string> {
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
  const checks: Record<string, boolean | string> = {};
  const { error: nationalTableErr } = await admin
    .from("kindred_us_national_daily")
    .select("id, national_news, today_masterpiece, today_in_history")
    .limit(1);
  checks.kindred_us_national_daily = nationalTableErr ? nationalTableErr.message : true;

  const { error: fkErr } = await admin
    .from("editions")
    .select("us_national_daily_id, national_news")
    .limit(1);
  checks.editions_national_columns = fkErr ? fkErr.message : true;

  for (const rpc of ["claim_us_national_history_write", "claim_us_national_news_write"] as const) {
    const { error } = await admin.rpc(rpc, {
      p_edition_date: "2099-01-01",
      p_country_code: "US",
      ...(rpc.includes("history")
        ? { p_history: { headline: "probe", body: "probe" }, p_event_key: "probe" }
        : { p_national_news: { packageId: "probe", editionDate: "2099-01-01", stories: [] } }),
    });
    checks[rpc] = !error || !/does not exist/i.test(error.message ?? "");
  }

  return checks;
}

async function enqueueEdition(token: string, spec: (typeof NATIONWIDE_AUDIT_CITIES)[0]) {
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
      location: {
        city: spec.city,
        state: spec.state,
        region: spec.region,
        lat: spec.lat,
        lon: spec.lon,
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, enqueueMs: Date.now() - started };
}

async function pollEditionBuild(
  metroKey: string,
  nationalDailyExistedBefore: boolean,
  spec: (typeof NATIONWIDE_AUDIT_CITIES)[0]
): Promise<{
  outcome: "ready" | "failed" | "timeout";
  editionId: string | null;
  timing: CityTiming;
  error?: string;
}> {
  const pollStarted = Date.now();
  let workerStartMs: number | null = null;
  let firstPaintMs: number | null = null;
  let readyMs: number | null = null;

  let workerRetriggered = false;
  let lastReapMs = 0;

  while (Date.now() - pollStarted < MAX_WAIT_MS) {
    const { data: edition } = await admin
      .from("editions")
      .select("id, status, created_at")
      .eq("user_id", USER_ID)
      .eq("edition_date", EDITION_DATE)
      .eq("metro_key", metroKey)
      .maybeSingle();

    const { data: job } = await admin
      .from("generation_jobs")
      .select("status, last_error")
      .eq("user_id", USER_ID)
      .eq("edition_date", EDITION_DATE)
      .eq("metro_key", metroKey)
      .maybeSingle();

    let sectionTypes: string[] = [];
    if (edition?.id) {
      const { data: sections } = await admin
        .from("edition_sections")
        .select("section_type")
        .eq("edition_id", edition.id);
      sectionTypes = (sections ?? []).map((s) => s.section_type);
    }

    if (job?.status === "processing" && workerStartMs == null) {
      workerStartMs = Date.now() - pollStarted;
    }

    const elapsed = Date.now() - pollStarted;
    if (
      job?.status === "processing" &&
      !edition?.id &&
      elapsed > 120_000 &&
      elapsed - lastReapMs > 60_000
    ) {
      lastReapMs = elapsed;
      const reaped = await reapStaleGenerationJobs(2);
      if (reaped > 0) {
        console.log(`  [reap] recovered ${reaped} stale job(s)`);
      }
      if (!workerRetriggered) {
        await resetStuckJob(metroKey);
        workerRetriggered = triggerEditionWorker(spec);
      }
    }

    if (
      (job?.status === "pending" || job?.status === "failed") &&
      elapsed > 8_000 &&
      !workerRetriggered
    ) {
      workerRetriggered = triggerEditionWorker(spec);
    }

    const sectionTypesList = sectionTypes;
    const paintable =
      edition?.status === "processing" || edition?.status === "ready"
        ? sectionTypesList.includes("weather") ||
          sectionTypesList.includes("greeting") ||
          sectionTypesList.includes("today_in_history")
        : false;
    if (paintable && firstPaintMs == null) {
      firstPaintMs = Date.now() - pollStarted;
    }

    if (edition?.status === "ready" && edition.id) {
      readyMs = Date.now() - pollStarted;
      return {
        outcome: "ready",
        editionId: edition.id,
        timing: {
          buildStartMs: 0,
          enqueueMs: 0,
          workerStartMs,
          firstPaintMs,
          readyMs,
          totalMs: readyMs,
          nationalCacheLikely: nationalDailyExistedBefore,
        },
      };
    }

    if (job?.status === "failed" || edition?.status === "failed") {
      return {
        outcome: "failed",
        editionId: edition?.id ?? null,
        error: job?.last_error ?? "edition failed",
        timing: {
          buildStartMs: 0,
          enqueueMs: 0,
          workerStartMs,
          firstPaintMs,
          readyMs,
          totalMs: Date.now() - pollStarted,
          nationalCacheLikely: null,
        },
      };
    }

    await sleep(2500);
  }

  return {
    outcome: "timeout",
    editionId: null,
    error: `timeout after ${MAX_WAIT_MS}ms`,
    timing: {
      buildStartMs: 0,
      enqueueMs: 0,
      workerStartMs,
      firstPaintMs,
      readyMs,
      totalMs: Date.now() - pollStarted,
      nationalCacheLikely: null,
    },
  };
}

async function fetchNationalDailyExists(): Promise<boolean> {
  const { data } = await admin
    .from("kindred_us_national_daily")
    .select("id")
    .eq("edition_date", EDITION_DATE)
    .eq("country_code", "US")
    .maybeSingle();
  return Boolean(data?.id);
}

async function loadEditionSnapshot(spec: (typeof NATIONWIDE_AUDIT_CITIES)[0]) {
  const fullSelect =
    "id, status, metro_key, us_national_daily_id, national_news, morning_edition, lead_story, editorial_context, bandit, discovery";
  const legacySelect =
    "id, status, metro_key, morning_edition, lead_story, editorial_context, bandit, discovery";

  let edition: Record<string, unknown> | null = null;
  let usedLegacySelect = false;

  const full = await admin
    .from("editions")
    .select(fullSelect)
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", spec.expectedMetroKey)
    .maybeSingle();

  if (full.error && /us_national_daily_id|national_news/i.test(full.error.message ?? "")) {
    usedLegacySelect = true;
    const legacy = await admin
      .from("editions")
      .select(legacySelect)
      .eq("user_id", USER_ID)
      .eq("edition_date", EDITION_DATE)
      .eq("metro_key", spec.expectedMetroKey)
      .maybeSingle();
    if (legacy.error || !legacy.data?.id) {
      return {
        ok: false as const,
        error: legacy.error?.message ?? "edition missing",
      };
    }
    edition = legacy.data as Record<string, unknown>;
  } else if (full.error || !full.data?.id) {
    return { ok: false as const, error: full.error?.message ?? "edition missing" };
  } else {
    edition = full.data as Record<string, unknown>;
  }

  const { data: sections } = await admin
    .from("edition_sections")
    .select("section_type, headline, body, position")
    .eq("edition_id", edition.id)
    .order("position");

  const snapshot = buildCitySnapshot(
    spec,
    edition as Parameters<typeof buildCitySnapshot>[1],
    sections ?? []
  );
  const localText = JSON.stringify({
    sections: sections ?? [],
    lead: edition.lead_story,
    discovery: edition.discovery,
    bandit: edition.bandit,
  });

  const issues: AuditIssue[] = [];
  if (edition.status !== "ready") {
    issues.push({
      severity: "critical",
      category: "edition_status",
      message: `Status ${String(edition.status)}`,
    });
  }
  if (usedLegacySelect) {
    issues.push({
      severity: "high",
      category: "migration_pending",
      message: "National layer columns missing — apply migrations 0055/0056",
    });
  }
  if (!snapshot.national.masterpieceArtworkId) {
    issues.push({ severity: "critical", category: "missing_masterpiece", message: "No masterpiece artwork" });
  }
  if (!snapshot.national.historyHeadline) {
    issues.push({ severity: "critical", category: "missing_history", message: "No Today in History" });
  }
  if (!snapshot.national.nationalNewsPackageId) {
    issues.push({ severity: "high", category: "missing_national_news", message: "No National News package" });
  }
  if (snapshot.local.eventNames.length === 0) {
    issues.push({ severity: "high", category: "empty_events", message: "No local events" });
  }
  if (edition.metro_key !== spec.expectedMetroKey) {
    issues.push({
      severity: "critical",
      category: "metro_key_mismatch",
      message: `Expected ${spec.expectedMetroKey}, got ${String(edition.metro_key)}`,
    });
  }

  issues.push(...detectCityBleed(spec, localText));

  return {
    ok: true as const,
    edition: edition as Parameters<typeof buildCitySnapshot>[1] & { id: string },
    sections: sections ?? [],
    snapshot,
    issues,
  };
}

async function runLocalPipelineBuild(
  spec: (typeof NATIONWIDE_AUDIT_CITIES)[0],
  nationalDailyExistedBefore: boolean
): Promise<{
  outcome: "ready" | "failed" | "timeout";
  editionId: string | null;
  timing: CityTiming;
  error?: string;
}> {
  const buildStartMs = Date.now();
  let workerStartMs: number | null = null;
  let firstPaintMs: number | null = null;
  let readyMs: number | null = null;

  const child = spawn(
    "npx",
    [
      "deno",
      "run",
      "--allow-env",
      "--allow-net",
      "--allow-read",
      join(__dirname, "audit-build-city-edition.ts"),
    ],
    {
      cwd: join(__dirname, ".."),
      env: {
        ...process.env,
        USER_ID,
        EDITION_DATE,
        AUDIT_CITY: spec.city,
        AUDIT_STATE: spec.state,
        AUDIT_REGION: spec.region,
        AUDIT_LAT: String(spec.lat),
        AUDIT_LON: String(spec.lon),
        AUDIT_METRO_KEY: spec.expectedMetroKey,
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  workerStartMs = 0;
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const pollStarted = Date.now();
  const pollPromise = (async () => {
    while (Date.now() - pollStarted < MAX_WAIT_MS) {
      const { data: edition } = await admin
        .from("editions")
        .select("id, status")
        .eq("user_id", USER_ID)
        .eq("edition_date", EDITION_DATE)
        .eq("metro_key", spec.expectedMetroKey)
        .maybeSingle();

      let sectionTypes: string[] = [];
      if (edition?.id) {
        const { data: sections } = await admin
          .from("edition_sections")
          .select("section_type")
          .eq("edition_id", edition.id);
        sectionTypes = (sections ?? []).map((s) => s.section_type);
      }

      const paintable =
        edition?.status === "processing" || edition?.status === "ready"
          ? sectionTypes.includes("weather") ||
            sectionTypes.includes("greeting") ||
            sectionTypes.includes("today_in_history")
          : false;
      if (paintable && firstPaintMs == null) {
        firstPaintMs = Date.now() - buildStartMs;
      }
      if (edition?.status === "ready" && edition.id) {
        readyMs = Date.now() - buildStartMs;
        return edition.id as string;
      }
      await sleep(1500);
    }
    return null;
  })();

  const exitCode: number = await new Promise((resolve) => {
    child.on("close", (code) => resolve(code ?? 1));
  });

  const polledEditionId = await pollPromise;
  const totalMs = Date.now() - buildStartMs;

  let parsed: { ok?: boolean; editionId?: string; error?: string; durationMs?: number } | null =
    null;
  for (const line of stdout.trim().split("\n").reverse()) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      parsed = JSON.parse(trimmed) as typeof parsed;
      break;
    } catch {
      // keep scanning
    }
  }

  const editionId = polledEditionId ?? parsed?.editionId ?? null;
  if (editionId && readyMs == null) {
    readyMs = totalMs;
  }

  if (exitCode === 0 && editionId) {
    return {
      outcome: "ready",
      editionId,
      timing: {
        buildStartMs,
        enqueueMs: 0,
        workerStartMs,
        firstPaintMs,
        readyMs,
        totalMs,
        nationalCacheLikely: nationalDailyExistedBefore,
        pipelineMs: parsed?.durationMs ?? null,
      },
    };
  }

  return {
    outcome: exitCode === 0 && !editionId ? "timeout" : "failed",
    editionId,
    error:
      parsed?.error ??
      stderr.trim().slice(0, 400) ??
      stdout.trim().slice(0, 400) ??
      `local build exit ${exitCode}`,
    timing: {
      buildStartMs,
      enqueueMs: 0,
      workerStartMs,
      firstPaintMs,
      readyMs,
      totalMs,
      nationalCacheLikely: nationalDailyExistedBefore,
      pipelineMs: parsed?.durationMs ?? null,
    },
  };
}

async function runCityBuild(
  token: string,
  spec: (typeof NATIONWIDE_AUDIT_CITIES)[0],
  nationalDailyExistedBefore: boolean
) {
  await admin
    .from("editions")
    .delete()
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", spec.expectedMetroKey);
  await admin
    .from("generation_jobs")
    .delete()
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", spec.expectedMetroKey);

  await reapStaleGenerationJobs(1);

  const buildStartMs = Date.now();

  if (useLocalBuild) {
    console.log("  [build] local Deno pipeline (production buildEditionForUser)");
    const poll = await runLocalPipelineBuild(spec, nationalDailyExistedBefore);
    poll.timing.buildStartMs = buildStartMs;
    if (poll.outcome !== "ready" || !poll.editionId) {
      return {
        spec,
        passed: false,
        issues: [
          {
            severity: "critical" as const,
            category: "build_failed",
            message: poll.error ?? poll.outcome,
          },
        ],
        timing: poll.timing,
      };
    }

    const loaded = await loadEditionSnapshot(spec);
    if (!loaded.ok) {
      return {
        spec,
        passed: false,
        issues: [
          { severity: "critical" as const, category: "load_failed", message: loaded.error },
        ],
        timing: poll.timing,
      };
    }

    return {
      spec,
      passed: loaded.issues.filter((i) => i.severity === "critical").length === 0,
      snapshot: loaded.snapshot,
      issues: loaded.issues,
      timing: poll.timing,
    };
  }

  const enqueue = await enqueueEdition(token, spec);
  if (enqueue.status >= 400) {
    return {
      spec,
      passed: false,
      issues: [
        {
          severity: "critical" as const,
          category: "enqueue_failed",
          message: JSON.stringify(enqueue.body),
        },
      ],
      timing: {
        buildStartMs: 0,
        enqueueMs: enqueue.enqueueMs,
        workerStartMs: null,
        firstPaintMs: null,
        readyMs: null,
        totalMs: enqueue.enqueueMs,
        nationalCacheLikely: null,
      },
    };
  }

  const poll = await pollEditionBuild(spec.expectedMetroKey, nationalDailyExistedBefore, spec);
  const totalMs = Date.now() - buildStartMs;
  poll.timing.enqueueMs = enqueue.enqueueMs;
  poll.timing.totalMs = totalMs;
  poll.timing.buildStartMs = buildStartMs;

  if (poll.outcome !== "ready" || !poll.editionId) {
    return {
      spec,
      passed: false,
      issues: [
        {
          severity: "critical" as const,
          category: "build_failed",
          message: poll.error ?? poll.outcome,
        },
      ],
      timing: poll.timing,
    };
  }

  const loaded = await loadEditionSnapshot(spec);
  if (!loaded.ok) {
    return {
      spec,
      passed: false,
      issues: [
        { severity: "critical" as const, category: "load_failed", message: loaded.error },
      ],
      timing: poll.timing,
    };
  }

  return {
    spec,
    passed: loaded.issues.filter((i) => i.severity === "critical").length === 0,
    snapshot: loaded.snapshot,
    issues: loaded.issues,
    timing: poll.timing,
  };
}

function printSummaryTable(
  rows: Array<{
    label: string;
    passed: boolean;
    timing: CityTiming;
    issues: AuditIssue[];
  }>
) {
  console.log("\n| City | Pass | Total (ms) | First paint (ms) | Ready (ms) | National cache | Issues |");
  console.log("|------|------|------------|------------------|------------|----------------|--------|");
  for (const row of rows) {
    const t = row.timing;
    const issueSummary =
      row.issues.length === 0
        ? "—"
        : row.issues
            .slice(0, 2)
            .map((i) => i.message.slice(0, 40))
            .join("; ");
    console.log(
      `| ${row.label} | ${row.passed ? "✓" : "✗"} | ${t.totalMs} | ${t.firstPaintMs ?? "—"} | ${t.readyMs ?? "—"} | ${t.nationalCacheLikely == null ? "?" : t.nationalCacheLikely ? "hit" : "cold"} | ${issueSummary} |`
    );
  }
}

async function preflightBuildSecrets(mode: "local" | "edge"): Promise<string | null> {
  if (mode === "local") {
    const missing: string[] = [];
    if (!process.env.NEWS_API_KEY?.trim()) missing.push("NEWS_API_KEY");
    if (!process.env.ANTHROPIC_API_KEY?.trim()) missing.push("ANTHROPIC_API_KEY");
    if (!SERVICE_KEY?.trim()) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    if (missing.length) {
      return `Local pipeline requires ${missing.join(", ")} in .env.local (copy from Supabase Dashboard → Edge Function secrets).`;
    }
  }
  return null;
}

async function main() {
  console.log("Kindred Nationwide Editorial Audit");
  console.log(`Edition date: ${EDITION_DATE}`);
  console.log(
    `Build mode: ${skipBuilds ? "validate-only" : useLocalBuild ? "local-deno-pipeline" : "edge-async"}`
  );
  console.log(`Cities: ${NATIONWIDE_AUDIT_CITIES.map((c) => c.label).join(", ")}`);

  const migrationChecks = await checkMigrations();
  console.log("\nMigration checks:", migrationChecks);

  const cities = cityFilter
    ? NATIONWIDE_AUDIT_CITIES.filter(
        (c) => c.label.toLowerCase() === cityFilter.toLowerCase()
      )
    : NATIONWIDE_AUDIT_CITIES;

  if (cities.length === 0) {
    console.error(`Unknown city filter: ${cityFilter}`);
    process.exit(1);
  }

  let nationalDailyExisted = await fetchNationalDailyExists();
  const buildMode = skipBuilds ? "validate-only" : useLocalBuild ? "local-deno-pipeline" : "edge-async";
  if (!skipBuilds) {
    const preflightError = await preflightBuildSecrets(useLocalBuild ? "local" : "edge");
    if (preflightError && useLocalBuild) {
      console.error(`\nPreflight failed: ${preflightError}`);
      process.exitCode = 1;
      return;
    }
    if (preflightError) {
      console.warn(`\nPreflight note: ${preflightError}`);
    }
  }
  const token = skipBuilds ? null : await getAccessToken();

  const results: Array<{
    label: string;
    passed: boolean;
    timing: CityTiming;
    issues: AuditIssue[];
    snapshot?: ReturnType<typeof buildCitySnapshot>;
  }> = [];

  for (const spec of cities) {
    console.log(`\n=== ${spec.label} (${spec.expectedMetroKey}) ===`);
    let result;
    if (skipBuilds) {
      const loaded = await loadEditionSnapshot(spec);
      if (!loaded.ok) {
        result = {
          spec,
          passed: false,
          issues: [
            { severity: "critical" as const, category: "missing_edition", message: loaded.error },
          ],
          timing: {
            buildStartMs: 0,
            enqueueMs: 0,
            workerStartMs: null,
            firstPaintMs: null,
            readyMs: null,
            totalMs: 0,
            nationalCacheLikely: null,
          },
        };
      } else {
        result = {
          spec,
          passed: loaded.issues.filter((i) => i.severity === "critical").length === 0,
          snapshot: loaded.snapshot,
          issues: loaded.issues,
          timing: {
            buildStartMs: 0,
            enqueueMs: 0,
            workerStartMs: null,
            firstPaintMs: null,
            readyMs: null,
            totalMs: 0,
            nationalCacheLikely: nationalDailyExisted,
          },
        };
      }
    } else {
      result = await runCityBuild(token!, spec, nationalDailyExisted);
      nationalDailyExisted = await fetchNationalDailyExists();
    }

    results.push({
      label: spec.label,
      passed: result.passed,
      timing: result.timing,
      issues: result.issues,
      snapshot: result.snapshot,
    });

    console.log(
      `  ${result.passed ? "PASS" : "FAIL"} | total=${result.timing.totalMs}ms | firstPaint=${result.timing.firstPaintMs ?? "—"}ms | ready=${result.timing.readyMs ?? "—"}ms`
    );
    for (const issue of result.issues.slice(0, 5)) {
      console.log(`  [${issue.severity}] ${issue.category}: ${issue.message}`);
    }
  }

  const snapshots = results
    .map((r) => r.snapshot)
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const parityIssues = verifyNationalParity(snapshots);
  const distinctIssues = verifyLocalDistinct(snapshots);
  const crossCutting = [...parityIssues, ...distinctIssues];

  if (crossCutting.length) {
    console.log("\nCross-city validation issues:");
    for (const issue of crossCutting) {
      console.log(`  [${issue.severity}] ${issue.category}: ${issue.message}`);
    }
  }

  for (const row of results) {
    row.passed =
      row.passed &&
      crossCutting.filter((i) => i.severity === "critical").length === 0;
  }

  const perf = summarizePerformance(results);
  console.log("\nPerformance summary:");
  console.log(`  Fastest: ${perf.fastest ?? "—"}`);
  console.log(`  Slowest: ${perf.slowest ?? "—"}`);
  console.log(`  Average total: ${perf.averageTotalMs}ms`);
  console.log(`  Average first paint: ${perf.averageFirstPaintMs ?? "—"}ms`);
  if (perf.bottlenecks.length) {
    console.log("  Bottlenecks:");
    for (const b of perf.bottlenecks) console.log(`    - ${b}`);
  }
  if (perf.recommendations.length) {
    console.log("  Recommendations:");
    for (const r of perf.recommendations) console.log(`    - ${r}`);
  }

  printSummaryTable(results);

  const report = {
    generatedAt: new Date().toISOString(),
    editionDate: EDITION_DATE,
    migrationChecks,
    skipBuilds,
    useLocalBuild,
    buildMode: skipBuilds ? "validate-only" : useLocalBuild ? "local-deno-pipeline" : "edge-async",
    crossCutting,
    performance: perf,
    cities: results.map((r) => ({
      label: r.label,
      passed: r.passed,
      timing: r.timing,
      issues: r.issues,
      national: r.snapshot?.national ?? null,
    })),
    allPassed:
      results.every((r) => r.passed) &&
      crossCutting.filter((i) => i.severity === "critical").length === 0,
  };

  mkdirSync(join(__dirname, "../reports"), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = join(__dirname, `../reports/nationwide-editorial-audit-${stamp}.json`);
  const mdPath = join(__dirname, `../reports/NATIONWIDE_EDITORIAL_AUDIT.md`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(
    mdPath,
    `# Nationwide Editorial Audit\n\nGenerated: ${report.generatedAt}\nEdition date: ${EDITION_DATE}\n\n## Summary\n\n- All passed: **${report.allPassed ? "YES" : "NO"}**\n- Fastest: ${perf.fastest ?? "—"}\n- Slowest: ${perf.slowest ?? "—"}\n- Average generation: ${perf.averageTotalMs}ms\n\n## Cities\n\n| City | Pass | Total ms | First paint ms | Ready ms | Cache | Issues |\n|------|------|----------|----------------|----------|-------|--------|\n${results
      .map(
        (r) =>
          `| ${r.label} | ${r.passed ? "✓" : "✗"} | ${r.timing.totalMs} | ${r.timing.firstPaintMs ?? "—"} | ${r.timing.readyMs ?? "—"} | ${r.timing.nationalCacheLikely == null ? "?" : r.timing.nationalCacheLikely ? "hit" : "cold"} | ${r.issues.length} |`
      )
      .join("\n")}\n`
  );

  console.log(`\nReport: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);

  process.exit(report.allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
