/**
 * Regenerate Local News for today's Gilbert edition using deployed Story Editor.
 * Clears cached local-news bodies and reruns the local_news build stage only.
 */
import { createClient } from "@supabase/supabase-js";
import { invokeEdgeViaVault } from "./lib/vaultEdgeInvoke.mjs";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const METRO_KEY = "phoenix-az";
const EDITION_DATE = process.env.EDITION_DATE ?? "2026-07-19";
const LOCATION = {
  city: "Gilbert",
  state: "AZ",
  region: "AZ",
  lat: 33.3528,
  lon: -111.789,
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function inspectLead(lead) {
  if (!lead) return null;
  const desk = lead.desk ?? {};
  return {
    headline: lead.headline,
    role: lead.role,
    bodyCount: Array.isArray(lead.body) ? lead.body.length : 0,
    bodyPreview: (lead.body ?? []).slice(0, 2).map((p) => p.slice(0, 180)),
    deskPath: desk.path ?? null,
    storyType: desk.storyType ?? desk.story_type ?? null,
    fieldAnswerKeys: desk.fieldAnswers ? Object.keys(desk.fieldAnswers) : [],
    editedAt: desk.editedAt ?? null,
    limits: desk.fourQuestions?.limits ?? null,
  };
}

function inspectTopStories(ctx) {
  const items =
    ctx?.sections?.find((s) => s.sectionType === "top_stories")?.items ?? [];
  return items
    .filter((s) => /local/i.test(s.role ?? ""))
    .map((s) => ({
      title: s.title?.slice(0, 80),
      bodyCount: Array.isArray(s.body) ? s.body.length : 0,
      bodyPreview: (s.body ?? []).slice(0, 2).map((p) => p.slice(0, 140)),
      hasDesk: Boolean(s.desk),
      storyType: s.desk?.storyType ?? s.desk?.story_type ?? null,
      fieldAnswerKeys: s.desk?.fieldAnswers ? Object.keys(s.desk.fieldAnswers) : [],
      editedAt: s.desk?.editedAt ?? null,
    }));
}

const { data: editionRow, error: editionLookupError } = await admin
  .from("editions")
  .select("id")
  .eq("user_id", USER_ID)
  .eq("edition_date", EDITION_DATE)
  .eq("metro_key", METRO_KEY)
  .maybeSingle();

if (editionLookupError) throw editionLookupError;
if (!editionRow?.id) {
  throw new Error(`edition not found for ${EDITION_DATE} ${METRO_KEY}`);
}

const resolvedEditionId = editionRow.id;

async function snapshotForEdition(label) {
  const { data: edition, error: editionError } = await admin
    .from("editions")
    .select("id, edition_date, status, created_at, lead_story, editorial_context")
    .eq("id", resolvedEditionId)
    .maybeSingle();
  if (editionError) throw editionError;

  const { data: job, error: jobError } = await admin
    .from("generation_jobs")
    .select("status, build_stage, completed_stages, updated_at, stage_diagnostics")
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", METRO_KEY)
    .maybeSingle();
  if (jobError) throw jobError;

  const localNewsDiag = (job?.stage_diagnostics ?? [])
    .filter((d) => d?.stage === "local_news")
    .slice(-1)[0] ?? null;

  return {
    label,
    editionId: resolvedEditionId,
    editionCreatedAt: edition?.created_at ?? null,
    editorialGeneratedAt: edition?.editorial_context?.generatedAt ?? null,
    jobUpdatedAt: job?.updated_at ?? null,
    localNewsDiagnostic: localNewsDiag,
    lead: inspectLead(edition?.lead_story),
    topStoriesLocal: inspectTopStories(edition?.editorial_context),
  };
}

const before = await snapshotForEdition("before");
console.log("[before]", JSON.stringify(before, null, 2));

const { data: jobRow, error: jobLookupError } = await admin
  .from("generation_jobs")
  .select("id, completed_stages")
  .eq("user_id", USER_ID)
  .eq("edition_date", EDITION_DATE)
  .eq("metro_key", METRO_KEY)
  .maybeSingle();

if (jobLookupError) throw jobLookupError;
if (!jobRow?.id) throw new Error("generation job not found");

const keepStages = (jobRow.completed_stages ?? []).filter(
  (s) =>
    s !== "local_news" &&
    s !== "bandits_pick" &&
    s !== "finalize_edition"
);

await admin
  .from("generation_jobs")
  .update({
    status: "processing",
    build_stage: "local_news",
    completed_stages: keepStages,
    last_error: null,
    updated_at: new Date().toISOString(),
  })
  .eq("id", jobRow.id);

await admin
  .from("editions")
  .update({
    lead_story: null,
    status: "processing",
  })
  .eq("id", resolvedEditionId);

console.log("[reset] local_news stage queued; lead_story cleared");

const traceId = `regen-local-news-${EDITION_DATE}-${Date.now()}`;
const started = Date.now();
let done = false;

while (Date.now() - started < 900_000) {
  invokeEdgeViaVault(
    "process-user-edition-job",
    {
      userId: USER_ID,
      editionDate: EDITION_DATE,
      metroKey: METRO_KEY,
      editionTraceId: traceId,
      temperatureUnit: "fahrenheit",
      locationHint: LOCATION,
    },
    { timeoutMs: 900_000 }
  );

  await new Promise((r) => setTimeout(r, 20_000));

  const { data: job } = await admin
    .from("generation_jobs")
    .select("status, build_stage, completed_stages, last_error, stage_diagnostics")
    .eq("id", jobRow.id)
    .maybeSingle();

  const completed = job?.completed_stages ?? [];
  const localNewsDone = completed.includes("local_news");
  const finalized = completed.includes("finalize_edition");

  console.log("[poll]", {
    status: job?.status,
    build_stage: job?.build_stage,
    localNewsDone,
    finalized,
    err: job?.last_error?.slice?.(0, 120) ?? null,
  });

  if (job?.status === "failed") {
    throw new Error(job.last_error ?? "local_news regeneration failed");
  }

  if (localNewsDone && (job?.status === "ready" || finalized)) {
    done = true;
    break;
  }
}

if (!done) throw new Error("timed out waiting for local_news regeneration");

const after = await snapshotForEdition("after");
console.log("[after]", JSON.stringify(after, null, 2));

console.log(
  JSON.stringify(
    {
      ok: true,
      editionDate: EDITION_DATE,
      editionId: resolvedEditionId,
      regeneratedAt: after.jobUpdatedAt,
      editorialGeneratedAt: after.editorialGeneratedAt,
      storyEditorEvidence: {
        leadHasStoryType: Boolean(after.lead?.storyType),
        leadHasFieldAnswers: (after.lead?.fieldAnswerKeys?.length ?? 0) > 0,
        topStoriesWithDesk: after.topStoriesLocal.filter((s) => s.hasDesk).length,
        topStoriesWithStoryType: after.topStoriesLocal.filter((s) => s.storyType)
          .length,
        disclaimerFreeLead:
          !(after.lead?.bodyPreview ?? []).some((p) =>
            /reporting available|will not invent|read the original/i.test(p)
          ),
      },
      before,
      after,
    },
    null,
    2
  )
);
