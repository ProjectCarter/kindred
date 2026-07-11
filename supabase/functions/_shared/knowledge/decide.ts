import { buildKnowledgeCandidates } from "./catalog.ts";
import { scoreKnowledgeCandidate } from "./score.ts";
import { selectKnowledgePacket, whyFacet } from "./select.ts";
import type {
  KnowledgePayload,
  KnowledgeRankingContext,
  KnowledgeStoryInput,
} from "./types.ts";

/**
 * Knowledge Engine entry point — reusable for every article and section.
 * Enriches stories with trustworthy context at edition build time.
 */
export function runKnowledgeDecisions(
  input: KnowledgeRankingContext
): KnowledgePayload {
  const now = input.now ?? new Date();
  const stories = dedupeStories(input.stories);
  const ctx: KnowledgeRankingContext = { ...input, now, stories };

  const candidates = buildKnowledgeCandidates(ctx);
  const byStoryKey: KnowledgePayload["byStoryKey"] = {};
  const highlights: KnowledgePayload["highlights"] = [];

  for (const story of stories) {
    const scored = candidates
      .map((c) => scoreKnowledgeCandidate(c, story.storyKey, ctx))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    const packet = selectKnowledgePacket(
      story,
      scored,
      ctx.maxFacetsPerStory ?? 6
    );
    byStoryKey[story.storyKey] = packet;

    for (const facet of packet.facets.slice(0, 2)) {
      highlights.push({
        storyKey: story.storyKey,
        headline: story.headline,
        facetType: facet.type,
        why: whyFacet(facet),
      });
    }
  }

  const facetCount = Object.values(byStoryKey).reduce(
    (n, p) => n + p.facets.length,
    0
  );

  const editorBrief = [
    `Knowledge brief for ${ctx.editionDate}.`,
    `Stories enriched: ${stories.length}. Facets: ${facetCount}.`,
    "Sources favor encyclopedia, wire, and magazine reference desks.",
    ...highlights.slice(0, 6).map(
      (h) => `- ${h.headline.slice(0, 50)} → ${h.facetType}: ${h.why.slice(0, 80)}`
    ),
  ].join("\n");

  const payload: KnowledgePayload = {
    version: 1,
    generatedAt: now.toISOString(),
    editionDate: ctx.editionDate,
    location: {
      city: ctx.location.city,
      region: ctx.location.region,
      state: ctx.location.state,
    },
    byStoryKey,
    highlights: highlights.slice(0, 24),
    editorBrief,
    selectionMeta: {
      storyCount: stories.length,
      facetCount,
      editorNotes: [
        "Knowledge packets teach context — Nat Geo / BBC / Economist spirit.",
        "No new newspaper sections; packets attach to stories by id.",
      ],
    },
  };

  console.log("[knowledge] decisions", {
    storyCount: stories.length,
    candidateCount: candidates.length,
    facetCount,
    city: ctx.location.city,
  });

  return payload;
}

function dedupeStories(stories: KnowledgeStoryInput[]): KnowledgeStoryInput[] {
  const map = new Map<string, KnowledgeStoryInput>();
  for (const s of stories) {
    if (!s.storyKey || !s.headline) continue;
    if (!map.has(s.storyKey)) map.set(s.storyKey, s);
  }
  return Array.from(map.values());
}
