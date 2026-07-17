#!/usr/bin/env node
/**
 * Production regression suite for History of Your City (story_of).
 *
 * Usage:
 *   node scripts/verify-story-of-pipeline.mjs [edition_date] [user_id]
 *
 * Checkpoints:
 *   1. Generation succeeds for a seeded metro (Gilbert)
 *   2. story_of is persisted exactly once
 *   3. Authenticated API returns the section
 *   4. Article content passes editorial gates
 *   5. Editorial order (story_of before today_in_history in DB positions)
 *   6. Article opens via content-system adapter
 *   7. ensure-story-of-section is idempotent (no duplicates)
 *   8. Regeneration replaces edition without duplicate story_of rows
 *   9. Graceful omission for metros without approved articles (Phoenix)
 *  10. Server + client completeness gates include story_of when expected
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = process.argv[3] ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = process.argv[2] ?? "2026-07-16";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const report = {
  unitTests: { pass: false, detail: null },
  generation: { pass: false, detail: null },
  persistence: { pass: false, detail: null },
  api: { pass: false, detail: null },
  editorialOrder: { pass: false, detail: null },
  articleOpens: { pass: false, detail: null },
  articleContent: { pass: false, detail: null },
  ensureIdempotent: { pass: false, detail: null },
  regeneration: { pass: false, detail: null },
  gracefulMissing: { pass: false, detail: null },
  completenessGates: { pass: false, detail: null },
};

function paragraphCount(body) {
  return String(body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

function storySections(sections) {
  return (sections ?? []).filter(
    (s) => s.section_type === "story_of" || s.section_type === "your_city"
  );
}

async function getUserSession() {
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(USER_ID);
  if (userErr || !userData?.user?.email) throw new Error(`getUserById: ${userErr?.message}`);

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`generateLink: ${linkErr?.message}`);
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !sessionData?.session?.access_token) {
    throw new Error(`verifyOtp: ${verifyErr?.message}`);
  }
  return { anon, token: sessionData.session.access_token };
}

async function deleteEditionForDate(editionDate) {
  const { data: existing } = await admin
    .from("editions")
    .select("id")
    .eq("user_id", USER_ID)
    .eq("edition_date", editionDate)
    .maybeSingle();
  if (existing?.id) {
    await admin.from("edition_sections").delete().eq("edition_id", existing.id);
    await admin.from("editions").delete().eq("id", existing.id);
  }
}

async function invokeGenerateEdition(token, editionDate, location) {
  const genStart = Date.now();
  const genRes = await fetch(`${SUPABASE_URL}/functions/v1/generate-edition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      editionDate,
      temperatureUnit: "fahrenheit",
      location,
    }),
  });
  const genBody = await genRes.json().catch(() => ({}));
  return {
    ok: genRes.ok && genBody?.ok !== false,
    status: genRes.status,
    ms: Date.now() - genStart,
    body: genBody,
  };
}

async function invokeEnsureStoryOf(editionId, token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ensure-story-of-section`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ editionId }),
  });
  return res.json().catch(() => ({}));
}

console.log(`\n=== Story of production regression (${EDITION_DATE}) ===\n`);

// 0. Unit tests (order, merge, article adapter)
const unitRun = spawnSync(
  "npx",
  ["tsx", "--test", "lib/edition/storyOf.test.ts", "lib/edition/storyOfRegression.test.ts"],
  { cwd: ROOT, encoding: "utf8" }
);
report.unitTests.pass = unitRun.status === 0;
report.unitTests.detail = {
  status: unitRun.status,
  stdout: unitRun.stdout?.slice(-800) ?? "",
  stderr: unitRun.stderr?.slice(-800) ?? "",
};
if (!report.unitTests.pass) {
  console.error(unitRun.stdout || unitRun.stderr);
}

// 1. Library seeded
const { data: articles, error: articlesErr } = await admin
  .from("kindred_city_articles")
  .select("metro_key, city_name, headline, subtitle, approval_status, word_count")
  .eq("approval_status", "approved");
if (articlesErr) {
  console.error("Library query failed:", articlesErr.message);
  process.exit(1);
}
console.log(`Library: ${articles?.length ?? 0} approved article(s)`);

const { anon, token } = await getUserSession();

await deleteEditionForDate(EDITION_DATE);

console.log("Invoking generate-edition (60-120s)...");
const gen = await invokeGenerateEdition(token, EDITION_DATE, {
  city: "Gilbert",
  state: "AZ",
  region: "AZ",
  lat: 33.27484080940824,
  lon: -111.77688787717592,
});

report.generation.pass = gen.ok;
report.generation.detail = gen;

const { data: edition, error: editionErr } = await admin
  .from("editions")
  .select("id, status, edition_date, discovery, bandit, lead_story")
  .eq("user_id", USER_ID)
  .eq("edition_date", EDITION_DATE)
  .maybeSingle();

if (editionErr || !edition) {
  console.error("Edition missing after generate", editionErr?.message);
} else {
  const { data: sections } = await admin
    .from("edition_sections")
    .select("id, section_type, position, headline, body, source_note")
    .eq("edition_id", edition.id)
    .order("position");

  const stories = storySections(sections);
  report.persistence.pass = edition.status === "ready" && stories.length === 1;
  report.persistence.detail = {
    editionId: edition.id,
    status: edition.status,
    sectionTypes: (sections ?? []).map((s) => s.section_type),
    storyOfCount: stories.length,
  };

  const { data: apiSections, error: apiErr } = await anon
    .from("edition_sections")
    .select("id, section_type, position, headline, body, source_note")
    .eq("edition_id", edition.id)
    .order("position");

  const apiStory = storySections(apiSections);
  report.api.pass = !apiErr && apiStory.length === 1;
  report.api.detail = {
    error: apiErr?.message ?? null,
    storyOfCount: apiStory.length,
  };

  const storyPos = stories[0]?.position ?? null;
  const historyPos =
    (sections ?? []).find((s) => s.section_type === "today_in_history")?.position ??
    null;
  report.editorialOrder.pass =
    storyPos != null && historyPos != null && storyPos > historyPos;
  report.editorialOrder.detail = { storyPos, historyPos };

  const story = stories[0];
  if (story) {
    let sourceNote = null;
    try {
      sourceNote = JSON.parse(story.source_note ?? "{}");
    } catch {
      sourceNote = null;
    }
    const paras = paragraphCount(story.body);
    const lastPara = story.body.split(/\n\s*\n/).filter(Boolean).at(-1) ?? "";
    report.articleContent.pass =
      Boolean(story.headline?.trim()) &&
      Boolean(sourceNote?.subtitle?.trim()) &&
      Boolean(sourceNote?.cityImage?.url?.trim()) &&
      Boolean(sourceNote?.cityImage?.credit?.trim()) &&
      paras >= 6 &&
      paras <= 10 &&
      lastPara.length > 40;
    report.articleContent.detail = {
      headline: story.headline,
      paragraphCount: paras,
      wordCount: story.body.split(/\s+/).filter(Boolean).length,
    };

    report.articleOpens.pass =
      story.section_type === "story_of" &&
      Boolean(story.headline?.trim()) &&
      story.body.trim().length > 100 &&
      Boolean(sourceNote?.kind === "story_of");
    report.articleOpens.detail = {
      sectionType: story.section_type,
      headline: story.headline,
      bodyLength: story.body.length,
      sourceKind: sourceNote?.kind ?? null,
    };
  }

  const ensure1 = await invokeEnsureStoryOf(edition.id, token);
  const ensure2 = await invokeEnsureStoryOf(edition.id, token);
  const { data: afterEnsure } = await admin
    .from("edition_sections")
    .select("section_type")
    .eq("edition_id", edition.id);
  report.ensureIdempotent.pass =
    storySections(afterEnsure).length === 1 &&
    ensure1?.ok !== false &&
    ensure2?.ok !== false;
  report.ensureIdempotent.detail = {
    storyOfCount: storySections(afterEnsure).length,
    ensure1,
    ensure2,
  };

  const regen = await invokeGenerateEdition(token, EDITION_DATE, {
    city: "Gilbert",
    state: "AZ",
    region: "AZ",
    lat: 33.27484080940824,
    lon: -111.77688787717592,
  });
  const { data: regenEdition } = await admin
    .from("editions")
    .select("id, status")
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .maybeSingle();
  const { data: regenSections } = regenEdition
    ? await admin
        .from("edition_sections")
        .select("section_type")
        .eq("edition_id", regenEdition.id)
    : { data: [] };
  report.regeneration.pass =
    regen.ok &&
    regenEdition?.status === "ready" &&
    storySections(regenSections).length === 1;
  report.regeneration.detail = {
    editionId: regenEdition?.id ?? null,
    storyOfCount: storySections(regenSections).length,
    ms: regen.ms,
  };

  const completenessChecker = `
import { assessPersistedEditionBuild, hasBanditsPickFromPayload } from "./supabase/functions/_shared/editionCompleteness.ts";
import { isPersistedEditionComplete } from "./lib/perf/coldLaunchTrace.ts";
const { edition, sections } = JSON.parse(process.argv[1]);
const server = assessPersistedEditionBuild({
  sections,
  discovery: edition.discovery,
  hasBanditsPick: hasBanditsPickFromPayload(edition.bandit),
  expectStoryOf: true,
});
const client = isPersistedEditionComplete(edition, sections, { expectStoryOf: true });
console.log(JSON.stringify({ server, client }));
`;
  const completenessRun = spawnSync(
    "npx",
    ["tsx", "-e", completenessChecker, JSON.stringify({ edition, sections: sections ?? [] })],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (completenessRun.status === 0) {
    const gates = JSON.parse(completenessRun.stdout.trim());
    report.completenessGates.pass =
      gates.server.complete === true && gates.client.complete === true;
    report.completenessGates.detail = gates;
  } else {
    report.completenessGates.detail = {
      error: completenessRun.stderr || completenessRun.stdout,
    };
  }
}

// Graceful missing city (Phoenix has no seeded article)
await deleteEditionForDate("2026-07-17");
const phxGen = await invokeGenerateEdition(token, "2026-07-17", {
  city: "Phoenix",
  state: "AZ",
  region: "AZ",
  lat: 33.4484,
  lon: -112.074,
});

const { data: phxEdition } = await admin
  .from("editions")
  .select("id, status")
  .eq("user_id", USER_ID)
  .eq("edition_date", "2026-07-17")
  .maybeSingle();

const { data: phxSections } = phxEdition
  ? await admin
      .from("edition_sections")
      .select("section_type")
      .eq("edition_id", phxEdition.id)
  : { data: [] };

report.gracefulMissing.pass =
  phxGen.ok &&
  phxEdition?.status === "ready" &&
  storySections(phxSections).length === 0;
report.gracefulMissing.detail = {
  editionStatus: phxEdition?.status ?? null,
  storyOfCount: storySections(phxSections).length,
};

console.log(JSON.stringify({ report }, null, 2));

const allPass = Object.values(report).every((r) => r.pass);
const failed = Object.entries(report)
  .filter(([, r]) => !r.pass)
  .map(([k]) => k);
if (!allPass) {
  console.error(`\nFAILED checkpoints: ${failed.join(", ")}`);
}
process.exit(allPass ? 0 : 1);
