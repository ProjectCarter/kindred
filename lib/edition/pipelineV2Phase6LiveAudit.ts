/**
 * Edition Pipeline V2 Phase 6 — read-only live production validation & launch sign-off.
 * Consumes persisted Supabase edition/job rows; never mutates production data.
 */

import {
  PHASE4_QA_CITIES,
  phase4CityByMetroKey,
  type Phase4CitySpec,
} from "./pipelineV2Phase4Cities.ts";
import {
  auditPhase4Edition,
  runPhase4ValidationSuite,
  type Phase4EditionInput,
  type Phase4Finding,
  type Phase4ValidationReport,
} from "./pipelineV2Phase4QA.ts";
import {
  buildCitySnapshot,
  detectCityBleed,
  verifyLocalDistinct,
  verifyNationalParity,
  type AuditIssue,
} from "./nationwideAudit.ts";
import {
  extractTimingFromStageTimings,
  readPipelineHealthFromBuildState,
  readPipelineStageTimings,
} from "./editionPipelineHealth.ts";
import { readValidationFromBuildState } from "./editionValidationTypes.ts";
import {
  isPublicationEligibleForRepairFlow,
  MAX_AUTOMATIC_REPAIR_ATTEMPTS_PER_STAGE,
} from "./sectionRepair.ts";
import type { EditionSection } from "./types.ts";
import type { LeadStory } from "./LeadStory.ts";
import type { NationalNewsPackage } from "./nationalNewsTypes.ts";
import type { MorningHeroExperience } from "./heroArtwork/types.ts";

export const NOT_RECORDED = "NOT RECORDED" as const;

export type RecordedMetric = number | typeof NOT_RECORDED;

export type Phase6LaunchVerdict = "PASS" | "WARNING" | "FAIL";

export type Phase6EnvironmentStatus = {
  ok: boolean;
  missing: string[];
  supabaseUrlPresent: boolean;
  serviceRoleKeyPresent: boolean;
  auditUserIdPresent: boolean;
};

export type Phase6EditionResolution = {
  found: boolean;
  requestedEditionDate: string;
  actualEditionDate: string | null;
  isStaleEdition: boolean;
  staleReason: string | null;
  editionId: string | null;
  editionStatus: string | null;
};

export type Phase6PerformanceRecord = {
  generationMs: RecordedMetric;
  validationMs: RecordedMetric;
  publishMs: RecordedMetric;
  repairMs: RecordedMetric;
  totalMs: RecordedMetric;
  healthScore: RecordedMetric;
  repairStageCount: RecordedMetric;
  blockingFailures: string[];
  warnings: string[];
};

export type Phase6RepairAudit = {
  repairCount: number;
  repairedStages: string[];
  fullEditionRegenerationDetected: boolean;
  repairLimitExceeded: boolean;
  repairLimitDetails: string[];
  passed: boolean;
};

export type Phase6ValidationRepairReport = {
  validationStatus: string | null;
  publicationDecisionAllowed: boolean | null;
  editionStatusReady: boolean;
  statusAgrees: boolean;
  validationBlockingFailures: string[];
  validationWarnings: string[];
};

export type Phase6CityLiveResult = {
  label: string;
  metroKey: string;
  resolution: Phase6EditionResolution;
  cityVerdict: Phase6LaunchVerdict;
  qaPassed: boolean | null;
  qaScore: number | null;
  performance: Phase6PerformanceRecord;
  repairAudit: Phase6RepairAudit | null;
  validationRepair: Phase6ValidationRepairReport | null;
  phase6Findings: Phase6Finding[];
  launchBlockers: Phase6Finding[];
  warnings: Phase6Finding[];
};

export type Phase6Finding = {
  severity: "blocking" | "warning" | "info";
  category: string;
  message: string;
  publicationTier: "blocking" | "warning" | "non_blocking" | "infrastructure";
};

export type Phase6LiveAuditReport = {
  generatedAt: string;
  mode: "live";
  requestedEditionDate: string;
  environment: Phase6EnvironmentStatus;
  citiesRequested: number;
  citiesWithEditions: number;
  citiesMissingEditions: number;
  overallVerdict: Phase6LaunchVerdict;
  phase4Report: Phase4ValidationReport | null;
  perCityResults: Phase6CityLiveResult[];
  nationalParityIssues: AuditIssue[];
  crossCityBleedIssues: Phase6Finding[];
  imageQualityFindings: Phase6Finding[];
  performanceSummary: {
    averageGenerationMs: RecordedMetric;
    averageValidationMs: RecordedMetric;
    averagePublishMs: RecordedMetric;
    averageTotalMs: RecordedMetric;
    averageHealthScore: RecordedMetric;
  };
  validationRepairSummary: {
    allStatusAgree: boolean;
    anyFullRegeneration: boolean;
    anyRepairLimitExceeded: boolean;
  };
  launchBlockers: Phase6Finding[];
  warnings: Phase6Finding[];
  aiCalls: 0;
  contentGenerationCalls: 0;
  writeOperations: 0;
};

export type LiveEditionRow = {
  id: string;
  metro_key: string;
  edition_date: string;
  status: string;
  lead_story: LeadStory | null;
  national_news: NationalNewsPackage | null;
  bandit: unknown;
  discovery: unknown;
  editorial_context: unknown;
  us_national_daily_id: string | null;
  morning_edition: { morningHero?: MorningHeroExperience } | null;
  history_around_town: unknown;
};

export type LiveGenerationJobRow = {
  id: string;
  status: string;
  build_state: Record<string, unknown> | null;
  stage_diagnostics: unknown[] | null;
  completed_stages: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ReadOnlySupabaseAuditClient = {
  from: (table: string) => unknown;
  rpc: (...args: unknown[]) => never;
};

const WRITE_METHODS = new Set(["insert", "update", "delete", "upsert"]);

const CONTENT_STAGES = [
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

export function assessPhase6Environment(
  env: NodeJS.ProcessEnv = process.env
): Phase6EnvironmentStatus {
  const missing: string[] = [];
  const supabaseUrlPresent = Boolean(
    env.SUPABASE_URL?.trim() || env.EXPO_PUBLIC_SUPABASE_URL?.trim()
  );
  const serviceRoleKeyPresent = Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const auditUserIdPresent = Boolean(env.AUDIT_USER_ID?.trim());

  if (!supabaseUrlPresent) missing.push("SUPABASE_URL");
  if (!serviceRoleKeyPresent) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!auditUserIdPresent) missing.push("AUDIT_USER_ID");

  return {
    ok: missing.length === 0,
    missing,
    supabaseUrlPresent,
    serviceRoleKeyPresent,
    auditUserIdPresent,
  };
}

/** Wrap a Supabase client so mutation methods throw immediately. */
export function wrapReadOnlySupabaseClient<
  T extends { from: (table: string) => unknown; rpc?: (...args: unknown[]) => unknown },
>(client: T): ReadOnlySupabaseAuditClient {
  const guardChain = (target: Record<string, unknown>, table: string): unknown =>
    new Proxy(target, {
      get(innerTarget, innerProp, innerReceiver) {
        if (WRITE_METHODS.has(String(innerProp))) {
          throw new Error(
            `Phase 6 live audit is read-only: .${String(innerProp)}() on ${table} blocked`
          );
        }
        const value = Reflect.get(innerTarget, innerProp, innerReceiver);
        if (typeof value === "function") {
          return (...args: unknown[]) => {
            const result = value.apply(innerTarget, args);
            if (result && typeof result === "object") {
              return guardChain(result as Record<string, unknown>, table);
            }
            return result;
          };
        }
        return value;
      },
    });

  return {
    from(table: string) {
      const query = client.from(table) as Record<string, unknown>;
      return guardChain(query, table);
    },
    rpc() {
      throw new Error("Phase 6 live audit is read-only: rpc() blocked");
    },
  };
}

export function parseAuditCityFilter(raw: string | undefined): Phase4CitySpec[] {
  if (!raw?.trim()) return [...PHASE4_QA_CITIES];
  const keys = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const specs = keys
    .map(
      (key) =>
        phase4CityByMetroKey(key) ??
        PHASE4_QA_CITIES.find((c) => c.label.toLowerCase() === key)
    )
    .filter((s): s is Phase4CitySpec => Boolean(s));
  return specs.length ? specs : [...PHASE4_QA_CITIES];
}

export function resolveEditionDatePreference(
  requestedDate: string,
  actualDate: string | null
): Pick<Phase6EditionResolution, "isStaleEdition" | "staleReason"> {
  if (!actualDate) {
    return { isStaleEdition: false, staleReason: "no ready edition found" };
  }
  if (actualDate === requestedDate) {
    return { isStaleEdition: false, staleReason: null };
  }
  return {
    isStaleEdition: true,
    staleReason: `requested ${requestedDate}, using newest available ${actualDate}`,
  };
}

export function metricOrNotRecorded(value: number | null | undefined): RecordedMetric {
  return value != null && Number.isFinite(value) ? value : NOT_RECORDED;
}

export function buildPerformanceRecord(input: {
  buildState: Record<string, unknown> | null | undefined;
}): Phase6PerformanceRecord {
  const timings = readPipelineStageTimings(input.buildState ?? {});
  const timing = extractTimingFromStageTimings(timings);
  const health = readPipelineHealthFromBuildState(input.buildState ?? {})?.latest;
  const validation = readValidationFromBuildState(input.buildState ?? {});

  const repairStages = new Set<string>();
  for (const record of validation?.repairHistory ?? []) {
    for (const stage of record.stages) repairStages.add(stage);
  }

  return {
    generationMs: metricOrNotRecorded(timing.generationMs),
    validationMs: metricOrNotRecorded(
      timing.validationMs ??
        validation?.latestReport?.durationMs ??
        health?.timing.validationMs
    ),
    publishMs: metricOrNotRecorded(timing.publishMs ?? health?.timing.publishMs),
    repairMs: NOT_RECORDED,
    totalMs: metricOrNotRecorded(timing.totalMs ?? health?.timing.totalMs),
    healthScore: metricOrNotRecorded(health?.healthScore),
    repairStageCount: metricOrNotRecorded(
      repairStages.size || validation?.repairHistory.length
    ),
    blockingFailures:
      health?.blockingFailures ?? validation?.latestReport?.blockingFailures ?? [],
    warnings: health?.warnings ?? validation?.latestReport?.warnings ?? [],
  };
}

export function auditRepairHistory(
  buildState: Record<string, unknown> | null | undefined
): Phase6RepairAudit {
  const validation = readValidationFromBuildState(buildState ?? {});
  const repairHistory = validation?.repairHistory ?? [];
  const repairAttempts = validation?.repairAttempts ?? {};
  const repairedStages = [...new Set(repairHistory.flatMap((r) => r.stages))];

  const repairLimitDetails: string[] = [];
  for (const [stage, count] of Object.entries(repairAttempts)) {
    if (count > MAX_AUTOMATIC_REPAIR_ATTEMPTS_PER_STAGE) {
      repairLimitDetails.push(
        `${stage}: ${count} attempts (limit ${MAX_AUTOMATIC_REPAIR_ATTEMPTS_PER_STAGE})`
      );
    }
  }

  const fullEditionRegenerationDetected =
    repairedStages.includes("initialize_edition") ||
    CONTENT_STAGES.filter((s) => repairedStages.includes(s)).length >=
      CONTENT_STAGES.length - 1;

  const repairLimitExceeded = repairLimitDetails.length > 0;

  return {
    repairCount: repairHistory.filter((r) => !r.unresolved).length,
    repairedStages,
    fullEditionRegenerationDetected,
    repairLimitExceeded,
    repairLimitDetails,
    passed: !fullEditionRegenerationDetected && !repairLimitExceeded,
  };
}

export function auditValidationPublicationAgreement(input: {
  editionStatus: string | null;
  buildState: Record<string, unknown> | null | undefined;
}): Phase6ValidationRepairReport {
  const validation = readValidationFromBuildState(input.buildState ?? {});
  const report = validation?.latestReport ?? null;
  const publicationAllowed = validation?.publicationDecision?.allowed ?? null;
  const editionStatusReady = input.editionStatus === "ready";
  const validationEligible = report ? isPublicationEligibleForRepairFlow(report) : false;

  const statusAgrees =
    editionStatusReady &&
    validationEligible &&
    publicationAllowed === true &&
    (report?.overallStatus === "PASS" || report?.overallStatus === "WARNING");

  return {
    validationStatus: report?.overallStatus ?? null,
    publicationDecisionAllowed: publicationAllowed,
    editionStatusReady,
    statusAgrees,
    validationBlockingFailures: report?.blockingFailures ?? [],
    validationWarnings: report?.warnings ?? [],
  };
}

function phase6Finding(
  severity: Phase6Finding["severity"],
  category: string,
  message: string,
  publicationTier: Phase6Finding["publicationTier"] = "infrastructure"
): Phase6Finding {
  return { severity, category, message, publicationTier };
}

function deskTierForSection(section: string): Phase6Finding["publicationTier"] {
  switch (section) {
    case "local_events":
    case "activities":
    case "food_drinks":
      return "blocking";
    case "weather":
    case "story_of":
    case "local_news":
    case "national_news":
      return "warning";
    case "masterpiece":
    case "today_in_history":
    case "history_around_town":
    case "bandits_pick":
      return "non_blocking";
    default:
      return "infrastructure";
  }
}

export function auditHistoryAroundTown(
  spec: Phase4CitySpec,
  historyAroundTown: unknown
): Phase6Finding[] {
  const findings: Phase6Finding[] = [];
  if (!historyAroundTown || typeof historyAroundTown !== "object") {
    findings.push(
      phase6Finding(
        "warning",
        "history_around_town_missing",
        `${spec.label}: History Around Town payload absent (non-blocking)`,
        "non_blocking"
      )
    );
    return findings;
  }
  const payload = historyAroundTown as { metroKey?: string; places?: unknown[] };
  if (
    payload.metroKey &&
    payload.metroKey !== spec.expectedMetroKey &&
    payload.metroKey !== spec.catalogMetroKey
  ) {
    findings.push(
      phase6Finding(
        "warning",
        "history_around_town_metro_mismatch",
        `${spec.label}: History Around Town metro ${payload.metroKey} ≠ ${spec.expectedMetroKey}`,
        "non_blocking"
      )
    );
  }
  return findings;
}

export function auditGreetingWeatherCityMatch(
  spec: Phase4CitySpec,
  sections: EditionSection[]
): Phase6Finding[] {
  const findings: Phase6Finding[] = [];
  const greeting = sections.find((s) => s.section_type === "greeting");
  const weather = sections.find((s) => s.section_type === "weather");
  const cityPattern = new RegExp(spec.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  if (
    greeting?.headline &&
    !cityPattern.test(greeting.headline) &&
    !cityPattern.test(greeting.body ?? "")
  ) {
    findings.push(
      phase6Finding(
        "warning",
        "greeting_city_mismatch",
        `${spec.label}: greeting may not reference ${spec.city}`,
        "warning"
      )
    );
  }
  if (
    weather?.headline &&
    !cityPattern.test(weather.headline) &&
    !cityPattern.test(weather.body ?? "")
  ) {
    findings.push(
      phase6Finding(
        "warning",
        "weather_city_mismatch",
        `${spec.label}: weather headline/body may not reference ${spec.city}`,
        "warning"
      )
    );
  }
  return findings;
}

export function mapPhase4FindingsToPhase6(findings: Phase4Finding[]): Phase6Finding[] {
  return findings.map((f) => {
    const tier = f.section ? deskTierForSection(f.section) : "infrastructure";
    let severity: Phase6Finding["severity"] = "info";
    if (f.severity === "critical" || (f.severity === "high" && tier === "blocking")) {
      severity = "blocking";
    } else if (f.severity === "high" || f.severity === "medium") {
      severity = tier === "blocking" ? "blocking" : "warning";
    } else {
      severity = "warning";
    }
    return phase6Finding(severity, f.category, f.message, tier);
  });
}

export function buildPhase4InputFromLiveRows(input: {
  spec: Phase4CitySpec;
  edition: LiveEditionRow;
  sections: EditionSection[];
  job: LiveGenerationJobRow | null;
  resolution: Phase6EditionResolution;
}): Phase4EditionInput {
  const buildState = (input.job?.build_state ?? {}) as Record<string, unknown>;
  const validation = readValidationFromBuildState(buildState);
  const timings = readPipelineStageTimings(buildState);
  const timing = extractTimingFromStageTimings(timings);
  const latestRepair = validation?.latestRepair;

  return {
    spec: input.spec,
    editionDate: input.resolution.actualEditionDate ?? input.resolution.requestedEditionDate,
    metroKey: input.edition.metro_key,
    editionId: input.edition.id,
    sections: input.sections,
    leadStory: input.edition.lead_story,
    nationalNews: input.edition.national_news,
    bandit: input.edition.bandit,
    intelligence: null,
    morningHero: input.edition.morning_edition?.morningHero ?? null,
    usNationalDailyId: input.edition.us_national_daily_id,
    editorialContext: input.edition.editorial_context,
    discovery: input.edition.discovery,
    pipeline: {
      generationMs: timing.generationMs,
      validationMs: timing.validationMs ?? validation?.latestReport?.durationMs ?? null,
      publishMs: timing.publishMs,
      repairMs: null,
      validationStatus: validation?.latestReport?.overallStatus ?? null,
      repairStagesRequeued: latestRepair?.stages ?? [],
      fullEditionRegeneration: false,
      buildState,
      validationReport: validation?.latestReport ?? undefined,
    },
  };
}

export function auditLiveCity(input: {
  spec: Phase4CitySpec;
  resolution: Phase6EditionResolution;
  edition: LiveEditionRow | null;
  sections: EditionSection[];
  job: LiveGenerationJobRow | null;
}): Phase6CityLiveResult {
  const base: Phase6CityLiveResult = {
    label: input.spec.label,
    metroKey: input.spec.expectedMetroKey,
    resolution: input.resolution,
    cityVerdict: "FAIL",
    qaPassed: null,
    qaScore: null,
    performance: {
      generationMs: NOT_RECORDED,
      validationMs: NOT_RECORDED,
      publishMs: NOT_RECORDED,
      repairMs: NOT_RECORDED,
      totalMs: NOT_RECORDED,
      healthScore: NOT_RECORDED,
      repairStageCount: NOT_RECORDED,
      blockingFailures: [],
      warnings: [],
    },
    repairAudit: null,
    validationRepair: null,
    phase6Findings: [],
    launchBlockers: [],
    warnings: [],
  };

  if (!input.resolution.found || !input.edition) {
    const missing = phase6Finding(
      "blocking",
      "edition_missing",
      `${input.spec.label} (${input.spec.expectedMetroKey}): no ready edition for ${input.resolution.requestedEditionDate}`,
      "infrastructure"
    );
    base.phase6Findings.push(missing);
    base.launchBlockers.push(missing);
    return base;
  }

  if (input.resolution.isStaleEdition && input.resolution.staleReason) {
    base.warnings.push(
      phase6Finding(
        "warning",
        "stale_edition",
        `${input.spec.label}: ${input.resolution.staleReason}`,
        "infrastructure"
      )
    );
  }

  const buildState = (input.job?.build_state ?? {}) as Record<string, unknown>;
  base.performance = buildPerformanceRecord({ buildState });
  base.repairAudit = auditRepairHistory(buildState);
  base.validationRepair = auditValidationPublicationAgreement({
    editionStatus: input.edition.status,
    buildState,
  });

  base.phase6Findings.push(
    ...auditHistoryAroundTown(input.spec, input.edition.history_around_town)
  );
  base.phase6Findings.push(...auditGreetingWeatherCityMatch(input.spec, input.sections));

  if (base.repairAudit.fullEditionRegenerationDetected) {
    base.launchBlockers.push(
      phase6Finding(
        "blocking",
        "full_edition_regeneration",
        `${input.spec.label}: repair history indicates full-edition regeneration`,
        "infrastructure"
      )
    );
  }
  if (base.repairAudit.repairLimitExceeded) {
    base.launchBlockers.push(
      phase6Finding(
        "blocking",
        "repair_limit_exceeded",
        `${input.spec.label}: ${base.repairAudit.repairLimitDetails.join("; ")}`,
        "infrastructure"
      )
    );
  }
  if (base.validationRepair && !base.validationRepair.statusAgrees) {
    base.warnings.push(
      phase6Finding(
        "warning",
        "publication_validation_mismatch",
        `${input.spec.label}: edition status=${input.edition.status}, validation=${base.validationRepair.validationStatus}, publicationDecision=${base.validationRepair.publicationDecisionAllowed}`,
        "infrastructure"
      )
    );
  }

  const qaInput = buildPhase4InputFromLiveRows({
    spec: input.spec,
    edition: input.edition,
    sections: input.sections,
    job: input.job,
    resolution: input.resolution,
  });
  const qa = auditPhase4Edition(qaInput);
  base.qaPassed = qa.passed;
  base.qaScore = qa.score;
  base.phase6Findings.push(...mapPhase4FindingsToPhase6(qa.findings));

  for (const f of base.phase6Findings) {
    if (f.severity === "blocking") base.launchBlockers.push(f);
    else if (f.severity === "warning") base.warnings.push(f);
  }

  const hasBlocking = base.launchBlockers.length > 0;
  const hasWarnings = base.warnings.length > 0;
  base.cityVerdict = hasBlocking ? "FAIL" : hasWarnings ? "WARNING" : "PASS";

  return base;
}

function averageRecorded(values: RecordedMetric[]): RecordedMetric {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (!nums.length) return NOT_RECORDED;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function runPhase6LiveAudit(input: {
  requestedEditionDate: string;
  cities: Phase4CitySpec[];
  cityResults: Phase6CityLiveResult[];
  environment: Phase6EnvironmentStatus;
  phase4Inputs: Phase4EditionInput[];
}): Phase6LiveAuditReport {
  const phase4Report =
    input.phase4Inputs.length > 0
      ? runPhase4ValidationSuite(input.phase4Inputs, input.requestedEditionDate)
      : null;

  const snapshots = input.phase4Inputs.map((e) =>
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
        discovery: e.discovery,
      },
      e.sections.map((s) => ({
        section_type: s.section_type,
        headline: s.headline,
        body: s.body,
      }))
    )
  );

  const nationalParityIssues =
    snapshots.length >= 2 ? verifyNationalParity(snapshots) : [];
  const localDistinctIssues =
    snapshots.length >= 2 ? verifyLocalDistinct(snapshots) : [];

  const crossCityBleedIssues: Phase6Finding[] = [];
  for (const editionInput of input.phase4Inputs) {
    const localText = JSON.stringify({
      sections: editionInput.sections,
      leadStory: editionInput.leadStory,
      discovery: editionInput.discovery,
    });
    crossCityBleedIssues.push(
      ...detectCityBleed(editionInput.spec, localText).map((i) =>
        phase6Finding(
          i.severity === "critical" ? "blocking" : "warning",
          i.category,
          i.message,
          "blocking"
        )
      )
    );
  }

  const imageQualityFindings: Phase6Finding[] = phase4Report
    ? mapPhase4FindingsToPhase6(
        phase4Report.incorrectImageFindings.map((f) => ({ ...f, section: "images" }))
      )
    : [];

  const launchBlockers = [
    ...input.cityResults.flatMap((c) => c.launchBlockers),
    ...nationalParityIssues.map((i) =>
      phase6Finding("blocking", i.category, i.message, "infrastructure")
    ),
    ...localDistinctIssues
      .filter((i) => i.severity === "critical")
      .map((i) => phase6Finding("blocking", i.category, i.message, "infrastructure")),
    ...crossCityBleedIssues.filter((f) => f.severity === "blocking"),
  ];

  const warnings = [
    ...input.cityResults.flatMap((c) => c.warnings),
    ...crossCityBleedIssues.filter((f) => f.severity === "warning"),
    ...imageQualityFindings.filter((f) => f.severity === "warning"),
  ];

  const perf = input.cityResults.map((c) => c.performance);
  const citiesMissing = input.cityResults.filter((c) => !c.resolution.found).length;

  let overallVerdict: Phase6LaunchVerdict = "PASS";
  if (!input.environment.ok || citiesMissing > 0 || launchBlockers.length > 0) {
    overallVerdict = "FAIL";
  } else if (warnings.length > 0) {
    overallVerdict = "WARNING";
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: "live",
    requestedEditionDate: input.requestedEditionDate,
    environment: input.environment,
    citiesRequested: input.cities.length,
    citiesWithEditions: input.cityResults.filter((c) => c.resolution.found).length,
    citiesMissingEditions: citiesMissing,
    overallVerdict,
    phase4Report,
    perCityResults: input.cityResults,
    nationalParityIssues,
    crossCityBleedIssues,
    imageQualityFindings,
    performanceSummary: {
      averageGenerationMs: averageRecorded(perf.map((p) => p.generationMs)),
      averageValidationMs: averageRecorded(perf.map((p) => p.validationMs)),
      averagePublishMs: averageRecorded(perf.map((p) => p.publishMs)),
      averageTotalMs: averageRecorded(perf.map((p) => p.totalMs)),
      averageHealthScore: averageRecorded(perf.map((p) => p.healthScore)),
    },
    validationRepairSummary: {
      allStatusAgree: input.cityResults.every(
        (c) => !c.validationRepair || c.validationRepair.statusAgrees
      ),
      anyFullRegeneration: input.cityResults.some(
        (c) => c.repairAudit?.fullEditionRegenerationDetected
      ),
      anyRepairLimitExceeded: input.cityResults.some(
        (c) => c.repairAudit?.repairLimitExceeded
      ),
    },
    launchBlockers,
    warnings,
    aiCalls: 0,
    contentGenerationCalls: 0,
    writeOperations: 0,
  };
}

export function formatPhase6LaunchReport(report: Phase6LiveAuditReport): string {
  const lines: string[] = [
    "# Edition Pipeline V2 — Phase 6 Live Production Launch Sign-Off",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Requested edition date: ${report.requestedEditionDate}`,
    `Overall verdict: **${report.overallVerdict}**`,
    "",
    "## Environment",
    report.environment.ok
      ? "- Credentials: OK (read-only audit)"
      : `- Credentials: MISSING — ${report.environment.missing.join(", ")}`,
    "",
    "## Per-city scorecard",
    ...report.perCityResults.map((c) => {
      const dateLabel = c.resolution.actualEditionDate ?? "none";
      const stale = c.resolution.isStaleEdition ? " (STALE)" : "";
      const health =
        c.performance.healthScore !== NOT_RECORDED
          ? `, health ${c.performance.healthScore}`
          : "";
      const score = c.qaScore != null ? `, QA score ${c.qaScore}` : "";
      return `- ${c.cityVerdict} ${c.label} (${c.metroKey}) — edition ${dateLabel}${stale}${score}${health}`;
    }),
    "",
    "## Per-section scorecard",
    ...(report.phase4Report
      ? Object.entries(report.phase4Report.perSectionScorecard).map(
          ([section, s]) => `- ${section}: ${s.passed}/${s.total} passed`
        )
      : ["- NOT RECORDED (no live editions loaded)"]),
    "",
    "## National content parity",
    ...(report.nationalParityIssues.length
      ? report.nationalParityIssues.map((i) => `- [${i.severity}] ${i.message}`)
      : ["- PASS — shared national fingerprints match across audited cities"]),
    "",
    "## Cross-city bleed",
    ...(report.crossCityBleedIssues.length
      ? report.crossCityBleedIssues.map((f) => `- [${f.severity}] ${f.message}`)
      : ["- None detected"]),
    "",
    "## Image quality",
    ...(report.imageQualityFindings.length
      ? report.imageQualityFindings.map((f) => `- [${f.severity}] ${f.message}`)
      : ["- None flagged"]),
    "",
    "## Performance (live recorded only — no estimates)",
    `- Avg generation: ${report.performanceSummary.averageGenerationMs}`,
    `- Avg validation: ${report.performanceSummary.averageValidationMs}`,
    `- Avg publish: ${report.performanceSummary.averagePublishMs}`,
    `- Avg total: ${report.performanceSummary.averageTotalMs}`,
    `- Avg health score: ${report.performanceSummary.averageHealthScore}`,
    "",
    "## Validation & repair history",
    `- Publication/validation agreement: ${report.validationRepairSummary.allStatusAgree ? "PASS" : "MISMATCH (see warnings)"}`,
    `- Full-edition regeneration detected: ${report.validationRepairSummary.anyFullRegeneration ? "YES" : "no"}`,
    `- Repair limit exceeded: ${report.validationRepairSummary.anyRepairLimitExceeded ? "YES" : "no"}`,
    "",
    "## Launch blockers",
    ...(report.launchBlockers.length
      ? report.launchBlockers.map(
          (f) => `- [${f.severity}/${f.publicationTier}] ${f.message}`
        )
      : ["- None"]),
    "",
    "## Warnings (publish allowed under V1 severity)",
    ...(report.warnings.length
      ? report.warnings.slice(0, 30).map((f) => `- [${f.publicationTier}] ${f.message}`)
      : ["- None"]),
    "",
    "## Audit integrity",
    "- AI calls: 0",
    "- Content generation calls: 0",
    "- Write operations: 0",
    `- Cities missing editions: ${report.citiesMissingEditions}/${report.citiesRequested}`,
  ];
  return lines.join("\n");
}
