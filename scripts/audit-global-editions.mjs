/**
 * Global editorial audit (Node-only — no React Native imports).
 * npx --yes tsx not required; run: node scripts/audit-global-editions.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = process.env.AUDIT_USER_ID ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const EDITION_DATE = process.env.AUDIT_EDITION_DATE ?? "2026-07-17";

const AUDIT_CITIES = [
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

const SPORTS_MARKETS = {
  "phoenix-metro": {
    teams: [/diamondbacks|d-backs|cardinals|mercury|suns|rising fc|coyotes/i],
  },
  "seattle-metro": {
    teams: [/mariners|seahawks|kraken|sounders|storm|reign/i],
  },
  "denver-metro": {
    teams: [/rockies|broncos|nuggets|avalanche|rapids/i],
  },
};

const GENERIC_TITLE = /^(community|networking|meetup|meeting|social|gathering|event|workshop|seminar|class|program|fundraiser|festival)\b/i;

function parseEvents(body) {
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) return parsed;
    return parsed.events ?? [];
  } catch {
    return [];
  }
}

function eventScore(e) {
  return typeof e.editorialScore === "number" ? e.editorialScore : 10;
}

function eventKey(e) {
  return `${e.name}|${e.date}|${e.venue}`.toLowerCase();
}

function normalizeVenue(v) {
  return v?.trim().toLowerCase() ?? "";
}

function classifyDesk(e) {
  const hay = `${e.name} ${e.venue}`.toLowerCase();
  if (e.category === "sports") return "sports";
  if (e.category === "music") return "music";
  if (e.category === "comedy" || e.category === "arts") return "arts";
  if (e.category === "community" || e.category === "family") return "community";
  if (/\b(festival|fair|market)\b/i.test(hay) || e.category === "market" || e.category === "food")
    return "festival";
  return e.category ?? "other";
}

/** Simplified homepage pick — score sort with venue + category + geo diversity penalties. */
function selectHomepage(events, maxTotal = 8) {
  const sorted = [...events].sort((a, b) => eventScore(b) - eventScore(a));
  const picked = [];
  const pickedKeys = new Set();

  while (picked.length < maxTotal && sorted.length) {
    let best = null;
    let bestAdj = -Infinity;
    for (const candidate of sorted) {
      if (pickedKeys.has(eventKey(candidate))) continue;
      const venue = normalizeVenue(candidate.venue);
      const venueCount = picked.filter((p) => normalizeVenue(p.venue) === venue).length;
      const city = candidate.city?.trim().toLowerCase() ?? "";
      const cityCount = picked.filter((p) => (p.city?.trim().toLowerCase() ?? "") === city).length;
      const desk = classifyDesk(candidate);
      const deskCount = picked.filter((p) => classifyDesk(p) === desk).length;

      if (venueCount >= 1) {
        const freshVenues = new Set(
          sorted
            .filter((e) => !pickedKeys.has(eventKey(e)))
            .map((e) => normalizeVenue(e.venue))
            .filter((v) => v && !picked.some((p) => normalizeVenue(p.venue) === v))
        );
        if (freshVenues.size >= maxTotal - picked.length) continue;
      }

      const adj = eventScore(candidate) - venueCount * 22 - cityCount * 7 - deskCount * 9;
      if (adj > bestAdj) {
        bestAdj = adj;
        best = candidate;
      }
    }
    if (!best) break;
    picked.push(best);
    pickedKeys.add(eventKey(best));
  }
  return picked;
}

function resolveSportsMarket(city, state) {
  const hay = `${city} ${state ?? ""}`.toLowerCase();
  if (/phoenix|gilbert|scottsdale|mesa|tempe|chandler|arizona|az\b/.test(hay)) return "phoenix-metro";
  if (/seattle|washington|wa\b/.test(hay)) return "seattle-metro";
  if (/denver|colorado|co\b/.test(hay)) return "denver-metro";
  return null;
}

function hasHometownSports(events, marketId) {
  if (!marketId || !SPORTS_MARKETS[marketId]) return null;
  const patterns = SPORTS_MARKETS[marketId].teams;
  return events.some(
    (e) =>
      e.category === "sports" &&
      patterns.some((p) => p.test(`${e.name} ${e.venue}`))
  );
}

function computeHealthScore({ events, sections, discovery, bandit, leadStory }) {
  let score = 100;
  if (!events.length) score -= 40;
  else if (events.length < 8) score -= 15;
  if (!sections.some((s) => s.section_type === "today_in_history")) score -= 10;
  if (!bandit?.pick) score -= 12;
  if (!leadStory?.headline && !leadStory?.title) score -= 10;
  const discItems = discovery?.surfaces
    ? Object.values(discovery.surfaces).reduce((n, s) => n + (s?.items?.length ?? 0), 0)
    : 0;
  if (discItems === 0) score -= 15;
  return Math.max(0, Math.min(100, score));
}

function auditCity(place, row, sections, generationMs) {
  const findings = [];
  const eventsSection = sections.find((s) => s.section_type === "local_events");
  const events = parseEvents(eventsSection?.body);
  const homepage = selectHomepage(events, 8);
  const marketId = resolveSportsMarket(place.city, place.state);
  const healthScore = computeHealthScore({
    events,
    sections,
    discovery: row.discovery,
    bandit: row.bandit,
    leadStory: row.lead_story,
  });

  if (row.status !== "ready") {
    findings.push({ severity: "critical", category: "edition_status", message: `Status ${row.status}` });
  }
  if (events.length === 0) {
    findings.push({ severity: "critical", category: "empty_events", message: "No local events" });
  } else if (events.length < 8) {
    findings.push({ severity: "high", category: "thin_events", message: `Only ${events.length} events` });
  }

  const dupes = new Map();
  for (const e of events) dupes.set(eventKey(e), (dupes.get(eventKey(e)) ?? 0) + 1);
  const dupeList = [...dupes.entries()].filter(([, c]) => c > 1);
  if (dupeList.length) {
    findings.push({
      severity: "high",
      category: "duplicate_events",
      message: `${dupeList.length} duplicate listing(s)`,
      samples: dupeList.slice(0, 3).map(([k]) => k.split("|")[0]),
    });
  }

  const venueCounts = new Map();
  for (const e of homepage) {
    const v = normalizeVenue(e.venue);
    venueCounts.set(v, (venueCounts.get(v) ?? 0) + 1);
  }
  const repeatVenues = [...venueCounts.entries()].filter(([, c]) => c > 1);
  if (repeatVenues.length) {
    findings.push({
      severity: "high",
      category: "repetitive_venues",
      message: repeatVenues.map(([v, c]) => `${v} (${c}x)`).join(", "),
    });
  }

  const deskCounts = new Map();
  for (const e of homepage) {
    const d = classifyDesk(e);
    deskCounts.set(d, (deskCounts.get(d) ?? 0) + 1);
  }
  for (const [desk, count] of deskCounts) {
    if (count >= 4) {
      findings.push({
        severity: "medium",
        category: "repetitive_categories",
        message: `${desk} appears ${count}x on homepage`,
      });
    }
  }

  const homepageCities = new Set(homepage.map((e) => e.city?.trim().toLowerCase()).filter(Boolean));
  if (homepage.length >= 6 && homepageCities.size <= 2) {
    findings.push({
      severity: "medium",
      category: "poor_geographic_spread",
      message: `Homepage only ${homepageCities.size} cities: ${[...homepageCities].join(", ")}`,
    });
  }

  const weakTitles = events.filter((e) => GENERIC_TITLE.test(e.name?.trim() ?? "")).map((e) => e.name);
  if (weakTitles.length) {
    findings.push({
      severity: "medium",
      category: "weak_titles",
      message: `${weakTitles.length} generic titles`,
      samples: weakTitles.slice(0, 4),
    });
  }

  if (marketId && events.some((e) => e.category === "sports") && !hasHometownSports(events, marketId)) {
    findings.push({
      severity: "high",
      category: "missing_hometown_sports",
      message: `No hometown pro/college sports for ${marketId}`,
    });
  }

  const missingMaps = events.filter((e) => e.lat == null || e.lon == null).length;
  if (missingMaps > events.length * 0.35 && events.length) {
    findings.push({
      severity: "medium",
      category: "missing_maps",
      message: `${missingMaps}/${events.length} events missing coordinates`,
    });
  }

  const missingImages = events.filter((e) => !e.imageUrl?.trim()).length;
  if (missingImages > events.length * 0.5 && events.length) {
    findings.push({
      severity: "low",
      category: "missing_images",
      message: `${missingImages}/${events.length} events missing images`,
    });
  }

  if (!sections.some((s) => s.section_type === "story_of" || s.section_type === "your_city")) {
    findings.push({ severity: "medium", category: "weak_sections", message: "Story of city missing" });
  }
  if (!row.discovery?.surfaces || Object.keys(row.discovery.surfaces).length === 0) {
    findings.push({ severity: "high", category: "weak_sections", message: "Discovery payload empty" });
  }
  if (!row.bandit?.pick) {
    findings.push({ severity: "high", category: "weak_sections", message: "Bandit's Pick missing" });
  }

  const suspicious = events.filter((e) =>
    /\b(strip club|adult entertainment|timeshare|mlm|pyramid)\b/i.test(`${e.name} ${e.venue}`)
  );
  if (suspicious.length) {
    findings.push({
      severity: "critical",
      category: "events_dont_belong",
      message: `${suspicious.length} suspicious listing(s)`,
      samples: suspicious.map((e) => e.name),
    });
  }

  const handshake = homepage.filter(
    (e) =>
      e.categoryIcon === "🤝" &&
      !/\b(networking|mixer|meet-?and-?greet|outreach|collaboration)\b/i.test(`${e.name} ${e.venue}`)
  );
  if (handshake.length) {
    findings.push({
      severity: "medium",
      category: "incorrect_emojis",
      message: `${handshake.length} generic 🤝 on homepage`,
      samples: handshake.map((e) => e.name),
    });
  }

  return {
    city: place.city,
    place,
    generationMs,
    healthScore,
    eventCount: events.length,
    homepageCount: homepage.length,
    findings,
  };
}

function aggregateFindings(reports) {
  const map = new Map();
  for (const report of reports) {
    for (const f of report.findings) {
      const key = `${f.severity}|${f.category}|${f.message.replace(/\d+/g, "N")}`;
      const ex = map.get(key);
      if (ex) {
        ex.cityCount += 1;
        ex.cities.push(report.city);
        if (f.samples) ex.samples.push(...f.samples.slice(0, 2));
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
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...map.values()].sort(
    (a, b) => order[a.severity] - order[b.severity] || b.cityCount - a.cityCount
  );
}

function renderMarkdown(reports, aggregated) {
  const avg = reports.reduce((s, r) => s + r.healthScore, 0) / Math.max(reports.length, 1);
  const lines = [
    "# Global Edition Editorial Audit",
    "",
    `**Edition date:** ${EDITION_DATE}`,
    `**Cities audited:** ${reports.length}`,
    `**Average health score:** ${avg.toFixed(0)}/100`,
    "",
  ];
  for (const sev of ["critical", "high", "medium", "low"]) {
    const items = aggregated.filter((a) => a.severity === sev);
    if (!items.length) continue;
    lines.push(`## ${sev.charAt(0).toUpperCase() + sev.slice(1)}`, "");
    for (const item of items) {
      lines.push(
        `- **${item.category}** — ${item.message} (${item.cityCount} cities: ${item.cities.slice(0, 10).join(", ")}${item.cities.length > 10 ? "…" : ""})`
      );
      if (item.samples.length) lines.push(`  _Samples:_ ${item.samples.slice(0, 4).join("; ")}`);
    }
    lines.push("");
  }
  lines.push("## Per-city", "", "| City | Health | Events | Issues |", "| --- | ---: | ---: | ---: |");
  for (const r of [...reports].sort((a, b) => a.healthScore - b.healthScore)) {
    lines.push(`| ${r.city} | ${r.healthScore} | ${r.eventCount} | ${r.findings.length} |`);
  }
  return lines.join("\n");
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getAccessToken() {
  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(USER_ID);
  if (userErr || !userData?.user?.email) throw new Error(userErr?.message ?? "no user");
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userData.user.email,
  });
  if (linkErr) throw new Error(linkErr.message);
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionData, error: verifyErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr) throw new Error(verifyErr.message);
  return sessionData.session.access_token;
}

async function generateEdition(token, place) {
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
  return { ms: Date.now() - started, ok: res.ok, error: res.ok ? null : await res.text() };
}

async function fetchEditionRow() {
  const { data, error } = await admin
    .from("editions")
    .select("id,status,edition_date,lead_story,bandit,discovery")
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchSections(editionId) {
  const { data, error } = await admin
    .from("edition_sections")
    .select("section_type,headline,body,source_note,position")
    .eq("edition_id", editionId)
    .order("position");
  if (error) throw error;
  return data ?? [];
}

async function main() {
  mkdirSync(join(process.cwd(), "reports"), { recursive: true });
  console.log(`Auditing ${AUDIT_CITIES.length} cities…`);
  const token = await getAccessToken();
  const reports = [];

  for (const place of AUDIT_CITIES) {
    process.stdout.write(`→ ${place.city}… `);
    const gen = await generateEdition(token, place);
    if (!gen.ok) {
      console.log("FAIL");
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
            message: gen.error?.slice(0, 180) ?? "failed",
          },
        ],
      });
      continue;
    }
    const row = await fetchEditionRow();
    if (!row) {
      console.log("NO ROW");
      continue;
    }
    const sections = await fetchSections(row.id);
    const audit = auditCity(place, row, sections, gen.ms);
    reports.push(audit);
    console.log(`${audit.healthScore} · ${audit.eventCount} ev · ${audit.findings.length} issues (${gen.ms}ms)`);
  }

  const aggregated = aggregateFindings(reports);
  writeFileSync(
    join(process.cwd(), "reports/global-edition-audit.json"),
    JSON.stringify({ editionDate: EDITION_DATE, reports, aggregated }, null, 2)
  );
  writeFileSync(
    join(process.cwd(), "reports/GLOBAL_EDITION_AUDIT.md"),
    renderMarkdown(reports, aggregated)
  );
  console.log("\nDone — reports/GLOBAL_EDITION_AUDIT.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
