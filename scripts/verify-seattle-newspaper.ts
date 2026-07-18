/**
 * Seattle gold-standard edition generation + verification snapshot.
 * Usage: npx --yes tsx scripts/verify-seattle-newspaper.ts
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseLocalEventsBody } from "../lib/edition/localEvents";
import { buildEditionHealthReport } from "../lib/dev/editionHealthReport";
import { buildEditionDiagnostics } from "../lib/dev/editionDiagnostics";
import { parseBanditPayload } from "../lib/edition/bandit";
import { metroKeyFromPlace } from "../lib/location/metroKey";
import type { EditionSection } from "../lib/edition/types";
import type { CachedEditionBundle } from "../lib/edition/editionCache";

const SUPABASE_URL = "https://zdqjeocdsbdzecawumdp.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";
const USER_ID = "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = process.env.AUDIT_EDITION_DATE ?? "2026-07-17";
const SEATTLE = {
  city: "Seattle",
  state: "WA",
  region: "Washington",
  lat: 47.6062,
  lon: -122.3321,
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

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
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr || !sessionData?.session?.access_token) {
    throw new Error(`verifyOtp failed: ${verifyErr?.message ?? "no session"}`);
  }
  return sessionData.session.access_token;
}

async function generateEdition(token: string): Promise<{ ms: number; ok: boolean; error?: string }> {
  const started = Date.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-edition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      editionDate: EDITION_DATE,
      devPreview: true,
      temperatureUnit: "fahrenheit",
      location: SEATTLE,
    }),
  });
  const ms = Date.now() - started;
  if (!res.ok) {
    return { ms, ok: false, error: await res.text() };
  }
  return { ms, ok: true };
}

type Finding = {
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  message: string;
  samples?: string[];
};

function analyzeCrossSection(
  events: ReturnType<typeof parseLocalEventsBody>["events"],
  discovery: Record<string, unknown> | null,
  bandit: Record<string, unknown> | null
): Finding[] {
  const findings: Finding[] = [];
  const surfaces = (discovery?.surfaces ?? {}) as Record<
    string,
    { items?: Array<{ name?: string; title?: string }> }
  >;
  const venueKeys = new Set<string>();

  const recordVenue = (name: string | undefined, section: string) => {
    const key = name?.trim().toLowerCase();
    if (!key) return;
    if (venueKeys.has(`${key}::${section}`)) return;
    venueKeys.add(`${key}::${section}`);
  };

  for (const e of events) {
    recordVenue(e.name, "local_events");
    recordVenue(e.venue, "local_events");
  }

  const activityItems = surfaces.activities?.items ?? [];
  const restaurantItems = surfaces.restaurants?.items ?? [];
  const allDiscovery = [...activityItems, ...restaurantItems];

  for (const item of allDiscovery) {
    recordVenue(item.name ?? item.title, "discovery");
  }

  const pick = bandit?.pick as { story?: { headline?: string; title?: string } } | undefined;
  const pickName = pick?.story?.headline ?? pick?.story?.title;
  if (pickName) recordVenue(pickName, "bandits_pick");

  const eventNames = new Set(events.map((e) => e.name.trim().toLowerCase()));
  if (pickName && eventNames.has(pickName.trim().toLowerCase())) {
    findings.push({
      severity: "high",
      category: "cross_section_dedup",
      message: "Bandit's Pick duplicates a Local Event headline",
      samples: [pickName],
    });
  }

  const withoutNotes = events.filter((e) => !e.banditNote?.trim());
  if (withoutNotes.length > 0) {
    findings.push({
      severity: "critical",
      category: "local_events_editorial",
      message: `${withoutNotes.length}/${events.length} Local Events missing Bandit notes`,
      samples: withoutNotes.slice(0, 5).map((e) => e.name),
    });
  }

  const withoutBody = events.filter((e) => !e.editorialBody?.length);
  if (withoutBody.length > 0) {
    findings.push({
      severity: "critical",
      category: "local_events_editorial",
      message: `${withoutBody.length}/${events.length} Local Events missing editorial article body`,
      samples: withoutBody.slice(0, 5).map((e) => e.name),
    });
  }

  const withoutImages = events.filter((e) => !e.imageUrl?.trim());
  if (withoutImages.length > 0) {
    findings.push({
      severity: "high",
      category: "local_events_images",
      message: `${withoutImages.length}/${events.length} Local Events missing authorized images`,
      samples: withoutImages.slice(0, 5).map((e) => e.name),
    });
  }

  const spamPatterns =
    /christian singles|speed dating|leadership skills|management skills|startup networking|1-day workshop/i;
  const spam = events.filter((e) => spamPatterns.test(e.name));
  if (spam.length > 0) {
    findings.push({
      severity: "high",
      category: "local_events_quality",
      message: "Weak or spam-like events surfaced",
      samples: spam.map((e) => e.name),
    });
  }

  return findings;
}

async function main() {
  console.log(`Generating Seattle edition for ${EDITION_DATE}...`);
  const token = await getAccessToken();
  const gen = await generateEdition(token);
  console.log("Generation:", gen.ok ? "OK" : "FAILED", `${gen.ms}ms`);
  if (!gen.ok) {
    console.error(gen.error);
    process.exit(1);
  }

  const { data: edition, error } = await admin
    .from("editions")
    .select(
      "id,status,edition_date,lead_story,bandit,discovery,morning_edition,knowledge,metro_key,created_at"
    )
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !edition) throw new Error(error?.message ?? "edition not found");

  const { data: sections } = await admin
    .from("edition_sections")
    .select("section_type,headline,body,source_note,position")
    .eq("edition_id", edition.id)
    .order("position");

  const sectionList = (sections ?? []) as EditionSection[];
  const localEventsSection = sectionList.find((s) => s.section_type === "local_events");
  const events = localEventsSection?.body
    ? parseLocalEventsBody(localEventsSection.body).events
    : [];

  const bundle: CachedEditionBundle = {
    editionId: edition.id,
    editionDate: EDITION_DATE,
    sections: sectionList,
    leadStory: edition.lead_story,
    bandit: edition.bandit,
    discovery: edition.discovery,
    morningEdition: edition.morning_edition,
    knowledge: edition.knowledge,
    historyAroundTown: null,
    generatedAt: edition.created_at,
  };

  const diagnostics = buildEditionDiagnostics({
    bundle,
    place: SEATTLE,
    metroKey: metroKeyFromPlace(SEATTLE),
  });
  const health = buildEditionHealthReport(bundle, SEATTLE, diagnostics);

  const crossFindings = analyzeCrossSection(
    events,
    edition.discovery as Record<string, unknown> | null,
    edition.bandit as Record<string, unknown> | null
  );

  const banditPayload = parseBanditPayload(edition.bandit);
  const surfaces = (edition.discovery as { surfaces?: Record<string, { items?: unknown[] }> })
    ?.surfaces;

  const snapshot = {
    analyzedAt: new Date().toISOString(),
    editionDate: EDITION_DATE,
    editionId: edition.id,
    status: edition.status,
    generationMs: gen.ms,
    metroKey: edition.metro_key,
    sectionTypes: sectionList.map((s) => s.section_type),
    localEvents: {
      count: events.length,
      withBanditNote: events.filter((e) => e.banditNote?.trim()).length,
      withEditorialBody: events.filter((e) => e.editorialBody?.length).length,
      withImage: events.filter((e) => e.imageUrl?.trim()).length,
      withSourceUrl: events.filter((e) => e.sourceUrl?.trim()).length,
      withCoords: events.filter((e) => e.lat != null && e.lon != null).length,
      sampleTitles: events.slice(0, 8).map((e) => e.name),
    },
    discovery: {
      activities: surfaces?.activities?.items?.length ?? 0,
      restaurants: surfaces?.restaurants?.items?.length ?? 0,
      coffee: surfaces?.coffee?.items?.length ?? 0,
    },
    banditsPick: banditPayload?.pick?.story?.headline ?? null,
    healthScore: health.overallScore,
    healthGrade: health.overallGrade,
    healthWarnings: health.warnings,
    findings: crossFindings,
  };

  mkdirSync(join(process.cwd(), "reports"), { recursive: true });
  const jsonPath = join(process.cwd(), "reports/seattle-newspaper-verification.json");
  writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2));

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const allFindings = [...crossFindings].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  const md = [
    "# Seattle Newspaper Verification Report",
    "",
    `**Edition date:** ${EDITION_DATE}`,
    `**Edition ID:** ${edition.id}`,
    `**Status:** ${edition.status}`,
    `**Generation time:** ${(gen.ms / 1000).toFixed(1)}s`,
    `**Health score:** ${health.overallScore} (${health.overallGrade})`,
    "",
    "## Section Snapshot",
    "",
    `- Local Events: ${snapshot.localEvents.count} (${snapshot.localEvents.withBanditNote} with Bandit notes, ${snapshot.localEvents.withEditorialBody} with article bodies, ${snapshot.localEvents.withImage} with images)`,
    `- Activities: ${snapshot.discovery.activities}`,
    `- Food & Drinks (restaurants desk): ${snapshot.discovery.restaurants}`,
    `- Bandit's Pick: ${snapshot.banditsPick ?? "missing"}`,
    `- Sections persisted: ${snapshot.sectionTypes.join(", ")}`,
    "",
    "## Remaining Issues (by severity)",
    "",
  ];

  if (allFindings.length === 0) {
    md.push("_No blocking issues detected in automated verification._");
  } else {
    for (const f of allFindings) {
      md.push(`### ${f.severity.toUpperCase()} — ${f.category}`);
      md.push(f.message);
      if (f.samples?.length) {
        md.push("");
        for (const s of f.samples) md.push(`- ${s}`);
      }
      md.push("");
    }
  }

  md.push("## Sample Local Events");
  md.push("");
  for (const title of snapshot.localEvents.sampleTitles) {
    md.push(`- ${title}`);
  }

  const mdPath = join(process.cwd(), "reports/SEATTLE_NEWSPAPER_VERIFICATION.md");
  writeFileSync(mdPath, md.join("\n"));

  console.log(JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
