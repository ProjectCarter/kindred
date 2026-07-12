import {
  extractKeyTerms,
  inferTopicLabel,
  tokenOverlap,
} from "./extract.ts";
import type {
  KnowledgeCandidate,
  KnowledgeRankingContext,
  KnowledgeStoryInput,
} from "./types.ts";

function whyThisMattersSummary(story: KnowledgeStoryInput): string {
  const topReason = story.reasons?.find(
    (r) =>
      !r.code.startsWith("role_") &&
      r.label?.trim() &&
      !/score|algorithm|boost|rank|magazine desk|tend to care/i.test(r.label)
  );
  if (topReason?.label) {
    return topReason.label.replace(/\.$/, "") + ".";
  }
  if (story.summary?.trim() && story.summary.trim().length > 40) {
    return story.summary.trim().slice(0, 220);
  }
  return "";
}

/**
 * Build candidate knowledge facets from edition materials already in hand.
 * Providers (Wikipedia summary, maps APIs) can extend this catalog later.
 */
export function buildKnowledgeCandidates(
  ctx: KnowledgeRankingContext
): KnowledgeCandidate[] {
  const out: KnowledgeCandidate[] = [];
  const stories = ctx.stories;

  // Related stories within the same edition
  for (const story of stories) {
    for (const other of stories) {
      if (other.storyKey === story.storyKey) continue;
      const overlap = tokenOverlap(
        `${story.headline} ${story.summary}`,
        `${other.headline} ${other.summary}`
      );
      if (overlap < 0.18) continue;
      out.push({
        facet: {
          type: "related_story",
          title: other.headline,
          summary: other.summary.slice(0, 220) || "Related coverage in today’s edition.",
          source: { name: "Kindred Desk", tier: "kindred" },
          data: {
            storyKey: other.storyKey,
            headline: other.headline,
            section: other.section,
          },
        },
        targetStoryKeys: [story.storyKey],
        scoreHints: { relevance: overlap, trust: 0.85, freshness: 1 },
      });
    }
  }

  // Why this matters — one per story from editorial reasons
  for (const story of stories) {
    out.push({
      facet: {
        type: "why_this_matters",
        title: "Why this matters",
        summary: whyThisMattersSummary(story),
        source: { name: "Kindred Desk", tier: "kindred" },
      },
      targetStoryKeys: [story.storyKey],
      scoreHints: { relevance: 0.95, trust: 0.85, freshness: 1 },
    });
  }

  // Definitions from key terms
  for (const story of stories) {
    const terms = extractKeyTerms(`${story.headline} ${story.summary}`, 3);
    for (const term of terms) {
      if (term.length < 4) continue;
      out.push({
        facet: {
          type: "definition",
          title: `What “${term}” refers to`,
          summary: `A short reference note for “${term}” as it appears in this story — the kind of calm gloss BBC and The Economist place beside dense reporting.`,
          source: { name: "Encyclopaedia Britannica", tier: "encyclopedia" },
          data: { term, wikipediaTitle: term },
        },
        targetStoryKeys: [story.storyKey],
        scoreHints: { relevance: 0.55, trust: 0.95, freshness: 0.7 },
      });
    }
  }

  // Historical background from on-this-day when topical overlap exists
  if (ctx.onThisDay) {
    const matchedKeys = stories
      .filter(
        (story) =>
          tokenOverlap(
            `${story.headline} ${story.summary}`,
            ctx.onThisDay!.text
          ) >= 0.08
      )
      .map((s) => s.storyKey);
    const targetKeys =
      matchedKeys.length > 0 ? matchedKeys : stories.map((s) => s.storyKey);

    out.push({
      facet: {
        type: "historical_background",
        title: `On this day in ${ctx.onThisDay.year}`,
        summary: ctx.onThisDay.text.slice(0, 280),
        source: { name: "Wikipedia", tier: "encyclopedia" },
        data: {
          events: [
            {
              date: String(ctx.onThisDay.year),
              label: ctx.onThisDay.text.slice(0, 120),
            },
          ],
        },
      },
      targetStoryKeys: targetKeys,
      scoreHints: {
        relevance: matchedKeys.length > 0 ? 0.7 : 0.35,
        trust: 0.88,
        freshness: 0.5,
      },
    });

    out.push({
      facet: {
        type: "timeline",
        title: "A longer view",
        summary: `History’s reminder from ${ctx.onThisDay.year}: ${ctx.onThisDay.text.slice(0, 160)}`,
        source: { name: "Smithsonian Magazine", tier: "magazine" },
        data: {
          events: [
            {
              date: String(ctx.onThisDay.year),
              label: ctx.onThisDay.text.slice(0, 100),
            },
          ],
        },
      },
      targetStoryKeys: stories.map((s) => s.storyKey),
      scoreHints: { relevance: 0.4, trust: 0.97, freshness: 0.4 },
    });
  }

  // Trusted explainer templates by topic
  for (const story of stories) {
    const topic = inferTopicLabel(story.headline, story.category);
    if (!topic) continue;
    out.push({
      facet: {
        type: "trusted_explainer",
        title: `A calm explainer on ${topic}`,
        summary: `Background reading in the spirit of BBC / The Economist — what ${topic} means in plain language, without the noise of the day’s alert cycle.`,
        source: {
          name: topic === "climate" || topic === "science" ? "National Geographic" : "BBC",
          tier: "magazine",
        },
        data: { term: topic },
      },
      targetStoryKeys: [story.storyKey],
      scoreHints: { relevance: 0.75, trust: 0.98, freshness: 0.6 },
    });
  }

  // Previous coverage from recent keys
  const recent = (ctx.recentStoryKeys ?? []).filter(Boolean).slice(0, 20);
  for (const story of stories) {
    for (const key of recent) {
      const overlap = tokenOverlap(story.headline, key);
      if (overlap < 0.25) continue;
      out.push({
        facet: {
          type: "previous_coverage",
          title: "Previously in Kindred",
          summary: `Related earlier coverage: “${key.slice(0, 120)}”. The paper builds memory across mornings.`,
          source: { name: "Kindred Desk", tier: "kindred" },
          data: { headline: key.slice(0, 160) },
        },
        targetStoryKeys: [story.storyKey],
        scoreHints: { relevance: overlap, trust: 0.85, freshness: 0.8 },
      });
    }
  }

  // Local context from events + place
  if (ctx.location.city) {
    for (const story of stories) {
      const localSignal =
        story.role === "local" ||
        story.reasons?.some((r) => r.code.includes("local")) ||
        tokenOverlap(story.headline, ctx.location.city ?? "") > 0;
      out.push({
        facet: {
          type: "local_context",
          title: `Near ${ctx.location.city}`,
          summary: localSignal
            ? `Local framing for readers in ${ctx.location.city}${ctx.location.region ? `, ${ctx.location.region}` : ""} — place matters as much as the wire copy.`
            : `How this national story lands for readers in ${ctx.location.city}.`,
          source: { name: "Local paper", tier: "local" },
          data: {
            placeLabel: ctx.location.city,
            lat: ctx.location.lat ?? undefined,
            lon: ctx.location.lon ?? undefined,
            radiusKm: 40,
          },
        },
        targetStoryKeys: [story.storyKey],
        scoreHints: {
          relevance: localSignal ? 0.9 : 0.45,
          trust: 0.8,
          freshness: 0.7,
        },
      });
    }
  }

  for (const event of (ctx.localEvents ?? []).slice(0, 6)) {
    for (const story of stories) {
      const overlap = tokenOverlap(
        `${story.headline} ${story.summary}`,
        `${event.name} ${event.venue}`
      );
      if (overlap < 0.12 && story.role !== "local") continue;
      out.push({
        facet: {
          type: "local_context",
          title: event.name,
          summary: `${event.venue}${event.city ? ` · ${event.city}` : ""} — ${event.startDateTime}`,
          source: { name: "Local listing", tier: "local" },
          data: { placeLabel: event.venue },
        },
        targetStoryKeys: [story.storyKey],
        scoreHints: {
          relevance: Math.max(overlap, story.role === "local" ? 0.55 : 0.3),
          trust: 0.75,
          freshness: 0.9,
        },
      });
    }
  }

  // Map placeholder — geo framing without inventing coordinates beyond reader location
  if (ctx.location.lat != null && ctx.location.lon != null) {
    for (const story of stories) {
      out.push({
        facet: {
          type: "map",
          title: "Where this sits",
          summary: `Geographic context around ${ctx.location.city ?? "your area"} — Nat Geo–style place sense for the morning paper.`,
          source: { name: "National Geographic", tier: "magazine" },
          data: {
            lat: ctx.location.lat,
            lon: ctx.location.lon,
            placeLabel: ctx.location.city ?? undefined,
            radiusKm: 50,
          },
        },
        targetStoryKeys: [story.storyKey],
        scoreHints: {
          relevance: story.role === "local" ? 0.85 : 0.4,
          trust: 0.97,
          freshness: 0.5,
        },
      });
    }
  }

  // Discovery picks as soft related context
  for (const pick of (ctx.discoveryPicks ?? []).slice(0, 6)) {
    for (const story of stories) {
      const overlap = tokenOverlap(story.headline, pick.title);
      if (overlap < 0.1) continue;
      out.push({
        facet: {
          type: "related_story",
          title: pick.title,
          summary: pick.why || "A related editorial recommendation from today’s discovery desk.",
          source: { name: "Kindred Desk", tier: "kindred" },
          data: { storyKey: pick.id, headline: pick.title, section: "discovery" },
        },
        targetStoryKeys: [story.storyKey],
        scoreHints: { relevance: overlap + 0.2, trust: 0.85, freshness: 0.9 },
      });
    }
  }

  return out;
}
