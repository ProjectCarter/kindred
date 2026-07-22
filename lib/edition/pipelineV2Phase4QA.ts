/**
 * Edition Pipeline V2 Phase 4 — real-world edition quality & cross-city validation.
 * Validates persisted edition bundles without modifying pipeline architecture.
 */


const LOCAL_NEWS_EMPTY_PLACEHOLDER = "No major local updates today.";

const PLACEHOLDER_COPY_PATTERNS: RegExp[] = [
  /editorial quality worthy of a magazine desk/i,
  /matches what you tend to care about/i,
  /hand-selected for today'?s paper/i,
  /magazine desk energy/i,
];

function isPlaceholderCopy(text: string | null | undefined): boolean {
  if (!text?.trim()) return true;
  if (text.trim().length < 12) return true;
  return PLACEHOLDER_COPY_PATTERNS.some((re) => re.test(text));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasSubstance(text: string | null | undefined, minWords = 18): boolean {
  if (!text?.trim()) return false;
  if (isPlaceholderCopy(text)) return false;
  return wordCount(text) >= minWords;
}

function normalizeProseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isRestaurantContamination(name: string, category?: string): boolean {
  if (category === "restaurants" || category === "coffee" || category === "bakeries") {
    return true;
  }
  return /\b(restaurant|cafe|coffee shop|bakery|brewery|winery|bistro|diner)\b/i.test(name);
}
import {
  detectCityBleed,
  verifyNationalParity,
  verifyLocalDistinct,
  type CityEditionSnapshot,
  type AuditIssue,
  buildCitySnapshot,
} from "./nationwideAudit.ts";
import type { Phase4CitySpec } from "./pipelineV2Phase4Cities.ts";
import { PHASE4_QA_CITIES } from "./pipelineV2Phase4Cities.ts";
import { isPublicationEligibleForRepairFlow } from "./sectionRepair.ts";
import {
  readValidationFromBuildState,
  type TechnicalValidationReport,
} from "./editionValidationTypes.ts";
import type { EditionSection } from "./types.ts";
import type { LeadStory } from "./LeadStory.ts";
import type { EditionIntelligence } from "./surfaceIntelligence.ts";
import type { NationalNewsPackage } from "./nationalNewsTypes.ts";
import type { MorningHeroExperience } from "./heroArtwork/types.ts";
import { citiesMatch } from "../location/locationKey.ts";

export type Phase4FindingSeverity = "critical" | "high" | "medium" | "low";

export type Phase4Finding = {
  severity: Phase4FindingSeverity;
  category: string;
  section?: string;
  message: string;
};

export type Phase4SectionScorecard = {
  section: string;
  passed: boolean;
  checksPassed: number;
  checksTotal: number;
  findings: Phase4Finding[];
};

export type Phase4PipelineMetrics = {
  generationMs: number | null;
  validationMs: number | null;
  repairMs: number | null;
  publishMs: number | null;
  validationStatus: string | null;
  repairStagesRequeued: string[];
  fullEditionRegeneration: boolean;
};

export type Phase4CityQAResult = {
  label: string;
  metroKey: string;
  editionDate: string;
  passed: boolean;
  score: number;
  sectionScorecards: Phase4SectionScorecard[];
  findings: Phase4Finding[];
  pipeline: Phase4PipelineMetrics;
  completeness: {
    complete: boolean;
    missing: string[];
  };
};

export type Phase4ValidationReport = {
  generatedAt: string;
  editionDate: string;
  citiesRun: number;
  citiesPassed: number;
  overallPassRate: number;
  perCityScorecard: Array<{
    label: string;
    metroKey: string;
    passed: boolean;
    score: number;
    criticalFindings: number;
  }>;
  perSectionScorecard: Record<
    string,
    { passed: number; failed: number; total: number }
  >;
  duplicateContentFindings: Phase4Finding[];
  missingContentFindings: Phase4Finding[];
  incorrectImageFindings: Phase4Finding[];
  incorrectLocationFindings: Phase4Finding[];
  performanceMetrics: {
    averageGenerationMs: number | null;
    averageValidationMs: number | null;
    averageRepairMs: number | null;
    averagePublishMs: number | null;
    totalPipelineMs: number | null;
  };
  nationalParityIssues: AuditIssue[];
  localDistinctIssues: AuditIssue[];
  launchBlockers: Phase4Finding[];
  recommendation: "ready_for_v1" | "minor_issues_remaining" | "major_issues_remaining";
  cityResults: Phase4CityQAResult[];
};

export type Phase4EditionInput = {
  spec: Phase4CitySpec;
  editionDate: string;
  metroKey: string;
  editionId: string;
  sections: EditionSection[];
  leadStory: LeadStory | null;
  nationalNews: NationalNewsPackage | null;
  bandit: unknown;
  intelligence: EditionIntelligence | null;
  morningHero: MorningHeroExperience | null;
  usNationalDailyId?: string | null;
  editorialContext?: unknown;
  discovery?: unknown;
  pipeline?: Partial<Phase4PipelineMetrics> & {
    buildState?: Record<string, unknown>;
    validationReport?: TechnicalValidationReport;
  };
};

const PLACEHOLDER_IMAGE_PATTERNS: RegExp[] = [
  /placeholder/i,
  /via\.placeholder\.com/i,
  /picsum\.photos/i,
  /dummyimage\.com/i,
  /placehold\.co/i,
];

const BROKEN_IMAGE_PATTERNS: RegExp[] = [
  /^$/,
  /^null$/i,
  /^undefined$/i,
  /^#$/,
  /^about:blank$/i,
];

const FOOD_SURFACE_KEYS = /restaurants|coffee|bakeries|breweries|wineries|food/i;
const ACTIVITY_SURFACE_KEYS =
  /activities|museums|parks|beaches|hiking|hidden_gems|escape|bowling|mini_golf/i;

function finding(
  severity: Phase4FindingSeverity,
  category: string,
  message: string,
  section?: string
): Phase4Finding {
  return { severity, category, section, message };
}

function scoreFromFindings(findings: Phase4Finding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "critical") score -= 25;
    else if (f.severity === "high") score -= 10;
    else if (f.severity === "medium") score -= 5;
    else score -= 2;
  }
  return Math.max(0, score);
}

function parseLocalEvents(
  sections: EditionSection[]
): Array<{ name?: string; city?: string; venue?: string; startDate?: string; lat?: number; lon?: number }> {
  const row = sections.find((s) => s.section_type === "local_events");
  if (!row?.body) return [];
  try {
    const parsed = JSON.parse(row.body) as { events?: unknown[] };
    return Array.isArray(parsed.events) ? (parsed.events as Array<{ name?: string; city?: string; venue?: string; startDate?: string; lat?: number; lon?: number }>) : [];
  } catch {
    return [];
  }
}

function discoveryItems(
  discovery: unknown,
  surfacePattern: RegExp
): Array<{ name?: string; title?: string; city?: string; category?: string; imageUrl?: string; heroImage?: { uri?: string } }> {
  if (!discovery || typeof discovery !== "object") return [];
  const surfaces = (discovery as { surfaces?: Record<string, { items?: unknown[] }> }).surfaces ?? {};
  const items: Array<{ name?: string; title?: string; city?: string; category?: string; imageUrl?: string; heroImage?: { uri?: string } }> = [];
  for (const [key, surface] of Object.entries(surfaces)) {
    if (!surfacePattern.test(key)) continue;
    for (const raw of surface.items ?? []) {
      if (raw && typeof raw === "object") {
        items.push(raw as typeof items[number]);
      }
    }
  }
  return items;
}

function discoveryRankedItems(
  discovery: unknown,
  surfacePattern: RegExp
): Array<{ title: string; category?: string; city?: string }> {
  const raw = discoveryItems(discovery, surfacePattern);
  return raw
    .map((item) => {
      const ranked = item as { item?: { title?: string; category?: string; place?: { city?: string } } };
      const title = ranked.item?.title?.trim() ?? item.title?.trim() ?? item.name?.trim();
      if (!title) return null;
      return {
        title,
        category: ranked.item?.category ?? item.category,
        city: ranked.item?.place?.city ?? item.city,
      };
    })
    .filter((x): x is { title: string; category?: string; city?: string } => Boolean(x));
}

function collectImageUris(input: Phase4EditionInput): Array<{ uri: string; context: string }> {
  const uris: Array<{ uri: string; context: string }> = [];
  const push = (uri: string | null | undefined, context: string) => {
    if (uri?.trim()) uris.push({ uri: uri.trim(), context });
  };

  push(input.morningHero?.hostedUrl ?? input.morningHero?.imageUrl, "masterpiece");
  push(input.leadStory?.heroImage?.uri, "local_news");

  for (const story of input.nationalNews?.stories ?? []) {
    push(story.image?.url, `national_news:${story.id ?? story.headline}`);
  }

  const history = input.sections.find((s) => s.section_type === "today_in_history");
  if (history?.body) {
    try {
      const parsed = JSON.parse(history.body) as { imageUrl?: string; heroImage?: { uri?: string } };
      push(parsed.heroImage?.uri, "today_in_history");
      push(parsed.imageUrl, "today_in_history");
    } catch {
      /* prose-only history */
    }
  }

  for (const item of discoveryItems(input.discovery ?? input.intelligence?.discovery, /.*/)) {
    const ranked = item as { item?: { title?: string }; heroImage?: { uri?: string }; imageUrl?: string };
    const label = ranked.item?.title ?? item.title ?? item.name;
    push(item.heroImage?.uri ?? item.imageUrl, `discovery:${label}`);
  }

  return uris;
}

function checkGeneral(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const { spec, metroKey, editionDate, sections } = input;

  if (metroKey !== spec.expectedMetroKey) {
    findings.push(
      finding(
        "critical",
        "wrong_metro_key",
        `Expected metro ${spec.expectedMetroKey}, got ${metroKey}`,
        "general"
      )
    );
  }

  const greeting = sections.find((s) => s.section_type === "greeting");
  if (!greeting?.headline?.trim() && !greeting?.body?.trim()) {
    findings.push(
      finding("high", "missing_greeting", "Morning greeting section is blank", "general")
    );
  } else if (greeting?.body && !hasSubstance(greeting.body, 4)) {
    findings.push(
      finding("medium", "weak_greeting", "Greeting copy lacks substance", "general")
    );
  }

  const weather = sections.find((s) => s.section_type === "weather");
  if (!weather?.headline?.trim()) {
    findings.push(
      finding("high", "missing_weather", "Weather section missing headline", "general")
    );
  } else if (isPlaceholderCopy(weather.body)) {
    findings.push(
      finding("medium", "placeholder_weather", "Weather body reads as placeholder", "general")
    );
  }

  const types = sections.map((s) => s.section_type);
  const dupTypes = types.filter((t, i) => types.indexOf(t) !== i);
  if (dupTypes.length) {
    findings.push(
      finding(
        "critical",
        "duplicate_sections",
        `Duplicate section types: ${[...new Set(dupTypes)].join(", ")}`,
        "general"
      )
    );
  }

  for (const section of sections) {
    if (section.section_type === "greeting") continue;
    if (!section.headline?.trim() && !section.body?.trim()) {
      findings.push(
        finding(
          "high",
          "blank_section",
          `Section ${section.section_type} has no headline or body`,
          section.section_type
        )
      );
    }
  }

  if (!editionDate?.trim()) {
    findings.push(finding("critical", "missing_edition_date", "Edition date missing", "general"));
  }

  const localText = JSON.stringify({
    sections,
    leadStory: input.leadStory,
    discovery: input.discovery,
  });
  findings.push(
    ...detectCityBleed(spec, localText).map((i) =>
      finding(i.severity as Phase4FindingSeverity, i.category, i.message, "general")
    )
  );

  return findings;
}

function checkLocalEvents(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const events = parseLocalEvents(input.sections);
  const { spec } = input;
  const refDate = new Date(`${input.editionDate}T12:00:00`);

  if (events.length === 0) {
    findings.push(
      finding("high", "missing_local_events", "No local events in edition", "local_events")
    );
    return findings;
  }

  const names = new Set<string>();
  for (const ev of events) {
    const name = ev.name?.trim();
    if (!name) {
      findings.push(
        finding("medium", "event_missing_name", "Event missing name", "local_events")
      );
      continue;
    }
    const key = normalizeProseKey(name);
    if (names.has(key)) {
      findings.push(
        finding("high", "duplicate_event", `Duplicate event: ${name}`, "local_events")
      );
    }
    names.add(key);

    if (ev.city && spec.city && !citiesMatch(ev.city, spec.city) && !citiesMatch(ev.city, spec.label)) {
      // Allow metro neighbors — flag only obvious wrong-state bleed handled by detectCityBleed
    }

    if (!ev.venue?.trim() && (ev.lat == null || ev.lon == null)) {
      findings.push(
        finding(
          "medium",
          "event_missing_location",
          `Event "${name}" lacks venue and coordinates`,
          "local_events"
        )
      );
    }

    if (ev.startDate) {
      const start = new Date(ev.startDate);
      if (!Number.isNaN(start.getTime()) && start < new Date(refDate.getTime() - 86400000)) {
        findings.push(
          finding(
            "high",
            "stale_event",
            `Event "${name}" start date ${ev.startDate} is before edition date`,
            "local_events"
          )
        );
      }
    }
  }

  return findings;
}

function checkActivities(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const discovery = input.discovery ?? input.intelligence?.discovery;
  const activities = discoveryRankedItems(discovery, ACTIVITY_SURFACE_KEYS);

  if (activities.length === 0) {
    findings.push(
      finding("high", "missing_activities", "No activities in discovery surfaces", "activities")
    );
    return findings;
  }

  const names = new Set<string>();
  for (const act of activities) {
    const name = act.title;
    const key = normalizeProseKey(name);
    if (names.has(key)) {
      findings.push(
        finding("high", "duplicate_activity", `Duplicate activity: ${name}`, "activities")
      );
    }
    names.add(key);

    if (isRestaurantContamination(name, act.category)) {
      findings.push(
        finding(
          "high",
          "restaurant_contamination",
          `Restaurant listing in Activities: ${name}`,
          "activities"
        )
      );
    }
  }

  return findings;
}

function checkFoodDrinks(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const discovery = input.discovery ?? input.intelligence?.discovery;
  const food = discoveryRankedItems(discovery, FOOD_SURFACE_KEYS);

  if (food.length === 0) {
    findings.push(
      finding("high", "missing_food_drinks", "No Food & Drinks listings", "food_drinks")
    );
    return findings;
  }

  const names = new Set<string>();
  for (const place of food) {
    const name = place.title;
    const key = normalizeProseKey(name);
    if (names.has(key)) {
      findings.push(
        finding("high", "duplicate_food", `Duplicate Food & Drinks listing: ${name}`, "food_drinks")
      );
    }
    names.add(key);
  }

  return findings;
}

function checkStoryOf(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const story =
    input.sections.find((s) => s.section_type === "story_of") ??
    input.sections.find((s) => s.section_type === "your_city");

  if (!story?.headline?.trim()) {
    findings.push(
      finding("high", "missing_story_of", "Story of Your City section missing", "story_of")
    );
    return findings;
  }

  const match = story.headline.match(/^The Story of\s+(.+)$/i);
  const headlineCity = match?.[1]?.trim();
  if (headlineCity && !citiesMatch(headlineCity, input.spec.city)) {
    findings.push(
      finding(
        "critical",
        "story_of_city_mismatch",
        `Story headline city "${headlineCity}" ≠ ${input.spec.city}`,
        "story_of"
      )
    );
  }

  if (!hasSubstance(story.body, 80)) {
    findings.push(
      finding("medium", "thin_story_of", "Story of Your City body lacks editorial depth", "story_of")
    );
  }

  return findings;
}

function checkMasterpiece(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const hero = input.morningHero ?? input.intelligence?.morningHero;

  if (!hero?.artworkTitle?.trim() && !hero?.aboutArtworkBody?.trim()) {
    findings.push(
      finding("medium", "missing_masterpiece", "Today's Masterpiece not present (non-blocking)", "masterpiece")
    );
    return findings;
  }

  if (hero?.aboutArtworkBody && !hasSubstance(hero.aboutArtworkBody, 20)) {
    findings.push(
      finding("medium", "thin_masterpiece", "Masterpiece teaser lacks depth", "masterpiece")
    );
  }

  return findings;
}

function checkTodayInHistory(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const section = input.sections.find((s) => s.section_type === "today_in_history");

  if (!section?.headline?.trim()) {
    findings.push(
      finding("medium", "missing_today_in_history", "Today in History missing (non-blocking)", "today_in_history")
    );
    return findings;
  }

  if (!hasSubstance(section.body, 40)) {
    findings.push(
      finding("medium", "thin_today_in_history", "Today in History body lacks depth", "today_in_history")
    );
  }

  return findings;
}

function checkLocalNews(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const lead = input.leadStory;

  if (!lead?.headline?.trim()) {
    findings.push(
      finding("high", "missing_local_news", "Local News lead story missing", "local_news")
    );
    return findings;
  }

  if (lead.headline === LOCAL_NEWS_EMPTY_PLACEHOLDER) {
    findings.push(
      finding("high", "placeholder_local_news", "Local News uses placeholder copy", "local_news")
    );
  } else if (isPlaceholderCopy(lead.summary)) {
    findings.push(
      finding("high", "placeholder_local_news", "Local News uses placeholder copy", "local_news")
    );
  }

  if (lead.body) {
    const prose = Array.isArray(lead.body) ? lead.body.join("\n") : lead.body;
    if (!hasSubstance(prose, 30)) {
      findings.push(
        finding("medium", "thin_local_news", "Local News body lacks editorial depth", "local_news")
      );
    }
  }

  return findings;
}

function checkNationalNews(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const pkg = input.nationalNews;

  if (!pkg?.stories?.length) {
    findings.push(
      finding("high", "missing_national_news", "National News package missing or empty", "national_news")
    );
    return findings;
  }

  for (const story of pkg.stories) {
    if (!story.headline?.trim()) {
      findings.push(
        finding("high", "national_story_missing_headline", "National story missing headline", "national_news")
      );
    }
    if (story.summary && !hasSubstance(story.summary, 20)) {
      findings.push(
        finding("medium", "thin_national_story", `Thin national story: ${story.headline}`, "national_news")
      );
    }
  }

  return findings;
}

function checkImages(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const uris = collectImageUris(input);
  const seen = new Map<string, string>();

  for (const { uri, context } of uris) {
    if (BROKEN_IMAGE_PATTERNS.some((re) => re.test(uri))) {
      findings.push(
        finding("high", "broken_image", `Broken image URI in ${context}`, "images")
      );
    }
    if (PLACEHOLDER_IMAGE_PATTERNS.some((re) => re.test(uri))) {
      findings.push(
        finding("high", "placeholder_image", `Placeholder image in ${context}: ${uri.slice(0, 80)}`, "images")
      );
    }
    const prev = seen.get(uri);
    if (prev && prev !== context) {
      findings.push(
        finding(
          "medium",
          "duplicate_image_unrelated",
          `Same image reused in ${prev} and ${context}`,
          "images"
        )
      );
    }
    seen.set(uri, context);
  }

  return findings;
}

function checkPipeline(input: Phase4EditionInput): Phase4Finding[] {
  const findings: Phase4Finding[] = [];
  const pipeline = input.pipeline;
  const report = pipeline?.validationReport;
  const validationState = pipeline?.buildState
    ? readValidationFromBuildState(pipeline.buildState)
    : null;

  if (report) {
    if (!isPublicationEligibleForRepairFlow(report) && report.overallStatus === "FAIL") {
      const repairHistory = validationState?.repairHistory ?? [];
      const lastRepair = repairHistory[repairHistory.length - 1];
      if (lastRepair?.unresolved) {
        findings.push(
          finding(
            "critical",
            "pipeline_unresolved_repair",
            `Repair unresolved: ${lastRepair.unresolvedReason ?? "unknown"}`,
            "pipeline"
          )
        );
      } else {
        findings.push(
          finding(
            "critical",
            "pipeline_validation_fail",
            `Validation FAIL: ${report.blockingFailures.join(", ")}`,
            "pipeline"
          )
        );
      }
    }
  }

  const repairStages = pipeline?.repairStagesRequeued ?? [];
  if (repairStages.includes("initialize_edition")) {
    findings.push(
      finding("critical", "full_regeneration", "initialize_edition was requeued", "pipeline")
    );
  }

  const contentStages = [
    "generate_national_daily",
    "attach_national_daily",
    "weather",
    "local_events",
    "activities",
    "food_drinks",
    "story_of",
    "local_news",
    "bandits_pick",
  ];
  const requeuedContent = repairStages.filter((s) => contentStages.includes(s));
  if (requeuedContent.length >= contentStages.length - 1) {
    findings.push(
      finding(
        "critical",
        "full_regeneration",
        "Near full-edition stage requeue detected",
        "pipeline"
      )
    );
  }

  return findings;
}

function buildSectionScorecards(
  checks: Record<string, Phase4Finding[]>
): Phase4SectionScorecard[] {
  return Object.entries(checks).map(([section, findings]) => {
    const checksTotal = Math.max(1, findings.length === 0 ? 1 : findings.length + 1);
    const checksPassed = findings.length === 0 ? checksTotal : 0;
    return {
      section,
      passed: findings.every((f) => f.severity !== "critical" && f.severity !== "high"),
      checksPassed: findings.length === 0 ? 1 : 0,
      checksTotal: 1,
      findings,
    };
  });
}

export function auditPhase4Edition(input: Phase4EditionInput): Phase4CityQAResult {
  const sectionChecks: Record<string, Phase4Finding[]> = {
    general: checkGeneral(input),
    local_events: checkLocalEvents(input),
    activities: checkActivities(input),
    food_drinks: checkFoodDrinks(input),
    story_of: checkStoryOf(input),
    masterpiece: checkMasterpiece(input),
    today_in_history: checkTodayInHistory(input),
    local_news: checkLocalNews(input),
    national_news: checkNationalNews(input),
    images: checkImages(input),
    pipeline: checkPipeline(input),
  };

  const findings = Object.values(sectionChecks).flat();

  const missing: string[] = [];
  const sectionTypes = input.sections.map((s) => s.section_type);
  if (!sectionTypes.includes("local_events")) missing.push("section:local_events");
  if (!sectionTypes.includes("today_in_history")) missing.push("section:today_in_history");
  if (!sectionTypes.includes("weather")) missing.push("section:weather");
  if (!input.leadStory?.headline?.trim()) missing.push("lead_story");
  if (!input.nationalNews?.stories?.length) missing.push("national_news");

  const completeness = { complete: missing.length === 0, missing };
  for (const m of missing) {
    findings.push(finding("high", "missing_content", `Completeness gate: ${m}`, "general"));
  }

  const criticalOrHigh = findings.filter(
    (f) => f.severity === "critical" || f.severity === "high"
  );
  const passed = criticalOrHigh.length === 0;

  const pipeline: Phase4PipelineMetrics = {
    generationMs: input.pipeline?.generationMs ?? null,
    validationMs: input.pipeline?.validationMs ?? null,
    repairMs: input.pipeline?.repairMs ?? null,
    publishMs: input.pipeline?.publishMs ?? null,
    validationStatus: input.pipeline?.validationStatus ?? input.pipeline?.validationReport?.overallStatus ?? null,
    repairStagesRequeued: input.pipeline?.repairStagesRequeued ?? [],
    fullEditionRegeneration: input.pipeline?.fullEditionRegeneration ?? false,
  };

  return {
    label: input.spec.label,
    metroKey: input.metroKey,
    editionDate: input.editionDate,
    passed,
    score: scoreFromFindings(findings),
    sectionScorecards: buildSectionScorecards(sectionChecks),
    findings,
    pipeline,
    completeness,
  };
}

export function runPhase4ValidationSuite(
  editions: Phase4EditionInput[],
  editionDate: string
): Phase4ValidationReport {
  const cityResults = editions.map((e) => auditPhase4Edition(e));

  const snapshots: CityEditionSnapshot[] = editions.map((e) =>
    buildCitySnapshot(
      e.spec,
      {
        id: e.editionId,
        metro_key: e.metroKey,
        us_national_daily_id: e.usNationalDailyId,
        morning_edition: e.morningHero
          ? { morningHero: { artworkId: e.morningHero.artworkId } }
          : null,
        national_news: e.nationalNews,
        lead_story: e.leadStory,
        editorial_context: e.editorialContext,
        bandit: e.bandit,
        discovery: e.discovery ?? e.intelligence?.discovery,
      },
      e.sections.map((s) => ({
        section_type: s.section_type,
        headline: s.headline,
        body: s.body,
      }))
    )
  );

  const nationalParityIssues = verifyNationalParity(snapshots);
  const localDistinctIssues = verifyLocalDistinct(snapshots);

  const perSectionScorecard: Phase4ValidationReport["perSectionScorecard"] = {};
  for (const result of cityResults) {
    for (const card of result.sectionScorecards) {
      if (!perSectionScorecard[card.section]) {
        perSectionScorecard[card.section] = { passed: 0, failed: 0, total: 0 };
      }
      perSectionScorecard[card.section].total += 1;
      if (card.passed) perSectionScorecard[card.section].passed += 1;
      else perSectionScorecard[card.section].failed += 1;
    }
  }

  const duplicateContentFindings = cityResults.flatMap((r) =>
    r.findings.filter((f) => f.category.includes("duplicate"))
  );
  const missingContentFindings = cityResults.flatMap((r) =>
    r.findings.filter((f) => f.category.includes("missing"))
  );
  const incorrectImageFindings = cityResults.flatMap((r) =>
    r.findings.filter((f) => f.section === "images")
  );
  const incorrectLocationFindings = cityResults.flatMap((r) =>
    r.findings.filter(
      (f) =>
        f.category.includes("location") ||
        f.category.includes("bleed") ||
        f.category.includes("mismatch")
    )
  );

  const genMs = cityResults.map((r) => r.pipeline.generationMs).filter((n): n is number => n != null);
  const valMs = cityResults.map((r) => r.pipeline.validationMs).filter((n): n is number => n != null);
  const repMs = cityResults.map((r) => r.pipeline.repairMs).filter((n): n is number => n != null);
  const pubMs = cityResults.map((r) => r.pipeline.publishMs).filter((n): n is number => n != null);

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

  const launchBlockers = [
    ...cityResults.flatMap((r) =>
      r.findings.filter((f) => f.severity === "critical")
    ),
    ...nationalParityIssues.map((i) =>
      finding("critical", i.category, i.message, "national")
    ),
    ...localDistinctIssues.map((i) =>
      finding("critical", i.category, i.message, "general")
    ),
  ];

  const citiesPassed = cityResults.filter((r) => r.passed).length;
  const overallPassRate = cityResults.length ? citiesPassed / cityResults.length : 0;

  let recommendation: Phase4ValidationReport["recommendation"] = "ready_for_v1";
  if (launchBlockers.length > 0) {
    recommendation = "major_issues_remaining";
  } else if (
    cityResults.some((r) => r.findings.some((f) => f.severity === "high")) ||
    overallPassRate < 1
  ) {
    recommendation = "minor_issues_remaining";
  }

  return {
    generatedAt: new Date().toISOString(),
    editionDate,
    citiesRun: cityResults.length,
    citiesPassed,
    overallPassRate,
    perCityScorecard: cityResults.map((r) => ({
      label: r.label,
      metroKey: r.metroKey,
      passed: r.passed,
      score: r.score,
      criticalFindings: r.findings.filter((f) => f.severity === "critical").length,
    })),
    perSectionScorecard,
    duplicateContentFindings,
    missingContentFindings,
    incorrectImageFindings,
    incorrectLocationFindings,
    performanceMetrics: {
      averageGenerationMs: avg(genMs),
      averageValidationMs: avg(valMs),
      averageRepairMs: avg(repMs),
      averagePublishMs: avg(pubMs),
      totalPipelineMs:
        genMs.length > 0
          ? genMs.reduce((a, b) => a + b, 0) +
            (avg(valMs) ?? 0) +
            (avg(repMs) ?? 0) +
            (avg(pubMs) ?? 0)
          : null,
    },
    nationalParityIssues,
    localDistinctIssues,
    launchBlockers,
    recommendation,
    cityResults,
  };
}

export function formatPhase4Report(report: Phase4ValidationReport): string {
  const lines: string[] = [
    "# Edition Pipeline V2 — Phase 4 QA Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Edition date: ${report.editionDate}`,
    `Overall pass rate: ${(report.overallPassRate * 100).toFixed(1)}% (${report.citiesPassed}/${report.citiesRun} cities)`,
    "",
    "## 1. Per-city scorecard",
    ...report.perCityScorecard.map(
      (c) =>
        `- ${c.passed ? "PASS" : "FAIL"} ${c.label} (${c.metroKey}) — score ${c.score}${c.criticalFindings ? `, ${c.criticalFindings} critical` : ""}`
    ),
    "",
    "## 2. Per-section scorecard",
    ...Object.entries(report.perSectionScorecard).map(
      ([section, s]) => `- ${section}: ${s.passed}/${s.total} passed`
    ),
    "",
    "## 3. Duplicate content findings",
    ...(report.duplicateContentFindings.length
      ? report.duplicateContentFindings.map((f) => `- [${f.severity}] ${f.message}`)
      : ["- None"]),
    "",
    "## 4. Missing content findings",
    ...(report.missingContentFindings.length
      ? report.missingContentFindings.map((f) => `- [${f.severity}] ${f.message}`)
      : ["- None"]),
    "",
    "## 5. Incorrect image findings",
    ...(report.incorrectImageFindings.length
      ? report.incorrectImageFindings.map((f) => `- [${f.severity}] ${f.message}`)
      : ["- None"]),
    "",
    "## 6. Incorrect location findings",
    ...(report.incorrectLocationFindings.length
      ? report.incorrectLocationFindings.map((f) => `- [${f.severity}] ${f.message}`)
      : ["- None"]),
    "",
    "## 7. Performance metrics",
    `- Avg generation: ${report.performanceMetrics.averageGenerationMs ?? "n/a"}ms`,
    `- Avg validation: ${report.performanceMetrics.averageValidationMs ?? "n/a"}ms`,
    `- Avg repair: ${report.performanceMetrics.averageRepairMs ?? "n/a"}ms`,
    `- Avg publish: ${report.performanceMetrics.averagePublishMs ?? "n/a"}ms`,
    "",
    "## 8. Launch blockers",
    ...(report.launchBlockers.length
      ? report.launchBlockers.map((f) => `- [${f.severity}] ${f.message}`)
      : ["- None"]),
    "",
    "## 9. Recommendation",
    report.recommendation === "ready_for_v1"
      ? "**Ready for Version 1 launch**"
      : report.recommendation === "minor_issues_remaining"
        ? "**Minor issues remaining** — non-blocking warnings to triage"
        : "**Major issues remaining** — resolve launch blockers before ship",
  ];
  return lines.join("\n");
}

export { PHASE4_QA_CITIES };
