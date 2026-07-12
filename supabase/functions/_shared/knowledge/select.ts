import { isPlaceholderCopy } from "../contentQuality.ts";
import type {
  KnowledgeFacet,
  KnowledgeFacetType,
  KnowledgePacket,
  KnowledgeStoryInput,
} from "./types.ts";
import type { ScoredKnowledgeCandidate } from "./score.ts";

const DEFAULT_MAX = 6;

const TYPE_CAP: Partial<Record<KnowledgeFacetType, number>> = {
  related_story: 2,
  previous_coverage: 2,
  definition: 3,
  local_context: 2,
  why_this_matters: 1,
  trusted_explainer: 1,
  historical_background: 1,
  timeline: 1,
  map: 0, // omit generic map templates
};

/**
 * Select a calm, diverse knowledge packet for one story.
 */
export function selectKnowledgePacket(
  story: KnowledgeStoryInput,
  scored: ScoredKnowledgeCandidate[],
  maxFacets = DEFAULT_MAX
): KnowledgePacket {
  const ordered = scored
    .filter((s) => s.storyKey === story.storyKey)
    .filter(
      (s) =>
        !isPlaceholderCopy(s.facet.summary) &&
        !isPlaceholderCopy(s.facet.title) &&
        (TYPE_CAP[s.facet.type] ?? 1) > 0
    )
    .sort((a, b) => b.score - a.score);

  const selected: KnowledgeFacet[] = [];
  const typeCounts = new Map<KnowledgeFacetType, number>();
  const titles = new Set<string>();

  for (const candidate of ordered) {
    if (selected.length >= maxFacets) break;
    const type = candidate.facet.type;
    const count = typeCounts.get(type) ?? 0;
    const cap = TYPE_CAP[type] ?? 1;
    if (count >= cap) continue;

    const titleKey = candidate.facet.title.toLowerCase().slice(0, 80);
    if (titles.has(titleKey)) continue;

    selected.push(candidate.facet);
    typeCounts.set(type, count + 1);
    titles.add(titleKey);
  }

  // Ensure why_this_matters is present when available
  if (!selected.some((f) => f.type === "why_this_matters")) {
    const why = ordered.find((c) => c.facet.type === "why_this_matters");
    if (why) {
      selected.unshift(why.facet);
      if (selected.length > maxFacets) selected.pop();
    }
  }

  const editorBrief = [
    `Knowledge for “${story.headline.slice(0, 80)}”.`,
    ...selected.slice(0, 4).map((f) => `${f.type}: ${f.title}`),
  ].join("\n");

  return {
    storyKey: story.storyKey,
    section: story.section,
    headline: story.headline,
    facets: selected,
    editorBrief,
    selectionMeta: {
      candidateCount: ordered.length,
      selectedCount: selected.length,
      editorNotes: [
        "Context assembled like a magazine desk — teach, don’t overwhelm.",
        selected.some((f) => f.type === "why_this_matters")
          ? "Includes why this matters."
          : "",
      ].filter(Boolean),
    },
  };
}

export function whyFacet(facet: KnowledgeFacet): string {
  const top = facet.reasons
    ?.filter((r) => r.weight > 0)
    .slice(0, 2)
    .map((r) => r.label);
  return top?.join(" ") || facet.summary.slice(0, 120);
}
