import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { DiscoveryPayload } from "../../discovery/types.ts";
import type { KnowledgePayload } from "../types.ts";
import { isWikipediaEligible } from "./eligibility.ts";
import {
  lookupHeroArtworkSubject,
  lookupOnThisDaySubject,
  lookupWikipedia,
} from "./wikipedia.ts";
import type {
  EditionKnowledgeGrounding,
  KnowledgeLookupResult,
  KnowledgeProviderId,
} from "./types.ts";
import { resolveVerifiedEditorialCategory } from "../../editorialCategory.ts";
import { titleMatchScore } from "./confidence.ts";

export type EnrichKnowledgeInput = {
  knowledge: KnowledgePayload;
  onThisDay?: { year: number; text: string } | null;
  location?: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  };
  heroArtwork?: { artist: string; artworkTitle?: string | null } | null;
};

function placeContext(location?: EnrichKnowledgeInput["location"]): string {
  return [location?.city, location?.region, location?.state]
    .filter(Boolean)
    .join(", ");
}

function applyFacetGrounding(
  facet: import("../types.ts").KnowledgeFacet,
  result: KnowledgeLookupResult
): void {
  facet.summary = result.editorialSummary;
  facet.source = {
    name: "Wikipedia",
    tier: "encyclopedia",
    url: result.canonicalUrl,
  };
  facet.data = {
    ...facet.data,
    wikipediaTitle: result.pageTitle,
    wikipediaUrl: result.canonicalUrl,
    wikipediaPageId: result.pageId,
    extract: result.extract.slice(0, 400),
    groundingSource: "wikipedia",
    groundingConfidence: result.confidence,
    lat: result.coordinates?.lat ?? facet.data?.lat,
    lon: result.coordinates?.lon ?? facet.data?.lon,
  };
}

function detectStructuredConflict(
  structuredTitle: string,
  result: KnowledgeLookupResult
): string | null {
  const score = titleMatchScore(structuredTitle, result.pageTitle);
  if (score >= 0.45) return null;
  return `Structured title "${structuredTitle}" may not match Wikipedia page "${result.pageTitle}" (score ${score.toFixed(2)}).`;
}

/**
 * Enrich edition knowledge with Wikipedia grounding for eligible facets,
 * Today in History, and optional hero artwork metadata.
 */
export async function enrichEditionKnowledge(
  admin: SupabaseClient,
  input: EnrichKnowledgeInput
): Promise<KnowledgePayload> {
  const payload = structuredClone(input.knowledge);
  const grounding: EditionKnowledgeGrounding = {
    enrichedAt: new Date().toISOString(),
    providersUsed: ["wikipedia"],
    discoveryByItemId: {},
  };

  if (input.onThisDay) {
    grounding.onThisDay = await lookupOnThisDaySubject(admin, input.onThisDay);
  }

  if (input.heroArtwork?.artist) {
    grounding.heroArtwork = await lookupHeroArtworkSubject(admin, input.heroArtwork);
  }

  const context = placeContext(input.location);

  for (const packet of Object.values(payload.byStoryKey)) {
    for (const facet of packet.facets) {
      if (facet.type !== "definition") continue;

      const entityName =
        facet.data?.term ??
        facet.data?.wikipediaTitle ??
        facet.title;
      if (!entityName?.trim()) continue;

      const eligible = isWikipediaEligible({
        context: "news_entity",
        title: entityName,
        entityKind: facet.data?.entityKind,
      });

      if (!eligible) continue;

      const result = await lookupWikipedia(admin, {
        entityName,
        context,
        hints: facet.data?.entityKind === "place" ? [`${entityName} ${context}`] : undefined,
      });
      if (!result) continue;

      const conflict = detectStructuredConflict(entityName, result);
      if (conflict) {
        result.conflictWithStructuredData = conflict;
        console.warn("[knowledge:enrich] structured conflict", conflict);
        continue;
      }

      applyFacetGrounding(facet, result);
    }
  }

  if (input.onThisDay && grounding.onThisDay) {
    for (const packet of Object.values(payload.byStoryKey)) {
      for (const facet of packet.facets) {
        if (facet.type !== "historical_background") continue;
        if (facet.title.includes(String(input.onThisDay!.year))) {
          applyFacetGrounding(facet, grounding.onThisDay);
        }
      }
    }
  }

  payload.providerGrounding = grounding;
  payload.selectionMeta.editorNotes.push(
    "Wikipedia grounding applied to eligible definition and historical facets.",
    grounding.onThisDay
      ? `Today in History grounded: ${grounding.onThisDay.pageTitle}.`
      : "Today in History: no high-confidence Wikipedia match.",
    grounding.heroArtwork
      ? `Hero artwork artist grounded: ${grounding.heroArtwork.pageTitle}.`
      : "Hero artwork: no Wikipedia grounding requested or matched."
  );

  return payload;
}

export async function enrichDiscoveryKnowledge(
  admin: SupabaseClient,
  discovery: DiscoveryPayload,
  location?: EnrichKnowledgeInput["location"]
): Promise<DiscoveryPayload> {
  const enriched = structuredClone(discovery);
  const context = placeContext(location);
  let enrichedCount = 0;

  for (const surface of Object.values(enriched.surfaces)) {
    if (!surface?.items?.length) continue;
    for (const ranked of surface.items) {
      const item = ranked.item;
      const eligible = isWikipediaEligible({
        context: "discovery_briefing",
        title: item.title,
        discoveryCategory: item.category,
        venueCategories: item.venueCategories,
        dek: item.dek,
        address: item.address,
      });
      if (!eligible) continue;

      const verified = resolveVerifiedEditorialCategory({
        title: item.title,
        venueCategories: item.venueCategories,
        discoveryCategory: item.category,
        dek: item.dek,
        address: item.address,
      });

      const result = await lookupWikipedia(admin, {
        entityName: item.title,
        context,
        hints: [
          `${item.title} ${verified.displayLabel}`,
          `${item.title} ${context}`,
        ].filter((h) => h.trim().length > 3),
      });

      if (!result) continue;

      const conflict = detectStructuredConflict(item.title, result);
      if (conflict) {
        console.warn("[knowledge:enrich] discovery conflict", item.title, conflict);
        continue;
      }

      item.knowledgeGrounding = result;
      enrichedCount += 1;
    }
  }

  if (enrichedCount > 0) {
    enriched.selectionMeta.editorNotes.push(
      `Wikipedia grounding attached to ${enrichedCount} museum/landmark discovery item(s).`
    );
  }

  return enriched;
}

export type { KnowledgeLookupResult, KnowledgeProviderId, EditionKnowledgeGrounding };
