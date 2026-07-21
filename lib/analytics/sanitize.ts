import type { AnalyticsEventProperties } from "./types";

const MAX_TEXT = 240;
const MAX_METADATA_KEYS = 12;
const MAX_METADATA_JSON = 2048;

const BLOCKED_METADATA_KEYS = new Set([
  "email",
  "name",
  "lat",
  "lon",
  "latitude",
  "longitude",
  "gps",
  "coordinates",
  "address",
  "phone",
  "message",
  "url",
  "sourceUrl",
  "source_url",
]);

export function truncateText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_TEXT);
}

/** Store hostname only — never path or query parameters. */
export function extractDestinationDomain(
  url: string | null | undefined
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (BLOCKED_METADATA_KEYS.has(key)) continue;
    if (Object.keys(out).length >= MAX_METADATA_KEYS) break;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] =
        typeof value === "string" ? value.slice(0, MAX_TEXT) : value;
    }
  }
  if (JSON.stringify(out).length > MAX_METADATA_JSON) return {};
  return out;
}

export function sanitizeEventProperties(
  properties: AnalyticsEventProperties = {}
): AnalyticsEventProperties {
  return {
    edition_date: truncateText(properties.edition_date),
    city: truncateText(properties.city),
    state: truncateText(properties.state),
    section_type: truncateText(properties.section_type),
    content_id: truncateText(properties.content_id),
    content_title: truncateText(properties.content_title),
    destination_domain: truncateText(properties.destination_domain),
    load_duration_ms:
      typeof properties.load_duration_ms === "number" &&
      Number.isFinite(properties.load_duration_ms) &&
      properties.load_duration_ms >= 0
        ? Math.round(properties.load_duration_ms)
        : null,
    error_code: truncateText(properties.error_code),
    metadata: sanitizeMetadata(properties.metadata ?? undefined),
  };
}

export function sanitizeForDevLog(
  payload: Record<string, unknown>
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...payload };
  for (const key of Object.keys(copy)) {
    if (BLOCKED_METADATA_KEYS.has(key)) {
      copy[key] = "[redacted]";
    }
  }
  return copy;
}
