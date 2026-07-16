/**
 * Server mirror — persisted edition must be a readable newspaper before
 * status=ready. Aligned with client isPersistedEditionComplete().
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { DiscoveryPayload } from "./discovery/types.ts";
import { parseDiscoveryPayload } from "./discovery/discoveryPayload.ts";
import { allocateDiscoverySections } from "./discovery/sectionAllocation.ts";

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

export function hasBanditsPickFromPayload(bandit: unknown): boolean {
  if (!bandit || typeof bandit !== "object") return false;
  const pick = (bandit as { pick?: { story?: { headline?: string } } }).pick;
  const headline = pick?.story?.headline?.trim();
  return Boolean(headline);
}

export function assessPersistedEditionBuild(input: {
  sections: EditionSectionRow[];
  discovery: DiscoveryPayload | null | undefined;
  hasBanditsPick: boolean;
}): { complete: boolean; reasons: string[] } {
  const types = input.sections.map((s) => s.section_type);
  const discovery =
    input.discovery && input.discovery.version === 1
      ? input.discovery
      : parseDiscoveryPayload(input.discovery);
  const reasons: string[] = [];

  if (!types.includes("today_in_history")) {
    reasons.push("edition_sections missing today_in_history");
  }
  if (!types.includes("local_events")) {
    reasons.push("edition_sections missing local_events");
  }
  if (!input.hasBanditsPick) {
    reasons.push("bandit pick missing");
  }

  const surfaceItems = discoverySurfaceItemCount(discovery);
  if (surfaceItems === 0) {
    reasons.push("discovery has zero surfaced items");
  }

  const allocation = allocateDiscoverySections(discovery);
  if (allocation.activities.length === 0) {
    reasons.push("discovery pool has zero activities after allocate");
  }
  if (allocation.recommendations.length === 0) {
    reasons.push("discovery pool has zero recommendations after allocate");
  }

  return { complete: reasons.length === 0, reasons };
}

/** Load persisted row + sections and assess — source of truth before ready. */
export async function assessPersistedEditionRow(
  admin: SupabaseClient,
  editionId: string
): Promise<{ complete: boolean; reasons: string[] }> {
  const { data: edition, error: editionError } = await admin
    .from("editions")
    .select("discovery, bandit")
    .eq("id", editionId)
    .maybeSingle();

  if (editionError || !edition) {
    return {
      complete: false,
      reasons: [editionError?.message ?? "edition row missing"],
    };
  }

  const { data: sections, error: sectionsError } = await admin
    .from("edition_sections")
    .select("section_type, headline, body")
    .eq("edition_id", editionId);

  if (sectionsError) {
    return { complete: false, reasons: [sectionsError.message] };
  }

  return assessPersistedEditionBuild({
    sections: sections ?? [],
    discovery: parseDiscoveryPayload(edition.discovery),
    hasBanditsPick: hasBanditsPickFromPayload(edition.bandit),
  });
}

export type DiscoveryUpdateInput = {
  editionId: string;
  candidateDiscovery: DiscoveryPayload;
  sections: EditionSectionRow[];
  bandit: unknown;
};

/**
 * Returns true when candidate discovery may replace the stored payload on a
 * ready edition without breaking homepage completeness.
 */
export function candidateDiscoveryPassesCompleteness(
  input: DiscoveryUpdateInput
): { allowed: boolean; reasons: string[] } {
  const result = assessPersistedEditionBuild({
    sections: input.sections,
    discovery: input.candidateDiscovery,
    hasBanditsPick: hasBanditsPickFromPayload(input.bandit),
  });
  return { allowed: result.complete, reasons: result.reasons };
}

export async function tryPersistDiscoveryUpdate(
  admin: SupabaseClient,
  input: {
    editionId: string;
    candidateDiscovery: DiscoveryPayload;
    logPrefix: string;
  }
): Promise<{ ok: boolean; changed: boolean; rejected?: boolean; error?: string }> {
  const { data: edition, error: editionError } = await admin
    .from("editions")
    .select("discovery, bandit")
    .eq("id", input.editionId)
    .maybeSingle();

  if (editionError) {
    return { ok: false, changed: false, error: editionError.message };
  }

  const { data: sections, error: sectionsError } = await admin
    .from("edition_sections")
    .select("section_type, headline, body")
    .eq("edition_id", input.editionId);

  if (sectionsError) {
    return { ok: false, changed: false, error: sectionsError.message };
  }

  const gate = candidateDiscoveryPassesCompleteness({
    editionId: input.editionId,
    candidateDiscovery: input.candidateDiscovery,
    sections: sections ?? [],
    bandit: edition?.bandit,
  });

  if (!gate.allowed) {
    console.warn(`${input.logPrefix} refusing discovery overwrite — incomplete payload`, {
      editionId: input.editionId,
      surfaceItems: discoverySurfaceItemCount(input.candidateDiscovery),
      reasons: gate.reasons,
      preservedExisting: discoverySurfaceItemCount(
        parseDiscoveryPayload(edition?.discovery)
      ),
    });
    return { ok: true, changed: false, rejected: true };
  }

  const unchanged =
    JSON.stringify(edition?.discovery ?? null) ===
    JSON.stringify(input.candidateDiscovery);
  if (unchanged) {
    return { ok: true, changed: false };
  }

  const { error: updateError } = await admin
    .from("editions")
    .update({ discovery: input.candidateDiscovery })
    .eq("id", input.editionId);

  if (updateError) {
    return { ok: false, changed: false, error: updateError.message };
  }

  return { ok: true, changed: true };
}
