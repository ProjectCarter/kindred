/**
 * Global editorial audit — generate editions via production pipeline (devPreview)
 * and evaluate as editor-in-chief. Does not modify production logic.
 *
 * Usage: npx --yes tsx scripts/audit-global-editions.ts
 * Output: reports/global-edition-audit.json + reports/GLOBAL_EDITION_AUDIT.md
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { KindredPlace } from "../lib/location/types";
import { parseLocalEventsBody } from "../lib/edition/localEvents";
import {
  selectEditorialHomepageLocalEvents,
  classifyLocalEventDiversityCategory,
} from "../lib/edition/localEventsHomepage";
import { resolveEventCategoryIcon } from "../lib/edition/categoryIcon";
import { resolveSportsMarketId } from "../lib/edition/hometownTeams";
import { metroKeyFromPlace } from "../lib/location/metroKey";
import { isGenericEventTitle } from "../lib/edition/venueQuality";
import { buildEditionHealthReport } from "../lib/dev/editionHealthReport";
import { buildEditionDiagnostics } from "../lib/dev/editionDiagnostics";
import type { EditionSection } from "../lib/edition/types";
import type { CachedEditionBundle } from "../lib/edition/editionCache";
import { parseBanditPayload } from "../lib/edition/bandit";
import { parseEditionIntelligence } from "../lib/edition/surfaceIntelligence";
import type { LeadStory } from "../lib/edition/LeadStory";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = process.env.AUDIT_USER_ID ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = process.env.AUDIT_EDITION_DATE ?? "2026-07-17";
const REFERENCE = new Date(`${EDITION_DATE}T12:00:00-07:00`);

/** 28 cities — US metros + international QA set. */
const AUDIT_CITIES: KindredPlace[] = [
  { city: "Gilbert", state: "AZ", region: "Arizona", lat: 33.2748, lon: -111.7769 },
  { city: "Phoenix", state: "AZ", region: "Arizona", lat: 33.4484, lon: -112.074 },
  { city: "Seattle", state: "WA", region: "Washington", lat: 47.6062, lon: -122.3321 },
  { city: "Denver", state: "CO", region: "Colorado", lat: 39.7392, lon: -104.9903 },
  { city: "Chicago", state: "IL", region: "Illinois", lat: 41.8781, lon: -87.6298 },
  { city: "New York", state: "NY", region: "New York", lat: 40.7128, lon: -74.006 },
  { city: "Los Angeles", state: "CA", region: "California", lat: 34.0522, lon: -118.2437 },
  { city: "San Francisco", state: "CA", region: "California", lat: 37.7749, lon: -122.4194 },
  { city: "Miami", state: "FL", region: "Florida", lat: 25.7617, lon: -80.1918 },
  { city: "Austin", state: "TX", region: "Texas", lat: 30.2672, lon: -97.7431 },
  { city: "Boston", state: "MA", region: "Massachusetts", lat: 42.3601, lon: -71.0589 },
  { city: "Portland", state: "OR", region: "Oregon", lat: 45.5152, lon: -122.6784 },
  { city: "San Diego", state: "CA", region: "California", lat: 32.7157, lon: -117.1611 },
  { city: "London", state: null, region: "England", lat: 51.5074, lon: -0.1278 },
  { city: "Paris", state: null, region: "France", lat: 48.8566, lon: 2.3522 },
  { city: "Rome", state: null, region: "Italy", lat: 41.9028, lon: 12.4964 },
  { city: "Tokyo", state: null, region: "Japan", lat: 35.6762, lon: 139.6503 },
  { city: "Sydney", state: null, region: "Australia", lat: -33.8688, lon: 151.2093 },
  { city: "Toronto", state: null, region: "Ontario", lat: 43.6532, lon: -79.3832 },
  { city: "Berlin", state: null, region: "Germany", lat: 52.52, lon: 13.405 },
  { city: "Amsterdam", state: null, region: "Netherlands", lat: 52.3676, lon: 4.9041 },
  { city: "Barcelona", state: null, region: "Spain", lat: 41.3874, lon: 2.1686 },
  { city: "Dublin", state: null, region: "Ireland", lat: 53.3498, lon: -6.2603 },
  { city: "Vancouver", state: null, region: "British Columbia", lat: 49.2827, lon: -123.1207 },
  { city: "Montreal", state: null, region: "Quebec", lat: 45.5017, lon: -73.5673 },
  { city: "Singapore", state: null, region: "Singapore", lat: 1.3521, lon: 103.8198 },
  { city: "Hong Kong", state: null, region: "Hong Kong", lat: 22.3193, lon: 114.1694 },
  { city: "Mexico City", state: null, region: "Mexico", lat: 19.4326, lon: -99.1332 },
  { city: "São Paulo", state: null, region: "Brazil", lat: -23.5505, lon: -46.6333 },
];

type FindingSeverity = "critical" | "high" | "medium" | "low";

type CityFinding = {
  severity: FindingSeverity;
  category: string;
  message: string;
  samples?: string[];
};

type CityAuditReport = {
  city: string;
  place: KindredPlace;
  generationMs: number | null;
  healthScore: number;
  eventCount: number;
  homepageCount: number;
  findings: CityFinding[];
};

type AggregatedIssue = {
  severity: FindingSeverity;
  category: string;
  message: string;
  cityCount: number;
  cities: string[];
  samples: string[];
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

async function generateEdition(
  token: string,
  place: KindredPlace
): Promise<{ ms: number; ok: boolean; error?: string }> {
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
      location: {
        city: place.city,
        state: place.state,
        region: place.region,
        lat: place.lat,
        lon: place.lon,
      },
    }),
  });
  const ms = Date.now() - started;
  if (!res.ok) {
    return { ms, ok: false, error: await res.text() };
  }
  return { ms, ok: true };
}

async function fetchEditionRow() {
  const { data, error } = await admin
    .from("editions")
    .select(
      "id,status,edition_date,lead_story,bandit,discovery,morning_edition,history_around_town,generated_at"
    )
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchSections(editionId: string): Promise<EditionSection[]> {
  const { data, error } = await admin
    .from("edition_sections")
    .select("section_type,headline,body,source_note,position")
    .eq("edition_id", editionId)
    .order("position");
  if (error) throw error;
  return (data ?? []) as EditionSection[];
}

function eventDedupeKey(e: { name: string; date: string; venue: string }): string {
  return `${e.name}|${e.date}|${e.venue}`.toLowerCase();
}

function auditCityEdition(
  place: KindredPlace,
  sections: EditionSection[],
  row: NonNullable<Awaited<ReturnType<typeof fetchEditionRow>>>,
  generationMs: number | null
): CityAuditReport {
  const findings: CityFinding[] = [];
  const sportsMarketId = resolveSportsMarketId({
    city: place.city,
    state: place.state,
    region: place.region,
    metroKey: metroKeyFromPlace(place),
  });

  const eventsSection = sections.find((s) => s.section_type === "local_events");
  const events = eventsSection?.body
    ? parseLocalEventsBody(eventsSection.body) ?? []
    : [];

  const { homepage } = selectEditorialHomepageLocalEvents(events, {
    maxTotal: 8,
    reference: REFERENCE,
    sportsMarketId,
  });

  const bundle: CachedEditionBundle = {
    userId: USER_ID,
    editionId: row.id,
    editionDate: EDITION_DATE,
    metroKey: place ? `${place.city}-${place.state}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "unknown",
    cachedAt: Date.now(),
    sections,
    leadStory: (row.lead_story as LeadStory | null) ?? null,
    topStories: [],
    bandit: parseBanditPayload(row.bandit),
    intelligence: parseEditionIntelligence({
      bandit: row.bandit,
      discovery: row.discovery,
      morning_edition: row.morning_edition,
      history_around_town: row.history_around_town,
      leadStory: (row.lead_story as LeadStory | null) ?? null,
    }),
  };

  const diagnostics = buildEditionDiagnostics({
    place,
    editionDate: EDITION_DATE,
    sections,
    discovery: row.discovery,
    generationTimeMs: generationMs,
    cacheStatus: "network",
  });

  const health = buildEditionHealthReport({ bundle, diagnostics, place });

  if (row.status !== "ready") {
    findings.push({
      severity: "critical",
      category: "edition_status",
      message: `Edition status is ${row.status}, not ready`,
    });
  }

  for (const warning of health.warnings.filter((w) => w.severity === "critical")) {
    findings.push({
      severity: "critical",
      category: "health",
      message: warning.message,
    });
  }

  if (events.length === 0) {
    findings.push({
      severity: "critical",
      category: "empty_events",
      message: "Local Events section is empty",
    });
  } else if (events.length < 8) {
    findings.push({
      severity: "high",
      category: "thin_events",
      message: `Only ${events.length} events in edition pool`,
    });
  }

  // Duplicate events in pool
  const seen = new Map<string, number>();
  for (const e of events) {
    const key = eventDedupeKey(e);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const dupes = [...seen.entries()].filter(([, c]) => c > 1);
  if (dupes.length) {
    findings.push({
      severity: "high",
      category: "duplicate_events",
      message: `${dupes.length} duplicate event listing(s) in pool`,
      samples: dupes.slice(0, 3).map(([k]) => k.split("|")[0]),
    });
  }

  // Homepage venue repetition
  const venueCounts = new Map<string, number>();
  for (const e of homepage) {
    const v = e.venue.trim().toLowerCase();
    venueCounts.set(v, (venueCounts.get(v) ?? 0) + 1);
  }
  const repeatVenues = [...venueCounts.entries()].filter(([, c]) => c > 1);
  if (repeatVenues.length) {
    findings.push({
      severity: "high",
      category: "repetitive_venues",
      message: `Homepage repeats venue: ${repeatVenues.map(([v, c]) => `${v} (${c}x)`).join(", ")}`,
    });
  }

  // Category repetition on homepage
  const catCounts = new Map<string, number>();
  for (const e of homepage) {
    const cat = classifyLocalEventDiversityCategory(e);
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  const crowdedCats = [...catCounts.entries()].filter(([, c]) => c >= 4);
  if (crowdedCats.length) {
    findings.push({
      severity: "medium",
      category: "repetitive_categories",
      message: `Homepage category crowding: ${crowdedCats.map(([c, n]) => `${c} (${n})`).join(", ")}`,
    });
  }

  // Geographic spread
  const cities = homepage.map((e) => e.city.trim().toLowerCase()).filter(Boolean);
  const uniqueCities = new Set(cities);
  if (homepage.length >= 6 && uniqueCities.size <= 2) {
    findings.push({
      severity: "medium",
      category: "poor_geographic_spread",
      message: `Homepage spans only ${uniqueCities.size} cities: ${[...uniqueCities].join(", ")}`,
    });
  }

  // Generic titles
  const weakTitles = events.filter((e) => isGenericEventTitle(e.name)).map((e) => e.name);
  if (weakTitles.length) {
    findings.push({
      severity: "medium",
      category: "weak_titles",
      message: `${weakTitles.length} generic event title(s)`,
      samples: weakTitles.slice(0, 4),
    });
  }

  // Emoji mismatches (heuristic)
  const emojiIssues: string[] = [];
  for (const e of homepage.slice(0, 8)) {
    const resolved = resolveEventCategoryIcon(
      { name: e.name, venue: e.venue, category: e.category },
      { sportsMarketId }
    );
    const frozen = e.categoryIcon;
    if (frozen && frozen !== resolved) {
      emojiIssues.push(`${e.name}: frozen ${frozen} vs resolved ${resolved}`);
    }
    if (resolved === "🤝" && !/\b(networking|mixer|meet-?and-?greet|outreach|collaboration)\b/i.test(`${e.name} ${e.venue}`)) {
      emojiIssues.push(`${e.name}: generic 🤝 without networking signal`);
    }
    if (resolved === "🎉" && e.category === "music") {
      emojiIssues.push(`${e.name}: music event with celebration fallback 🎉`);
    }
  }
  if (emojiIssues.length) {
    findings.push({
      severity: "medium",
      category: "incorrect_emojis",
      message: `${emojiIssues.length} emoji concern(s) on homepage`,
      samples: emojiIssues.slice(0, 4),
    });
  }

  // Missing maps / images
  const missingMaps = events.filter((e) => e.lat == null || e.lon == null).length;
  if (missingMaps > events.length * 0.35 && events.length > 0) {
    findings.push({
      severity: "medium",
      category: "missing_maps",
      message: `${missingMaps}/${events.length} events missing coordinates`,
    });
  }
  const missingImages = events.filter((e) => !e.imageUrl?.trim()).length;
  if (missingImages > events.length * 0.5 && events.length > 0) {
    findings.push({
      severity: "low",
      category: "missing_images",
      message: `${missingImages}/${events.length} events missing images`,
    });
  }

  // Hometown sports
  if (sportsMarketId && health.warnings.some((w) => w.id === "events_no_hometown_sports")) {
    findings.push({
      severity: "high",
      category: "missing_hometown_sports",
      message: `Sports market ${sportsMarketId} has no hometown team events surfaced`,
    });
  }

  // Empty / weak sections from health
  for (const warning of health.warnings.filter((w) => w.severity === "warning")) {
    if (
      warning.message.includes("empty") ||
      warning.message.includes("missing") ||
      warning.message.includes("below target")
    ) {
      findings.push({
        severity: warning.message.includes("empty") ? "high" : "medium",
        category: "weak_sections",
        message: warning.message,
      });
    }
  }

  // Ranking: top pool event missing from homepage
  const sortedPool = [...events].sort(
    (a, b) => (b.editorialScore ?? 0) - (a.editorialScore ?? 0)
  );
  const topPool = sortedPool[0];
  if (topPool && homepage.length >= 8) {
    const onHomepage = homepage.some((e) => eventDedupeKey(e) === eventDedupeKey(topPool));
    const topScore = topPool.editorialScore ?? 0;
    const minHomeScore = Math.min(...homepage.map((e) => e.editorialScore ?? 0));
    if (!onHomepage && topScore - minHomeScore > 8) {
      findings.push({
        severity: "low",
        category: "ranking_diversity_tradeoff",
        message: `Top pool event "${topPool.name}" omitted for diversity (score ${topScore} vs homepage min ${minHomeScore})`,
      });
    }
  }

  // Low-value / suspicious titles in pool
  const suspicious = events.filter((e) =>
    /\b(parking|storage unit|mlm|timeshare|adult|strip club)\b/i.test(`${e.name} ${e.venue}`)
  );
  if (suspicious.length) {
    findings.push({
      severity: "critical",
      category: "events_dont_belong",
      message: `${suspicious.length} suspicious listing(s) in pool`,
      samples: suspicious.slice(0, 3).map((e) => e.name),
    });
  }

  return {
    city: place.city,
    place,
    generationMs,
    healthScore: health.overallScore,
    eventCount: events.length,
    homepageCount: homepage.length,
    findings,
  };
}

function aggregateFindings(reports: CityAuditReport[]): AggregatedIssue[] {
  const map = new Map<string, AggregatedIssue>();

  for (const report of reports) {
    for (const f of report.findings) {
      const key = `${f.severity}|${f.category}|${f.message.replace(/\d+/g, "N")}`;
      const existing = map.get(key);
      if (existing) {
        existing.cityCount += 1;
        existing.cities.push(report.city);
        if (f.samples?.length) {
          existing.samples.push(...f.samples.slice(0, 2));
        }
      } else {
        map.set(key, {
          severity: f.severity,
          category: f.category,
          message: f.message,
          cityCount: 1,
          cities: [report.city],
          samples: f.samples?.slice(0, 2) ?? [],
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    const d = order[a.severity] - order[b.severity];
    if (d !== 0) return d;
    return b.cityCount - a.cityCount;
  });
}

function renderMarkdown(
  reports: CityAuditReport[],
  aggregated: AggregatedIssue[]
): string {
  const lines: string[] = [
    "# Global Edition Editorial Audit",
    "",
    `**Edition date:** ${EDITION_DATE}  `,
    `**Cities audited:** ${reports.length}  `,
    `**Generated:** ${new Date().toISOString()}`,
    "",
    "## Executive summary",
    "",
  ];

  const avgHealth =
    reports.reduce((s, r) => s + r.healthScore, 0) / Math.max(reports.length, 1);
  const criticalCities = reports.filter((r) =>
    r.findings.some((f) => f.severity === "critical")
  ).length;

  lines.push(
    `- Average health score: **${avgHealth.toFixed(0)}/100**`,
    `- Cities with critical findings: **${criticalCities}/${reports.length}**`,
    `- Median event pool size: **${median(reports.map((r) => r.eventCount))}**`,
    ""
  );

  for (const severity of ["critical", "high", "medium", "low"] as const) {
    const items = aggregated.filter((a) => a.severity === severity);
    if (!items.length) continue;
    lines.push(`## ${severity.charAt(0).toUpperCase() + severity.slice(1)}`, "");
    for (const item of items) {
      lines.push(
        `- **${item.category}** (${item.cityCount} cities: ${item.cities.slice(0, 8).join(", ")}${item.cities.length > 8 ? "…" : ""})`,
        `  ${item.message}`
      );
      if (item.samples.length) {
        lines.push(`  _Samples:_ ${item.samples.slice(0, 4).join("; ")}`);
      }
    }
    lines.push("");
  }

  lines.push("## Per-city scores", "", "| City | Health | Events | Findings |", "| --- | ---: | ---: | ---: |");
  for (const r of reports.sort((a, b) => a.healthScore - b.healthScore)) {
    lines.push(
      `| ${r.city} | ${r.healthScore} | ${r.eventCount} | ${r.findings.length} |`
    );
  }
  lines.push("");

  return lines.join("\n");
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

async function main() {
  mkdirSync(join(process.cwd(), "reports"), { recursive: true });

  console.log(`Auditing ${AUDIT_CITIES.length} cities for ${EDITION_DATE}…`);
  const token = await getAccessToken();
  const reports: CityAuditReport[] = [];

  for (const place of AUDIT_CITIES) {
    process.stdout.write(`\n→ ${place.city}… `);
    const gen = await generateEdition(token, place);
    if (!gen.ok) {
      console.log(`GENERATION FAILED (${gen.ms}ms)`);
      reports.push({
        city: place.city,
        place,
        generationMs: gen.ms,
        healthScore: 0,
        eventCount: 0,
        homepageCount: 0,
        findings: [
          {
            severity: "critical",
            category: "generation_failed",
            message: gen.error?.slice(0, 200) ?? "Unknown error",
          },
        ],
      });
      continue;
    }

    const row = await fetchEditionRow();
    if (!row) {
      console.log("NO EDITION ROW");
      reports.push({
        city: place.city,
        place,
        generationMs: gen.ms,
        healthScore: 0,
        eventCount: 0,
        homepageCount: 0,
        findings: [
          {
            severity: "critical",
            category: "missing_edition",
            message: "Edition row not found after generation",
          },
        ],
      });
      continue;
    }

    const sections = await fetchSections(row.id);
    const audit = auditCityEdition(place, sections, row, gen.ms);
    reports.push(audit);
    console.log(
      `health ${audit.healthScore} · ${audit.eventCount} events · ${audit.findings.length} findings (${gen.ms}ms)`
    );
  }

  const aggregated = aggregateFindings(reports);
  const jsonPath = join(process.cwd(), "reports/global-edition-audit.json");
  const mdPath = join(process.cwd(), "reports/GLOBAL_EDITION_AUDIT.md");

  writeFileSync(jsonPath, JSON.stringify({ editionDate: EDITION_DATE, reports, aggregated }, null, 2));
  writeFileSync(mdPath, renderMarkdown(reports, aggregated));

  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
