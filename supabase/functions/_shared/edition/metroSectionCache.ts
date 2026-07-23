/**
 * Metro / national section cache — query, persist, and log freshness decisions.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  SECTION_FRESHNESS_POLICIES,
  buildFreshnessDecision,
  cacheEditionDateForPolicy,
  computeRefreshAfter,
  isMetroSectionCacheValid,
  isSectionForceRefreshRequested,
  type FreshnessSectionType,
  type MetroSectionCacheRecord,
  type SectionFreshnessDecision,
} from "../../../../lib/edition/sectionFreshness.ts";
import {
  KINDRED_METRO_CACHE_VERSION,
  isMetroCacheVersionCurrent,
} from "../../../../lib/edition/metroCacheVersion.ts";
import {
  logMetroSectionHealth,
  type MetroSectionCacheStatus,
} from "../../../../lib/edition/editionSectionHealthLog.ts";

export type LoadMetroSectionCacheInput = {
  sectionType: FreshnessSectionType;
  metroKey?: string | null;
  editionDate: string;
  forceRefreshSections?: readonly string[] | null;
  traceId?: string | null;
};

export type SaveMetroSectionCacheInput = {
  sectionType: FreshnessSectionType;
  metroKey?: string | null;
  editionDate: string;
  payload: unknown;
  generationStatus?: "complete" | "partial" | "failed";
  validationStatus?: "valid" | "invalid" | "pending";
  contentVersion?: number;
};

function rowToRecord(row: Record<string, unknown>): MetroSectionCacheRecord {
  return {
    id: String(row.id),
    scope: row.scope as "metro" | "national",
    metro_key: (row.metro_key as string | null) ?? null,
    section_type: row.section_type as FreshnessSectionType,
    edition_date: (row.edition_date as string | null) ?? null,
    national_content_date: row.national_content_date
      ? String(row.national_content_date).slice(0, 10)
      : null,
    payload: row.payload,
    generated_at: String(row.generated_at),
    refresh_after: String(row.refresh_after),
    expires_at: row.expires_at ? String(row.expires_at) : null,
    generation_status: row.generation_status as MetroSectionCacheRecord["generation_status"],
    validation_status: row.validation_status as MetroSectionCacheRecord["validation_status"],
    content_version: Number(row.content_version ?? 1),
  };
}

export function logSectionFreshnessDecision(
  decision: SectionFreshnessDecision,
  traceId?: string | null,
  health?: {
    cache_status?: MetroSectionCacheStatus;
    cache_version?: number | null;
    item_count?: number | null;
    duration_ms?: number | null;
    error_code?: string | null;
    Claude_called?: boolean;
  }
): void {
  console.log("[sectionFreshness]", {
    traceId: traceId ?? null,
    section: decision.section,
    scope: decision.scope,
    metroKey: decision.metroKey,
    nationalContentDate: decision.nationalContentDate,
    existingContentFound: decision.existingContentFound,
    contentStillValid: decision.contentStillValid,
    claudeGenerationTriggered: decision.claudeGenerationTriggered,
    reason: decision.reason,
    previousGeneratedAt: decision.previousGeneratedAt,
    nextRefreshAfter: decision.nextRefreshAfter,
    forceRefresh: decision.forceRefresh,
  });
  logMetroSectionHealth({
    metro_key: decision.metroKey,
    section_type: decision.section,
    cache_status: health?.cache_status ?? (decision.contentStillValid ? "cache_hit_valid" : decision.existingContentFound ? "cache_expired_or_invalid" : "cache_miss"),
    generated_at: decision.previousGeneratedAt,
    refresh_after: decision.nextRefreshAfter,
    expires_at: decision.nextRefreshAfter,
    cache_version: health?.cache_version ?? null,
    item_count: health?.item_count ?? null,
    validation_status: decision.contentStillValid ? "valid" : null,
    Claude_called: health?.Claude_called ?? decision.claudeGenerationTriggered,
    reason: decision.reason,
    duration_ms: health?.duration_ms ?? null,
    error_code: health?.error_code ?? null,
    traceId,
  });
}

export async function loadValidMetroSectionCache(
  admin: SupabaseClient,
  input: LoadMetroSectionCacheInput
): Promise<{ record: MetroSectionCacheRecord | null; decision: SectionFreshnessDecision }> {
  const policy = SECTION_FRESHNESS_POLICIES[input.sectionType];
  const forceRefresh = isSectionForceRefreshRequested(
    input.sectionType,
    input.forceRefreshSections
  );
  const cacheEditionDate = cacheEditionDateForPolicy(policy, input.editionDate);
  const now = new Date();

  let query = admin
    .from("kindred_metro_section_cache")
    .select("*")
    .eq("section_type", input.sectionType);

  if (policy.scope === "metro") {
    if (!input.metroKey?.trim()) {
      const decision = buildFreshnessDecision({
        section: input.sectionType,
        metroKey: null,
        nationalContentDate: null,
        record: null,
        forceRefresh,
        claudeGenerationTriggered: false,
        reason: "missing_metro_key",
        now,
      });
      logSectionFreshnessDecision(decision, input.traceId);
      return { record: null, decision };
    }
    query = query
      .eq("scope", "metro")
      .eq("metro_key", input.metroKey)
      .eq("edition_date", cacheEditionDate);
  } else if (policy.scope === "national") {
    query = query
      .eq("scope", "national")
      .eq("national_content_date", input.editionDate);
  } else {
    const decision = buildFreshnessDecision({
      section: input.sectionType,
      metroKey: input.metroKey ?? null,
      nationalContentDate: input.editionDate,
      record: null,
      forceRefresh,
      claudeGenerationTriggered: false,
      reason: "no_cache_scope",
      now,
    });
    logSectionFreshnessDecision(decision, input.traceId);
    return { record: null, decision };
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn("[metroSectionCache] load failed", {
      section: input.sectionType,
      metroKey: input.metroKey ?? null,
      message: error.message,
    });
    const decision = buildFreshnessDecision({
      section: input.sectionType,
      metroKey: input.metroKey ?? null,
      nationalContentDate: input.editionDate,
      record: null,
      forceRefresh,
      claudeGenerationTriggered: false,
      reason: "cache_query_error",
      now,
    });
    logSectionFreshnessDecision(decision, input.traceId);
    return { record: null, decision };
  }

  const record = data ? rowToRecord(data as Record<string, unknown>) : null;

  let stillValid = Boolean(record) && !forceRefresh;
  let reason: string;
  if (forceRefresh) {
    reason = "force_refresh_requested";
  } else if (!record) {
    reason = "cache_miss";
  } else if (!isMetroCacheVersionCurrent(record.content_version)) {
    stillValid = false;
    reason = "cache_version_mismatch";
    logMetroSectionHealth({
      metro_key: input.metroKey ?? null,
      section_type: input.sectionType,
      cache_status: "cache_version_mismatch",
      generated_at: record.generated_at,
      refresh_after: record.refresh_after,
      expires_at: record.expires_at,
      cache_version: record.content_version,
      item_count: null,
      validation_status: record.validation_status,
      Claude_called: false,
      reason: `stored_version_${record.content_version}_expected_${KINDRED_METRO_CACHE_VERSION}`,
      duration_ms: null,
      error_code: null,
      traceId: input.traceId,
    });
  } else if (isMetroSectionCacheValid(record, now)) {
    stillValid = true;
    reason = "cache_hit_valid";
  } else {
    reason = "cache_expired_or_invalid";
  }

  const decision = buildFreshnessDecision({
    section: input.sectionType,
    metroKey: input.metroKey ?? null,
    nationalContentDate: input.editionDate,
    record,
    forceRefresh,
    claudeGenerationTriggered: false,
    reason,
    now,
  });
  logSectionFreshnessDecision(decision, input.traceId, {
    cache_status: reason as MetroSectionCacheStatus,
    cache_version: record?.content_version ?? null,
  });

  return {
    record: stillValid ? record : null,
    decision,
  };
}

export async function saveMetroSectionCache(
  admin: SupabaseClient,
  input: SaveMetroSectionCacheInput
): Promise<void> {
  const policy = SECTION_FRESHNESS_POLICIES[input.sectionType];
  const generatedAt = new Date();
  const refreshAfter = computeRefreshAfter(policy, generatedAt, input.editionDate);
  const cacheEditionDate = cacheEditionDateForPolicy(policy, input.editionDate, generatedAt);

  const baseRow: Record<string, unknown> = {
    scope: policy.scope === "national" ? "national" : "metro",
    metro_key: policy.scope === "metro" ? input.metroKey ?? null : null,
    section_type: input.sectionType,
    edition_date: policy.scope === "metro" ? cacheEditionDate : null,
    national_content_date:
      policy.scope === "national" ? input.editionDate : null,
    payload: input.payload,
    generated_at: generatedAt.toISOString(),
    refresh_after: refreshAfter.toISOString(),
    expires_at: refreshAfter.toISOString(),
    generation_status: input.generationStatus ?? "complete",
    validation_status: input.validationStatus ?? "valid",
    content_version: input.contentVersion ?? KINDRED_METRO_CACHE_VERSION,
    updated_at: generatedAt.toISOString(),
  };

  let existingQuery = admin
    .from("kindred_metro_section_cache")
    .select("id")
    .eq("section_type", input.sectionType);

  if (policy.scope === "metro") {
    existingQuery = existingQuery
      .eq("scope", "metro")
      .eq("metro_key", input.metroKey ?? "")
      .eq("edition_date", cacheEditionDate);
  } else if (policy.scope === "national") {
    existingQuery = existingQuery
      .eq("scope", "national")
      .eq("national_content_date", input.editionDate);
  } else {
    return;
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) {
    console.warn("[metroSectionCache] lookup before save failed", {
      section: input.sectionType,
      metroKey: input.metroKey ?? null,
      message: existingError.message,
    });
    return;
  }

  if (existing?.id) {
    const { error } = await admin
      .from("kindred_metro_section_cache")
      .update(baseRow)
      .eq("id", existing.id);
    if (error) {
      console.warn("[metroSectionCache] update failed", {
        section: input.sectionType,
        metroKey: input.metroKey ?? null,
        message: error.message,
      });
    }
    return;
  }

  const { error } = await admin.from("kindred_metro_section_cache").insert(baseRow);
  if (error) {
    console.warn("[metroSectionCache] insert failed", {
      section: input.sectionType,
      metroKey: input.metroKey ?? null,
      message: error.message,
    });
  }
}

/** Whether live refresh may skip Claude for local events today. */
export async function isLocalEventsMetroCacheValidToday(
  admin: SupabaseClient,
  metroKey: string,
  editionDate: string
): Promise<boolean> {
  const { record } = await loadValidMetroSectionCache(admin, {
    sectionType: "local_events",
    metroKey,
    editionDate,
  });
  return Boolean(record);
}
