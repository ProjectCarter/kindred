/**
 * Bandit's Pick generator — whisper, headline, local body, nearby picks.
 */

import { localEventsAsDiscoveryItems } from "../discovery/catalog.ts";
import { scoreDiscoveryItem } from "../discovery/score.ts";
import type { DiscoveryRankingContext } from "../discovery/types.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import {
  HORIZON_BUCKET_LABEL,
  isWithinEventHorizon,
  resolveEventHorizon,
  type EventHorizonBucket,
} from "../localEvents/horizon.ts";
import {
  composeEventEditorial,
  getBanditSeasonalEditorial,
} from "./editorialContent.ts";
import { composeEvidenceBackedSeasonalEditorial } from "./evidenceEditorial.ts";
import {
  evidenceScoreBonus,
  evidenceWhyLine,
  verifySeasonalLocalEvidence,
} from "./localEvidence.ts";
import {
  localizeEventEditorial,
  type NearbyEditorialPick,
} from "./localizeEditorial.ts";
import { activeSeasonalMoments } from "./seasonalMoments.ts";
import type { BanditsPickKind } from "./types.ts";
import {
  hasBanditTimelySignal,
  isDisqualifiedBanditPickCandidate,
} from "./timeliness.ts";
import { pickBanditWhisper } from "./whispers.ts";

type BanditVoiceBucket = "seasonal" | "limited_time";

export type BanditEditorialModule = {
  id: string;
  label: string;
  body: string;
};

export type BanditsPickStory = {
  kind: BanditsPickKind;
  id: string;
  headline: string;
  summary: string;
  body: string[];
  modules: BanditEditorialModule[];
  closingNote: string;
  mapsQuery: string;
  actionLabel: string;
  nearby: NearbyEditorialPick[];
  heroMomentId?: string | null;
  imageCaption?: string | null;
  source: string;
  url: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  category: string | null;
  why: string;
  discoveryItem: import("../discovery/types.ts").DiscoveryItem | null;
  claim: { kind: "event"; index: number } | null;
  voice: BanditVoiceBucket;
};

type Candidate = { story: BanditsPickStory; score: number };

const BANDIT_PICK_MIN_SCORE = 42;

const SEASONAL_EVENT_HINT =
  /\b(festival|fair|harvest|bloom|blossom|lights|tree lighting|holiday market|winter market|pumpkin|apple picking|cider|peach|strawberry|blueberry|cherry blossom|wildflower|firefly|meteor|perseid|lavender|county fair|state fair|annual|seasonal|concert|live music|comedy|theater|theatre|exhibit|farmers? market|workshop|class(es)?)\b/i;

const HORIZON_SCORE_BONUS: Record<Exclude<EventHorizonBucket, "beyond">, number> = {
  today: 25,
  this_weekend: 22,
  next_weekend: 18,
  coming_soon: 12,
};

function eventWhyLine(event: LocalEvent, now: Date): string {
  const bucket =
    event.horizonBucket ?? resolveEventHorizon(event, now);
  if (bucket === "beyond") return "Worth planning for this month.";
  const label = HORIZON_BUCKET_LABEL[bucket];
  if (bucket === "today") return `${label}.`;
  if (bucket === "coming_soon") return "Worth planning for this month.";
  return `${label}.`;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTitle(recentKeys: string[], title: string): boolean {
  if (!recentKeys.length) return false;
  const t = normalizeKey(title).slice(0, 60);
  if (!t) return false;
  return recentKeys.some((raw) => {
    const k = normalizeKey(raw);
    return Boolean(k) && k.slice(0, 60) === t;
  });
}

function isNearDuplicate(a: string, b: string): boolean {
  const x = normalizeKey(a);
  const y = normalizeKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length > 24 && y.length > 24 && (x.includes(y) || y.includes(x))) return true;
  return false;
}

function storyFromEditorial(
  base: Omit<
    BanditsPickStory,
    "summary" | "body" | "modules" | "closingNote" | "mapsQuery" | "actionLabel" | "nearby"
  >,
  editorial: {
    headline: string;
    cardExcerpt: string;
    body: string[];
    modules: BanditEditorialModule[];
    closingNote: string;
    mapsQuery: string;
    actionLabel: string;
    nearby: NearbyEditorialPick[];
  }
): BanditsPickStory {
  return {
    ...base,
    headline: editorial.headline,
    summary: editorial.cardExcerpt,
    body: editorial.body,
    modules: editorial.modules,
    closingNote: editorial.closingNote,
    mapsQuery: editorial.mapsQuery,
    actionLabel: editorial.actionLabel,
    nearby: editorial.nearby,
  };
}

function seasonalCandidates(
  now: Date,
  recentKeys: string[],
  ctx: DiscoveryRankingContext,
  localEvents?: LocalEvent[]
): Candidate[] {
  const out: Candidate[] = [];
  for (const { moment, score } of activeSeasonalMoments(now)) {
    const evidence = verifySeasonalLocalEvidence(moment.id, ctx, localEvents);
    if (!evidence) continue;

    const base = getBanditSeasonalEditorial(moment.id, moment.title);
    const editorial = composeEvidenceBackedSeasonalEditorial(base, evidence, ctx);
    if (matchesTitle(recentKeys, editorial.headline)) continue;

    const compositeScore = score + evidenceScoreBonus(evidence);
    out.push({
      score: compositeScore,
      story: storyFromEditorial(
        {
          kind: "seasonal",
          id: `bandit_seasonal_${moment.id}`,
          headline: editorial.headline,
          source: "Kindred",
          url: evidence.primary.url ?? null,
          publishedAt: null,
          imageUrl: null,
          imageCaption: null,
          heroMomentId: moment.id,
          category: "seasonal",
          why: evidenceWhyLine(evidence),
          discoveryItem: null,
          claim: null,
          voice: "seasonal",
        },
        editorial
      ),
    });
  }
  return out;
}

function seasonalEventCandidates(
  events: LocalEvent[] | undefined,
  ctx: DiscoveryRankingContext,
  recentKeys: string[]
): Candidate[] {
  const list = events ?? [];
  if (!list.length) return [];

  const items = localEventsAsDiscoveryItems(list);
  const out: Candidate[] = [];

  list.forEach((e, i) => {
    const discoveryItem = items[i];
    if (!discoveryItem) return;

    const hay = `${e.name} ${e.venue} ${e.banditNote ?? ""}`;
    if (isDisqualifiedBanditPickCandidate(hay)) return;
    if (matchesTitle(recentKeys, e.name)) return;
    if (!isWithinEventHorizon(e, ctx.now ?? new Date())) return;

    const now = ctx.now ?? new Date();
    const bucket = e.horizonBucket ?? resolveEventHorizon(e, now);
    const horizonBonus =
      bucket !== "beyond" ? HORIZON_SCORE_BONUS[bucket] : 0;
    const timelyBonus =
      hasBanditTimelySignal(hay) || SEASONAL_EVENT_HINT.test(hay) ? 15 : 0;

    const ranked = scoreDiscoveryItem(discoveryItem, ctx);
    const score = ranked.score + horizonBonus + timelyBonus;
    const editorial = localizeEventEditorial(composeEventEditorial(e), ctx, e);

    out.push({
      score,
      story: storyFromEditorial(
        {
          kind: "event",
          id: discoveryItem.id,
          headline: editorial.headline,
          source: e.sourceName?.trim() || "Local listing",
          url: e.sourceUrl?.trim() || null,
          publishedAt: null,
          imageUrl: e.imageUrl?.trim() || null,
          category: discoveryItem.category,
          why: eventWhyLine(e, now),
          discoveryItem,
          claim: { kind: "event", index: i },
          voice: "limited_time",
        },
        editorial
      ),
    });
  });

  return out;
}

export function selectBanditsPick(input: {
  localEvents?: LocalEvent[];
  discovery: DiscoveryRankingContext;
  recentKeys?: string[];
  recentIntros?: string[];
}): BanditsPickStory | null {
  const now = input.discovery.now ?? new Date();
  const recentKeys = [
    ...(input.recentKeys ?? []),
    ...(input.discovery.recentKeys ?? []),
  ];

  const pool: Candidate[] = [
    ...seasonalCandidates(now, recentKeys, input.discovery, input.localEvents),
    ...seasonalEventCandidates(input.localEvents, input.discovery, recentKeys),
  ];

  if (!pool.length) return null;

  const sorted = [...pool].sort((a, b) => b.score - a.score);
  const winner = sorted.find((c) => c.score >= BANDIT_PICK_MIN_SCORE);
  if (!winner) return null;

  console.log("[bandit:pick] selected", {
    kind: winner.story.kind,
    id: winner.story.id,
    headline: winner.story.headline.slice(0, 60),
    why: winner.story.why.slice(0, 120),
    nearbyCount: winner.story.nearby.length,
    score: Math.round(winner.score),
    poolSize: pool.length,
    evidenceTier:
      winner.story.kind === "seasonal"
        ? winner.story.why.startsWith("Experience verified")
          ? "seasonal_experience"
          : "venue_anchor"
        : "local_event",
  });

  return winner.story;
}

/**
 * Bandit's whisper — 8–20 words, curiosity only. Never duplicated in the article.
 */
export function composeBanditsPickIntro(
  pick: BanditsPickStory,
  editionDate?: string | null,
  recentIntros: string[] = []
): string {
  const avoid = [
    pick.summary,
    pick.closingNote,
    ...pick.body,
    ...pick.nearby.map((n) => n.description),
  ];
  return pickBanditWhisper({
    seed: `${editionDate ?? ""}:${pick.id}`,
    recentIntros,
    avoid,
  });
}

export function composeBanditsPickClosing(
  pick: BanditsPickStory,
  _editionDate?: string | null
): string {
  if (pick.closingNote?.trim()) return pick.closingNote.trim();
  return pick.body.filter(Boolean).at(-1)?.trim() ?? "";
}
