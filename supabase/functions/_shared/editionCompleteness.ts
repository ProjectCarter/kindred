/**
 * Server mirror — persisted edition must be a readable newspaper before
 * status=ready. Aligned with client isPersistedEditionComplete().
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { DiscoveryPayload } from "./discovery/types.ts";
import { parseDiscoveryPayload } from "./discovery/discoveryPayload.ts";
import { allocateDiscoverySections } from "./discovery/sectionAllocation.ts";
import { metroKeyFromLocation } from "./storyOf/metroKey.ts";
import { eventHasPublishableEditorial } from "./localEvents/banditNotes.ts";
import type { LocalEvent } from "./localEvents/provider.ts";
import { isMorningHeroDetailComplete } from "./heroArtwork/presentation.ts";
import {
  getCatalogBootstrapState,
  type CatalogBootstrapState,
} from "./catalog/catalogBootstrap.ts";

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

function localEventsSectionHasCompleteEditorial(body: string | null | undefined): {
  ok: boolean;
  surfaced: number;
  publishable: number;
} {
  if (!body?.trim()) return { ok: false, surfaced: 0, publishable: 0 };
  try {
    const parsed = JSON.parse(body) as { events?: unknown[] };
    const rows = Array.isArray(parsed.events) ? parsed.events : [];
    if (!rows.length) return { ok: false, surfaced: 0, publishable: 0 };
    let publishable = 0;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const event = row as Partial<LocalEvent>;
      if (
        typeof event.name !== "string" ||
        typeof event.venue !== "string" ||
        !event.name.trim()
      ) {
        continue;
      }
      if (
        eventHasPublishableEditorial({
          name: event.name,
          startDateTime:
            typeof event.startDateTime === "string" ? event.startDateTime : "Date TBA",
          venue: event.venue,
          city: typeof event.city === "string" ? event.city : "",
          sourceUrl: typeof event.sourceUrl === "string" ? event.sourceUrl : "",
          sourceName: typeof event.sourceName === "string" ? event.sourceName : "Listing",
          editorialHeadline:
            typeof event.editorialHeadline === "string" ? event.editorialHeadline : null,
          banditNote: typeof event.banditNote === "string" ? event.banditNote : null,
          editorialBody: Array.isArray(event.editorialBody)
            ? event.editorialBody.filter((p): p is string => typeof p === "string")
            : null,
        })
      ) {
        publishable += 1;
      }
    }
    return {
      ok: publishable > 0 && publishable === rows.length,
      surfaced: rows.length,
      publishable,
    };
  } catch {
    return { ok: false, surfaced: 0, publishable: 0 };
  }
}

function hasCompleteMorningHero(morningEdition: unknown): boolean {
  if (!morningEdition || typeof morningEdition !== "object") return false;
  const hero = (morningEdition as { morningHero?: { detail?: unknown; hostedUrl?: string } })
    .morningHero;
  if (!hero?.hostedUrl?.trim()) return false;
  return isMorningHeroDetailComplete(hero.detail);
}

export function assessPersistedEditionBuild(input: {
  sections: EditionSectionRow[];
  discovery: DiscoveryPayload | null | undefined;
  hasBanditsPick: boolean;
  expectStoryOf?: boolean;
  catalogBootstrap?: CatalogBootstrapState;
  hasMorningHero?: boolean;
  libraryHasHeroArtwork?: boolean;
  morningEdition?: unknown;
}): { complete: boolean; reasons: string[] } {
  const types = input.sections.map((s) => s.section_type);
  const discovery =
    input.discovery && input.discovery.version === 1
      ? input.discovery
      : parseDiscoveryPayload(input.discovery);
  const reasons: string[] = [];
  const hasStoryOf =
    types.includes("story_of") || types.includes("your_city");
  const bootstrap = input.catalogBootstrap;
  const catalogBootstrapPending = Boolean(
    bootstrap &&
      !bootstrap.eventsCatalogBootstrapped &&
      !bootstrap.activitiesCatalogBootstrapped &&
      !bootstrap.foodDrinkCatalogBootstrapped
  );

  if (!types.includes("today_in_history")) {
    reasons.push("edition_sections missing today_in_history");
  }
  if (
    !catalogBootstrapPending &&
    (!bootstrap || bootstrap.eventsCatalogBootstrapped) &&
    !types.includes("local_events")
  ) {
    reasons.push("edition_sections missing local_events");
  }
  if (input.expectStoryOf && !hasStoryOf) {
    reasons.push("edition_sections missing story_of");
  }
  if (!input.hasBanditsPick) {
    reasons.push("bandit pick missing");
  }

  const localEventsSection = input.sections.find((s) => s.section_type === "local_events");
  if (
    !catalogBootstrapPending &&
    (!bootstrap || bootstrap.eventsCatalogBootstrapped) &&
    types.includes("local_events")
  ) {
    const editorial = localEventsSectionHasCompleteEditorial(localEventsSection?.body ?? null);
    if (!editorial.ok) {
      reasons.push(
        `local events missing publishable editorial (${editorial.publishable}/${editorial.surfaced})`
      );
    }
  }

  if (input.libraryHasHeroArtwork && !hasCompleteMorningHero(input.morningEdition)) {
    reasons.push("today's masterpiece missing or incomplete");
  }

  const surfaceItems = discoverySurfaceItemCount(discovery);
  if (!catalogBootstrapPending && surfaceItems === 0) {
    reasons.push("discovery has zero surfaced items");
  }

  const allocation = allocateDiscoverySections(discovery);
  if (
    !catalogBootstrapPending &&
    (!bootstrap || bootstrap.activitiesCatalogBootstrapped) &&
    allocation.activities.length === 0
  ) {
    reasons.push("discovery pool has zero activities after allocate");
  }
  if (
    !catalogBootstrapPending &&
    (!bootstrap || bootstrap.foodDrinkCatalogBootstrapped) &&
    allocation.recommendations.length === 0
  ) {
    reasons.push("discovery pool has zero recommendations after allocate");
  }

  return { complete: reasons.length === 0, reasons };
}

/** Load persisted row + sections and assess — source of truth before ready. */
export async function assessPersistedEditionRow(
  admin: SupabaseClient,
  editionId: string,
  options?: {
    expectStoryOf?: boolean;
    morningEdition?: unknown;
    libraryHasHeroArtwork?: boolean;
  }
): Promise<{ complete: boolean; reasons: string[] }> {
  const { data: edition, error: editionError } = await admin
    .from("editions")
    .select("discovery, bandit, morning_edition")
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

  const discovery = parseDiscoveryPayload(edition.discovery);
  let expectStoryOf = options?.expectStoryOf;
  const metroKey = discovery?.location?.city
    ? metroKeyFromLocation(discovery.location)
    : null;
  if (expectStoryOf === undefined && discovery?.location?.city) {
    const { data: article } = await admin
      .from("kindred_city_articles")
      .select("metro_key")
      .eq("metro_key", metroKey!)
      .eq("approval_status", "approved")
      .maybeSingle();
    expectStoryOf = Boolean(article);
  }

  const catalogBootstrap = await getCatalogBootstrapState(admin, metroKey);
  const morningEditionPayload =
    options?.morningEdition ?? edition.morning_edition;
  const hasMorningHero = Boolean(
    morningEditionPayload &&
      typeof morningEditionPayload === "object" &&
      (morningEditionPayload as { morningHero?: { hostedUrl?: string } })
        .morningHero?.hostedUrl?.trim()
  );

  return assessPersistedEditionBuild({
    sections: sections ?? [],
    discovery,
    hasBanditsPick: hasBanditsPickFromPayload(edition.bandit),
    expectStoryOf,
    catalogBootstrap,
    hasMorningHero,
    libraryHasHeroArtwork: options?.libraryHasHeroArtwork,
    morningEdition: morningEditionPayload,
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
