/**
 * Structured edition health logs for metro section cache decisions.
 * Feeds future Edition Health dashboard — no UI in V1.
 */

import type { FreshnessSectionType } from "./sectionFreshness.ts";

export type MetroSectionCacheStatus =
  | "cache_hit_valid"
  | "cache_miss"
  | "cache_expired_or_invalid"
  | "cache_version_mismatch"
  | "force_refresh_requested"
  | "section_disabled"
  | "skipped"
  | "generated"
  | "saved"
  | "error";

export type MetroSectionHealthLogEntry = {
  metro_key: string | null;
  section_type: FreshnessSectionType | string;
  cache_status: MetroSectionCacheStatus;
  generated_at: string | null;
  refresh_after: string | null;
  expires_at: string | null;
  cache_version: number | null;
  item_count: number | null;
  validation_status: string | null;
  Claude_called: boolean;
  reason: string;
  duration_ms: number | null;
  error_code: string | null;
  traceId?: string | null;
};

export function logMetroSectionHealth(entry: MetroSectionHealthLogEntry): void {
  console.log("[editionHealth]", {
    metro_key: entry.metro_key,
    section_type: entry.section_type,
    cache_status: entry.cache_status,
    generated_at: entry.generated_at,
    refresh_after: entry.refresh_after,
    expires_at: entry.expires_at,
    cache_version: entry.cache_version,
    item_count: entry.item_count,
    validation_status: entry.validation_status,
    Claude_called: entry.Claude_called,
    reason: entry.reason,
    duration_ms: entry.duration_ms,
    error_code: entry.error_code,
    traceId: entry.traceId ?? null,
  });
}
