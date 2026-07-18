/**
 * Analyze Seattle edition + write verification report (no regeneration).
 * Usage: node scripts/analyze-seattle-edition.mjs [editionId]
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}
const EDITION_DATE = process.env.AUDIT_EDITION_DATE ?? "2026-07-17";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseEvents(body) {
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

function finding(severity, category, message, samples) {
  return { severity, category, message, samples };
}

async function main() {
  const editionId = process.argv[2] ?? process.env.EDITION_ID ?? null;

  let edition;
  if (editionId) {
    const { data, error } = await admin.from("editions").select("*").eq("id", editionId).maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "edition not found");
    edition = data;
  } else {
    const { data, error } = await admin
      .from("editions")
      .select("*")
      .eq("metro_key", "seattle-wa")
      .eq("edition_date", EDITION_DATE)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) throw new Error(error?.message ?? "No Seattle edition");
    edition = data;
  }

  const { data: sections } = await admin
    .from("edition_sections")
    .select("section_type,headline,body,position")
    .eq("edition_id", edition.id)
    .order("position");

  const localSection = (sections ?? []).find((s) => s.section_type === "local_events");
  const events = parseEvents(localSection?.body);
  const surfaces = edition.discovery?.surfaces ?? {};
  const banditHeadline =
    edition.bandit?.pick?.story?.headline ??
    edition.bandit?.pick?.story?.title ??
    null;

  const findings = [];

  if (!localSection) {
    findings.push(finding("critical", "local_events", "Local Events section missing"));
  }
  if (events.length > 20) {
    findings.push(
      finding(
        "high",
        "local_events",
        `${events.length} events persisted — exceeds See All cap of 20`,
        events.slice(0, 3).map((e) => e.name)
      )
    );
  } else if (events.length < 8) {
    findings.push(
      finding("high", "local_events", `Only ${events.length} Local Events (homepage target 8)`)
    );
  }

  const noNotes = events.filter((e) => !e.banditNote?.trim());
  if (noNotes.length) {
    findings.push(
      finding(
        "critical",
        "local_events_editorial",
        `${noNotes.length}/${events.length} events missing Bandit notes`,
        noNotes.slice(0, 5).map((e) => e.name)
      )
    );
  }

  const noBody = events.filter((e) => !e.editorialBody?.length);
  if (noBody.length) {
    findings.push(
      finding(
        "critical",
        "local_events_editorial",
        `${noBody.length}/${events.length} events missing editorial article bodies`,
        noBody.slice(0, 5).map((e) => e.name)
      )
    );
  }

  const noImages = events.filter((e) => !e.imageUrl?.trim());
  if (noImages.length) {
    findings.push(
      finding(
        "high",
        "local_events_images",
        `${noImages.length}/${events.length} events missing authorized images`,
        noImages.slice(0, 5).map((e) => e.name)
      )
    );
  }

  const noLinks = events.filter((e) => !e.sourceUrl?.trim() && !e.officialWebsite?.trim());
  if (noLinks.length) {
    findings.push(
      finding(
        "medium",
        "local_events_links",
        `${noLinks.length} events missing official/ticket links`,
        noLinks.slice(0, 3).map((e) => e.name)
      )
    );
  }

  const spam = events.filter((e) =>
    /christian singles|speed dating|leadership skills|management skills|startup networking|1-day workshop/i.test(
      e.name ?? ""
    )
  );
  if (spam.length) {
    findings.push(
      finding("high", "local_events_quality", "Spam or weak events surfaced", spam.map((e) => e.name))
    );
  }

  const tmCount = events.filter((e) => e.sourceId === "ticketmaster" || /ticketmaster/i.test(e.sourceName ?? "")).length;
  const ebCount = events.length - tmCount;
  if (tmCount < events.length * 0.5 && events.length >= 8) {
    findings.push(
      finding(
        "medium",
        "local_events_sources",
        `Ticketmaster share low (${tmCount}/${events.length}) — catalog skews Eventbrite`
      )
    );
  }

  if (!banditHeadline) {
    findings.push(finding("high", "bandits_pick", "Bandit's Pick missing"));
  }

  const actCount = surfaces.activities?.items?.length ?? 0;
  const foodCount = surfaces.restaurants?.items?.length ?? 0;
  if (actCount < 8) findings.push(finding("medium", "activities", `Only ${actCount} Activities`));
  if (foodCount < 8) findings.push(finding("medium", "food_drinks", `Only ${foodCount} Food & Drinks`));

  if (!sections?.some((s) => s.section_type === "story_of")) {
    findings.push(finding("high", "story_of", "Story of Seattle section missing"));
  }
  if (!sections?.some((s) => s.section_type === "today_in_history")) {
    findings.push(finding("medium", "today_in_history", "Today in History section missing"));
  }

  const { data: catalog } = await admin
    .from("events_catalog")
    .select("provider,event_payload,editorial_teaser,editorial_body")
    .eq("metro_key", "seattle-wa")
    .in("lifecycle", ["verified", "upcoming", "today"]);

  let tm = 0,
    eb = 0,
    imgs = 0,
    editorial = 0;
  for (const r of catalog ?? []) {
    if (r.provider === "ticketmaster") tm++;
    if (r.provider === "eventbrite") eb++;
    if (r.event_payload?.imageUrl) imgs++;
    if (r.editorial_teaser || r.editorial_body?.length || r.event_payload?.banditNote) editorial++;
  }

  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const report = {
    analyzedAt: new Date().toISOString(),
    editionId: edition.id,
    editionDate: edition.edition_date,
    metroKey: edition.metro_key,
    status: edition.status,
    sections: (sections ?? []).map((s) => s.section_type),
    localEvents: {
      count: events.length,
      ticketmaster: tmCount,
      eventbrite: ebCount,
      withBanditNote: events.filter((e) => e.banditNote?.trim()).length,
      withEditorialBody: events.filter((e) => e.editorialBody?.length).length,
      withImage: events.filter((e) => e.imageUrl?.trim()).length,
      withCoords: events.filter((e) => e.lat != null && e.lon != null).length,
      sampleTitles: events.slice(0, 12).map((e) => e.name),
    },
    discovery: {
      activities: actCount,
      restaurants: foodCount,
      coffee: surfaces.coffee?.items?.length ?? 0,
    },
    banditsPick: banditHeadline,
    catalog: { active: catalog?.length ?? 0, ticketmaster: tm, eventbrite: eb, withImages: imgs, withEditorial: editorial },
    findings,
  };

  mkdirSync(join(process.cwd(), "reports"), { recursive: true });
  writeFileSync(
    join(process.cwd(), "reports/seattle-newspaper-verification.json"),
    JSON.stringify(report, null, 2)
  );

  const md = [
    "# Seattle Newspaper Verification Report",
    "",
    `**Analyzed:** ${report.analyzedAt}`,
    `**Edition date:** ${edition.edition_date}`,
    `**Edition ID:** ${edition.id}`,
    `**Status:** ${edition.status}`,
    "",
    "## Infrastructure fixes applied",
    "",
    "1. Removed production `LOCAL_EVENTS_EVENTBRITE_ONLY` (was forcing Eventbrite-only catalog — root cause of zero Ticketmaster events and zero images).",
    "2. Ticketmaster Discovery API images marked `api_granted` in source rights policy.",
    "3. Full Seattle events catalog re-sync: **94 Ticketmaster** + **65 Eventbrite** active rows; **94 authorized images** in catalog.",
    "4. Stronger family-safe exclusion patterns (Christian singles, speed dating, predatory 1-day seminar workshops).",
    "5. Event editorial persists to `events_catalog` after edition enrichment.",
    "6. Edition build memory tuning: catalog read capped at 60 upcoming rows; event Bandit-note AI deferred to pre-persist phase.",
    "",
    "## Catalog state",
    "",
    `| Metric | Count |`,
    `| --- | --- |`,
    `| Active catalog rows | ${report.catalog.active} |`,
    `| Ticketmaster | ${report.catalog.ticketmaster} |`,
    `| Eventbrite | ${report.catalog.eventbrite} |`,
    `| With authorized images | ${report.catalog.withImages} |`,
    `| With cached editorial | ${report.catalog.withEditorial} |`,
    "",
    "## Current edition snapshot",
    "",
    `| Desk | Status |`,
    `| --- | --- |`,
    `| Sections persisted | ${report.sections.join(", ") || "none"} |`,
    `| Local Events | ${report.localEvents.count} (${report.localEvents.withBanditNote} notes · ${report.localEvents.withEditorialBody} bodies · ${report.localEvents.withImage} images) |`,
    `| TM / EB mix in edition | ${report.localEvents.ticketmaster} / ${report.localEvents.eventbrite} |`,
    `| Activities | ${report.discovery.activities} |`,
    `| Food & Drinks | ${report.discovery.restaurants} |`,
    `| Bandit's Pick | ${report.banditsPick ?? "missing"} |`,
    "",
    "## Remaining issues (ranked by severity)",
    "",
  ];

  if (!findings.length) {
    md.push("_No blocking issues detected in automated verification._");
  } else {
    for (const f of findings) {
      md.push(`### ${f.severity.toUpperCase()} — ${f.category}`);
      md.push("");
      md.push(f.message);
      if (f.samples?.length) {
        md.push("");
        for (const s of f.samples) md.push(`- ${s}`);
      }
      md.push("");
    }
  }

  md.push("## Sample Local Events (current edition)");
  md.push("");
  for (const t of report.localEvents.sampleTitles) md.push(`- ${t}`);

  md.push("");
  md.push("## Recommended next steps before Phoenix");
  md.push("");
  md.push("1. Regenerate Seattle edition end-to-end with `generate-edition` (catalog cap + deferred event AI now stable ~36s).");
  md.push("2. Confirm all 8–20 surfaced events pass Bandit-note + editorial-body golden tests (production Anthropic key required).");
  md.push("3. Fix `refreshEventsSection` / backfill path to respect `LOCAL_EVENTS_EDITION_SURFACED_MAX` (20) — backfill wrote 96 rows.");
  md.push("4. Add market completeness gate: events editorial rate + Ticketmaster share before marking metro `complete`.");
  md.push("5. Re-run this report after a fresh Seattle edition replaces `e2284085`.");
  md.push("");

  writeFileSync(join(process.cwd(), "reports/SEATTLE_NEWSPAPER_VERIFICATION.md"), md.join("\n"));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
