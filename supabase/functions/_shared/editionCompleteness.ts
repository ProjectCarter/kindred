/**
 * Server mirror — persisted edition must be a readable newspaper before
 * status=ready. Prevents "ready" rows with only weather + local_events.
 */

import type { DiscoveryPayload } from "./discovery/types.ts";

export type EditionSectionRow = {
  section_type: string;
  headline?: string | null;
  body?: string | null;
};

export function discoverySurfaceItemCount(
  discovery: DiscoveryPayload | null | undefined
): number {
  if (!discovery?.surfaces) return 0;
  let total = 0;
  for (const surface of Object.values(discovery.surfaces)) {
    total += surface?.items?.length ?? 0;
  }
  return total;
}

export function assessPersistedEditionBuild(input: {
  sections: EditionSectionRow[];
  discovery: DiscoveryPayload;
  hasBanditsPick: boolean;
}): { complete: boolean; reasons: string[] } {
  const types = input.sections.map((s) => s.section_type);
  const reasons: string[] = [];

  if (!types.includes("today_in_history")) {
    reasons.push("edition_sections missing today_in_history");
  }
  if (discoverySurfaceItemCount(input.discovery) === 0) {
    reasons.push("discovery has zero surfaced items");
  }
  if (!input.hasBanditsPick) {
    reasons.push("bandit pick missing");
  }
  if (!types.includes("local_events")) {
    reasons.push("edition_sections missing local_events");
  }

  return { complete: reasons.length === 0, reasons };
}
