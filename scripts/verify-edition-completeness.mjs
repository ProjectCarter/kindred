#!/usr/bin/env node
/**
 * Verify persisted edition against server + client completeness gates.
 * Usage: node scripts/verify-edition-completeness.mjs [edition_date] [user_id]
 */
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = process.argv[3] ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = process.argv[2] ?? "2026-07-16";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: edition, error } = await admin
  .from("editions")
  .select("id,status,edition_date,discovery,bandit,lead_story")
  .eq("user_id", USER_ID)
  .eq("edition_date", EDITION_DATE)
  .maybeSingle();

if (error || !edition) {
  console.error("edition lookup failed", error?.message ?? "no row");
  process.exit(1);
}

const { data: sections } = await admin
  .from("edition_sections")
  .select("section_type,headline,body")
  .eq("edition_id", edition.id)
  .order("position");

let surfaceItems = 0;
for (const surface of Object.values(edition.discovery?.surfaces ?? {})) {
  surfaceItems += surface?.items?.length ?? 0;
}

const payload = JSON.stringify({ edition, sections: sections ?? [] });
const checker = `
import { assessPersistedEditionBuild, hasBanditsPickFromPayload } from "./supabase/functions/_shared/editionCompleteness.ts";
import { isPersistedEditionComplete } from "./lib/perf/coldLaunchTrace.ts";
const { edition, sections } = JSON.parse(process.argv[1]);
const server = assessPersistedEditionBuild({
  sections,
  discovery: edition.discovery,
  hasBanditsPick: hasBanditsPickFromPayload(edition.bandit),
});
const client = isPersistedEditionComplete(edition, sections);
console.log(JSON.stringify({ server, client, status: edition.status, surfaceItems: ${surfaceItems} }));
`;

const run = spawnSync("npx", ["tsx", "-e", checker, payload], {
  cwd: ROOT,
  encoding: "utf8",
});

if (run.status !== 0) {
  console.error(run.stderr || run.stdout);
  process.exit(1);
}

const report = JSON.parse(run.stdout.trim());
console.log(JSON.stringify(report, null, 2));
process.exit(
  report.server.complete &&
    report.client.complete &&
    report.status === "ready"
    ? 0
    : 1
);
