/**
 * Bandit's Pick generator — whisper, headline, local body, nearby picks.
 */

import { matchesRecentCoverage } from "../stories/diversity.ts";
import type { ScoredCandidate } from "../stories/score.ts";
import type { CandidateStory } from "../stories/types.ts";
import {
  HEAVY_TONE_HINTS,
  isPublicSafetyStory,
  UPLIFT_TONE_HINTS,
} from "../editor/tone.ts";
import {
  localEventsAsDiscoveryItems,
  localPlacesAsDiscoveryItems,
} from "../discovery/catalog.ts";
import { scoreDiscoveryItem } from "../discovery/score.ts";
import { whyLine as discoveryWhyLine } from "../discovery/select.ts";
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

type BanditVoiceBucket =
  | "seasonal"
  | "limited_time"
  | "hidden_gem"
  | "activity"
  | "article"
  | "general";

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
  claim:
    | { kind: "event"; index: number }
    | { kind: "place"; providerId: string }
    | null;
  voice: BanditVoiceBucket;
};

type Candidate = { story: BanditsPickStory; score: number };

const BANDIT_PICK_MIN_SCORE = 42;

const SEASONAL_EVENT_HINT =
  /\b(festival|fair|harvest|bloom|blossom|lights|tree lighting|holiday market|winter market|pumpkin|apple picking|cider|peach|strawberry|blueberry|cherry blossom|wildflower|firefly|meteor|perseid|lavender|county fair|state fair|annual|seasonal|concert|live music|comedy|theater|theatre|exhibit|farmers? market|workshop|class(es)?)\b/i;

const TECHNICAL_PATTERN =
  /\b(?:regulators?|regulatory|peptide|impurit(?:y|ies)|compliance|quarterly earnings|shareholders?|litigation|settlement|merger|acquisition|antitrust|layoffs?|bankrupt(?:cy)?|sec filing|ipo|interest rates?|federal reserve|tariffs?|earnings call|stock (?:price|market)|shares (?:fell|rose|slipped|jumped|plunged)|data breach|supply chain|inflation|gdp|unemployment rate|press release|proxy fight|board of directors|quarterly (?:report|results)|filing with|patent dispute|product recall|drug regulators?)\b/;

const DELIGHT_PATTERN =
  /\b(hidden|secret|mystery|mysterious|centuries-old|ancient|folklore|tradition|handmade|artisan|family[- ]owned|first time|rare|unusual|little-known|forgotten|quirky|surprising|remarkable|astonishing|breathtaking|stunning|beautiful|gorgeous|photographs?|photos reveal|images reveal|time-lapse|dazzling|since 19\d\d|since 20[0-2]\d|generations|neighborhood institution|beloved|tucked away|one[- ]of[- ]a[- ]kind)\b/;

const WORTH_THE_TRIP_CATEGORIES = new Set([
  "activities",
  "museums",
  "gardens",
  "scenic_drives",
  "hiking",
  "beaches",
  "parks",
  "experiences",
]);

const HORIZON_SCORE_BONUS: Record<Exclude<EventHorizonBucket, "beyond">, number> = {
  today: 25,
  this_weekend: 22,
  next_weekend: 18,
  coming_soon: 12,
};

function cleanHeadline(title: string): string {
  return title.replace(/\s+[—–|-]\s+[^—–|-]+$/, "").trim();
}

function conciseSummary(description: string, title: string): string {
  const raw = (description || title).replace(/\s+/g, " ").trim();
  if (raw.length <= 220) return raw;
  const sliced = raw.slice(0, 217);
  const lastStop = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("; "),
    sliced.lastIndexOf(", ")
  );
  if (lastStop > 120) return sliced.slice(0, lastStop + 1).trim();
  return `${sliced.trim()}…`;
}

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

function isDisqualifyingTone(text: string): boolean {
  const hay = text.toLowerCase();
  if (TECHNICAL_PATTERN.test(hay)) return true;
  const heavy = HEAVY_TONE_HINTS.test(hay);
  if (heavy && !isPublicSafetyStory(hay)) return true;
  return false;
}

function interestOverlap(story: CandidateStory, interests: string[]): number {
  if (!interests.length) return 0;
  const hay = `${story.title} ${story.description} ${story.category ?? ""}`.toLowerCase();
  let hits = 0;
  for (const interest of interests) {
    const token = interest.trim().toLowerCase();
    if (token.length >= 3 && hay.includes(token)) hits += 1;
  }
  return hits;
}

function editorialCharacter(story: CandidateStory): {
  technical: boolean;
  heavy: boolean;
  heavySafety: boolean;
  delightful: boolean;
} {
  const hay = `${story.title} ${story.description}`.toLowerCase();
  const heavy = HEAVY_TONE_HINTS.test(hay);
  return {
    technical: TECHNICAL_PATTERN.test(hay),
    heavy,
    heavySafety: heavy && isPublicSafetyStory(hay),
    delightful: DELIGHT_PATTERN.test(hay) || UPLIFT_TONE_HINTS.test(hay),
  };
}

function broadenScore(
  c: ScoredCandidate,
  interests: string[],
  frontPageIds: Set<string>,
  recentKeys: string[]
): number {
  let score = c.score * 0.35;

  const overlap = interestOverlap(c.story, interests);
  if (overlap === 0) score += 18;
  else if (overlap === 1) score += 4;
  else score -= 12;

  if (c.reasons.some((r) => r.code === "user_interest")) score -= 16;
  if (c.reasons.some((r) => r.code === "feature_tone")) score += 14;
  if (c.reasons.some((r) => r.code === "weekend_leisure")) score += 6;

  const category = (c.story.category || "").toLowerCase();
  const character = editorialCharacter(c.story);

  if (["culture", "arts", "travel"].includes(category)) score += 12;
  if (["science", "health"].includes(category) && !character.technical) {
    score += 8;
  }

  if (character.delightful) score += 16;
  if (character.technical) score -= 30;
  if (character.heavy) score -= 26;

  if (c.story.pool === "secondary") score += 8;
  if (c.story.pool === "general" && overlap === 0) score += 6;

  if (!frontPageIds.has(c.story.id)) score += 10;
  else score -= 8;

  if (recentKeys.length && matchesRecentCoverage(c.story, recentKeys)) {
    score -= 40;
  }

  return score;
}

function articleWhyLine(c: ScoredCandidate, interests: string[]): string {
  if (editorialCharacter(c.story).delightful) {
    return "The kind of story worth telling someone about later.";
  }
  if (interestOverlap(c.story, interests) === 0) {
    return "A little outside your usual path — chosen to broaden the morning.";
  }
  if (c.reasons.some((r) => r.code === "feature_tone")) {
    return "A quieter piece for curiosity, not the day's hard news.";
  }
  return "One careful recommendation from the desk.";
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

function composePlaceEditorial(input: {
  title: string;
  note?: string | null;
  city?: string | null;
}): {
  headline: string;
  cardExcerpt: string;
  body: string[];
  modules: BanditEditorialModule[];
  closingNote: string;
  mapsQuery: string;
  actionLabel: string;
  nearby: NearbyEditorialPick[];
} {
  const headline = cleanHeadline(input.title);
  const note = input.note?.trim();
  const city = input.city?.trim();
  const cardExcerpt =
    note ||
    (city
      ? `${headline} is one of the local places worth knowing about in ${city}.`
      : `${headline} is worth a closer look when you have an open hour.`);
  return {
    headline,
    cardExcerpt,
    body: [
      cardExcerpt,
      city
        ? `Kindred surfaced it because it reads as genuinely local to ${city} — not the sort of place that announces itself on every corner.`
        : "Kindred surfaced it because it reads as genuinely local — not the sort of place that announces itself on every corner.",
      "Go once with no agenda. The best neighborhood spots reveal themselves slowly.",
    ],
    modules: [],
    closingNote: note
      ? `${headline} is easy to postpone — and easier to remember once you finally go.`
      : `Some of the best places in town are not hidden — they are simply easy to overlook.`,
    mapsQuery: `${headline}${city ? ` ${city}` : ""}`.trim(),
    actionLabel: "Open in Maps",
    nearby: [],
  };
}

function articleCandidates(
  scored: ScoredCandidate[],
  leadId: string | null,
  frontPageIds: Set<string>,
  interests: string[],
  recentKeys: string[],
  allowHeavy: boolean
): Candidate[] {
  const excludeHeavy = (c: ScoredCandidate) => {
    if (allowHeavy) return false;
    const character = editorialCharacter(c.story);
    if (character.technical && !character.delightful) return true;
    if (character.heavy && !character.heavySafety && !character.delightful) {
      return true;
    }
    return false;
  };

  const pool = scored.filter((c) => {
    if (!c.story.id || !c.story.title?.trim()) return false;
    if (leadId && c.story.id === leadId) return false;
    return !excludeHeavy(c);
  });

  return pool.map((c) => {
    const character = editorialCharacter(c.story);
    const headline = cleanHeadline(c.story.title);
    const summary = conciseSummary(c.story.description, c.story.title);
    const editorial = {
      headline,
      cardExcerpt: summary,
      body: [summary],
      modules: [] as BanditEditorialModule[],
      closingNote: articleWhyLine(c, interests),
      mapsQuery: "",
      actionLabel: "Read more",
      nearby: [] as NearbyEditorialPick[],
    };
    return {
      score: broadenScore(c, interests, frontPageIds, recentKeys),
      story: storyFromEditorial(
        {
          kind: "article",
          id: c.story.id,
          headline,
          source: c.story.source,
          url: c.story.url,
          publishedAt: c.story.publishedAt,
          imageUrl: c.story.imageUrl?.trim() || null,
          imageCaption: null,
          heroMomentId: null,
          category: c.story.category,
          why: articleWhyLine(c, interests),
          discoveryItem: null,
          claim: null,
          voice: character.delightful ? "article" : "general",
        },
        editorial
      ),
    };
  });
}

function placeCandidates(
  places: DiscoveryRankingContext["localPlaces"],
  ctx: DiscoveryRankingContext,
  recentKeys: string[]
): Candidate[] {
  const list = places ?? [];
  if (!list.length) return [];
  const items = localPlacesAsDiscoveryItems(list);
  const out: Candidate[] = [];

  list.forEach((p, i) => {
    const discoveryItem = items[i];
    if (!discoveryItem) return;
    if (discoveryItem.tags.includes("chain")) return;

    const hay = `${discoveryItem.title} ${discoveryItem.dek} ${p.note ?? ""}`;
    if (isDisqualifyingTone(hay)) return;
    if (isDisqualifiedBanditPickCandidate(hay)) return;
    if (matchesTitle(recentKeys, discoveryItem.title)) return;

    const delightful = DELIGHT_PATTERN.test(hay.toLowerCase());
    const worthTheTrip = WORTH_THE_TRIP_CATEGORIES.has(discoveryItem.category);
    if (!delightful && !worthTheTrip) return;

    const ranked = scoreDiscoveryItem(discoveryItem, ctx);
    let score = ranked.score;
    if (delightful) score += 20;

    const isActivity = discoveryItem.category === "activities";
    const kind: BanditsPickKind = isActivity
      ? "activity"
      : delightful && !isActivity
      ? "hidden_gem"
      : "place";
    const editorial = composePlaceEditorial({
      title: discoveryItem.title,
      note: p.note,
      city: p.city ?? ctx.city,
    });

    out.push({
      score,
      story: storyFromEditorial(
        {
          kind,
          id: discoveryItem.id,
          headline: editorial.headline,
          source: discoveryItem.source.name,
          url: discoveryItem.url ?? null,
          publishedAt: null,
          imageUrl: null,
          imageCaption: null,
          heroMomentId: null,
          category: discoveryItem.category,
          why: discoveryWhyLine(ranked),
          discoveryItem,
          claim: { kind: "place", providerId: p.providerId },
          voice: isActivity ? "activity" : delightful ? "hidden_gem" : "general",
        },
        editorial
      ),
    });
  });

  return out;
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
          imageCaption: null,
          heroMomentId: null,
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

/**
 * Bandit's Pick — one warm recommendation from every real pool Kindred has
 * today: verified places, local events, seasonal moments, and (when needed)
 * a quieter news story. buildEdition.ts passes the full candidate set here.
 */
export function selectBanditsPick(input: {
  scored?: ScoredCandidate[];
  leadId?: string | null;
  frontPageIds?: string[];
  interests?: string[];
  localEvents?: LocalEvent[];
  discovery: DiscoveryRankingContext;
  recentKeys?: string[];
  recentIntros?: string[];
}): BanditsPickStory | null {
  const now = input.discovery.now ?? new Date();
  const leadId = input.leadId ?? null;
  const frontPageIds = new Set(input.frontPageIds ?? []);
  const interests = input.interests ?? [];
  const recentKeys = [
    ...(input.recentKeys ?? []),
    ...(input.discovery.recentKeys ?? []),
  ];

  const strictPool: Candidate[] = [
    ...articleCandidates(
      input.scored ?? [],
      leadId,
      frontPageIds,
      interests,
      recentKeys,
      false
    ),
    ...placeCandidates(input.discovery.localPlaces, input.discovery, recentKeys),
    ...seasonalCandidates(now, recentKeys, input.discovery, input.localEvents),
    ...seasonalEventCandidates(input.localEvents, input.discovery, recentKeys),
  ];

  const pool = strictPool.length
    ? strictPool
    : articleCandidates(
        input.scored ?? [],
        leadId,
        frontPageIds,
        interests,
        recentKeys,
        true
      );

  if (!pool.length) return null;

  const sorted = [...pool].sort((a, b) => b.score - a.score);
  const winner =
    sorted.find((c) => c.score >= BANDIT_PICK_MIN_SCORE) ?? sorted[0] ?? null;
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
        : winner.story.kind === "event"
        ? "local_event"
        : winner.story.kind,
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
