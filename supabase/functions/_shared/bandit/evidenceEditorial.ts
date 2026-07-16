/**
 * Compose Bandit's Pick stories from verified experiences and anchors.
 * Experiences first — venues are where you go, not the story itself.
 */

import type { DiscoveryRankingContext } from "../discovery/types.ts";
import type { BanditSeasonalEditorial } from "./editorialContent.ts";
import { containsGenericAiPhrase } from "../editorial/editorialIntelligence.ts";
import {
  applyEditionVarietyToBody,
  buildVarietySeed,
} from "../editorial/editionVariety.ts";
import type {
  ExperienceEvidenceBundle,
  ExperienceEvidenceItem,
} from "./localEvidence.ts";
import type { NearbyEditorialPick } from "./localizeEditorial.ts";

function joinNames(names: string[]): string | null {
  const list = names.filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

function whereLine(item: ExperienceEvidenceItem, area: string): string {
  if (item.source === "event" && item.venue?.trim()) {
    return `${item.name} at ${item.venue.trim()}`;
  }
  if (item.address?.trim()) {
    return `${item.name} (${item.address.trim()})`;
  }
  if (item.city?.trim() && item.city.trim().toLowerCase() !== area.toLowerCase()) {
    return `${item.name} in ${item.city.trim()}`;
  }
  return item.name;
}

function anchors(bundle: ExperienceEvidenceBundle): ExperienceEvidenceItem[] {
  return bundle.items.filter((i) => i.tier !== "seasonal_experience");
}

function nearbyFromEvidence(bundle: ExperienceEvidenceBundle): NearbyEditorialPick[] {
  const list = anchors(bundle);
  if (list.length) {
    return list.map((item) => ({
      name: item.name,
      glyph: bundle.glyph,
      description: item.description,
    }));
  }
  return bundle.items.map((item) => ({
    name: item.name,
    glyph: bundle.glyph,
    description: item.description,
  }));
}

function composeExperienceLedEditorial(
  base: BanditSeasonalEditorial,
  evidence: ExperienceEvidenceBundle,
  ctx: DiscoveryRankingContext
): BanditSeasonalEditorial & { nearby: NearbyEditorialPick[] } {
  const { primary, area } = evidence;
  const anchorList = anchors(evidence);
  const anchorNames = joinNames(anchorList.map((a) => a.name));

  const cardExcerpt = `${primary.description} That is what is genuinely special near ${area} this week.`;

  const bestTime =
    base.modules.find((m) => m.id === "best_time")?.body ??
    base.modules.find((m) => m.id === "why_now")?.body ??
    null;
  const goodToKnow =
    base.modules.find((m) => m.id === "good_to_know")?.body ?? null;

  const body: string[] = [
    `${primary.name} is the experience worth planning around near ${area} right now. ${primary.description}`,
    `The timing matters: ${base.cardExcerpt} This is not background seasonality — it is something you can actually step outside and notice this week.`,
    anchorNames
      ? `Where locals catch it: ${anchorNames}. ${anchorList[0]?.description ?? ""}`.trim()
      : `Look for open viewpoints, neighborhood parks, and quiet outdoor spots near ${area} — the experience does not require a ticket, just the right evening.`,
    bestTime ? `When to go: ${bestTime}` : null,
    goodToKnow ? `Before you head out: ${goodToKnow}` : null,
    anchorList.some((a) => a.url)
      ? `Check listings for the best viewpoints or events before you go — conditions change night to night.`
      : `Go when the light is right — early evening tends to be the honest window for this kind of week.`,
    base.closingNote && !containsGenericAiPhrase(base.closingNote)
      ? base.closingNote
      : null,
  ].filter((p): p is string => Boolean(p));

  const modules = [
    {
      id: "what",
      label: "What Is Happening",
      body: `${primary.name} — ${primary.description}`,
    },
    {
      id: "why_now",
      label: "Why It's Special Right Now",
      body:
        base.modules.find((m) => m.id === "why_special")?.body ?? base.cardExcerpt,
    },
    {
      id: "where",
      label: "Where To Experience It",
      body: anchorList.length
        ? anchorList
            .map((item) => `${whereLine(item, area)}: ${item.description}`)
            .join(" ")
        : `Open parks, scenic overlooks, and quiet outdoor spots around ${area} — anywhere with a clear view and a little patience.`,
    },
    {
      id: "this_week",
      label: "Why Go This Week",
      body:
        base.modules.find((m) => m.id === "best_time")?.body ??
        "This week is the practical window — wait too long and the season moves on without you.",
    },
  ];

  const mapsQuery = anchorList[0]
    ? `${anchorList[0].name} ${area}`
    : `${primary.name.toLowerCase()} ${area}`;

  return {
    headline: base.headline,
    cardExcerpt: cardExcerpt.slice(0, 280),
    body: applyEditionVarietyToBody(
      body,
      buildVarietySeed(ctx.editionDate, `${base.headline}:${primary.name}`)
    ),
    modules,
    closingNote: base.closingNote,
    mapsQuery,
    actionLabel: "Explore Nearby",
    nearby: nearbyFromEvidence(evidence),
  };
}

function composeVenueLedEditorial(
  base: BanditSeasonalEditorial,
  evidence: ExperienceEvidenceBundle,
  ctx: DiscoveryRankingContext
): BanditSeasonalEditorial & { nearby: NearbyEditorialPick[] } {
  const { primary, area, items } = evidence;
  const where = whereLine(primary, area);
  const also = joinNames(items.slice(1).map((i) => i.name));

  const cardExcerpt = `${where} is worth putting on this week's list near ${area}. ${primary.description}`;

  const bestTime =
    base.modules.find((m) => m.id === "best_time")?.body ??
    base.modules.find((m) => m.id === "why_now")?.body ??
    null;

  const body: string[] = [
    `${where} is how locals actually experience ${base.headline.toLowerCase()} near ${area}. ${primary.description}`,
    `The timing matters: ${base.cardExcerpt} That is why it belongs on this week's calendar.`,
    also
      ? `Also on the short list: ${also}.`
      : `Pair it with a slow walk nearby — the stop earns more when the rest of the afternoon stays unhurried.`,
    bestTime ? `When to go: ${bestTime}` : null,
    primary.url
      ? `Check the listing for today's hours before you go — seasonal windows move fast.`
      : `Confirm hours and conditions before you head out — seasonal windows move fast.`,
    base.closingNote && !containsGenericAiPhrase(base.closingNote)
      ? base.closingNote
      : null,
  ].filter((p): p is string => Boolean(p));

  const modules = [
    {
      id: "what",
      label: "What Is Happening",
      body: `${primary.name}${primary.venue ? ` at ${primary.venue}` : ""} — ${primary.description}`,
    },
    {
      id: "why_now",
      label: "Why It's Special Right Now",
      body:
        base.modules.find((m) => m.id === "why_special")?.body ?? base.cardExcerpt,
    },
    {
      id: "where",
      label: "Where To Experience It",
      body: items
        .map((item) => `${whereLine(item, area)}: ${item.description}`)
        .join(" "),
    },
    {
      id: "this_week",
      label: "Why Go This Week",
      body:
        base.modules.find((m) => m.id === "best_time")?.body ??
        "This week is the practical window — the season will turn before the calendar catches up.",
    },
  ];

  const mapsQuery = primary.venue
    ? `${primary.name} ${primary.venue} ${area}`
    : `${primary.name} ${area}`;

  return {
    headline: base.headline,
    cardExcerpt: cardExcerpt.slice(0, 280),
    body: applyEditionVarietyToBody(
      body,
      buildVarietySeed(ctx.editionDate, `${base.headline}:${primary.name}`)
    ),
    modules,
    closingNote: base.closingNote,
    mapsQuery,
    actionLabel: "Explore Nearby",
    nearby: nearbyFromEvidence(evidence),
  };
}

/**
 * Build a publishable Bandit's Pick from verified experience evidence.
 */
export function composeEvidenceBackedSeasonalEditorial(
  base: BanditSeasonalEditorial,
  evidence: ExperienceEvidenceBundle,
  ctx: DiscoveryRankingContext
): BanditSeasonalEditorial & { nearby: NearbyEditorialPick[] } {
  if (evidence.experienceLed) {
    return composeExperienceLedEditorial(base, evidence, ctx);
  }
  return composeVenueLedEditorial(base, evidence, ctx);
}
