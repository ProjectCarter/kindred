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
import type {
  DiscoveryItem,
  DiscoveryRankingContext,
} from "../discovery/types.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import { activeSeasonalMoments } from "./seasonalMoments.ts";
import type { BanditsPickKind } from "./types.ts";

/**
 * Which rotating bank of Bandit lines (see composeBanditsPickIntro) fits
 * this pick — kept separate from `kind` because an article can still read
 * as a rare/delightful find, not just "an article."
 */
type BanditVoiceBucket =
  | "seasonal"
  | "limited_time"
  | "hidden_gem"
  | "activity"
  | "article"
  | "general";

export type BanditsPickStory = {
  kind: BanditsPickKind;
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  category: string | null;
  /** Quiet editorial reason — for dek / grounding, not a score label. */
  why: string;
  /** Full Discovery Engine item — present for every non-article kind. */
  discoveryItem: DiscoveryItem | null;
  /**
   * Which live pool this came from, so buildEdition.ts can remove it from
   * everywhere else in today's edition — Bandit's Pick should never also
   * turn up in Local Events or Recommendations. Never persisted.
   */
  claim:
    | { kind: "event"; index: number }
    | { kind: "place"; providerId: string }
    | null;
  /** Internal — feeds composeBanditsPickIntro. Never persisted. */
  voice: BanditVoiceBucket;
};

type Candidate = { story: BanditsPickStory; score: number };

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

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when a recent-coverage key already names this exact title. */
function matchesTitle(recentKeys: string[], title: string): boolean {
  if (!recentKeys.length) return false;
  const t = normalizeKey(title).slice(0, 60);
  if (!t) return false;
  return recentKeys.some((raw) => {
    const k = normalizeKey(raw);
    return Boolean(k) && k.slice(0, 60) === t;
  });
}

function interestOverlap(
  story: CandidateStory,
  interests: string[]
): number {
  if (!interests.length) return 0;
  const hay = `${story.title} ${story.description} ${story.category ?? ""}`.toLowerCase();
  let hits = 0;
  for (const interest of interests) {
    const token = interest.trim().toLowerCase();
    if (token.length >= 3 && hay.includes(token)) hits += 1;
  }
  return hits;
}

/**
 * Bandit recommends like a trusted friend, not a wire desk. This
 * reuses Kindred's shared editorial-tone bank (`editor/tone.ts`) for
 * fear/violence/outrage/scandal, plus a technical/regulatory pattern
 * specific to this slot — dry industry copy that isn't "heavy" but
 * still doesn't belong in a warm closing note. Reused for event/place
 * candidates too, not just news.
 */
const TECHNICAL_PATTERN =
  /\b(?:regulators?|regulatory|peptide|impurit(?:y|ies)|compliance|quarterly earnings|shareholders?|litigation|settlement|merger|acquisition|antitrust|layoffs?|bankrupt(?:cy)?|sec filing|ipo|interest rates?|federal reserve|tariffs?|earnings call|stock (?:price|market)|shares (?:fell|rose|slipped|jumped|plunged)|data breach|supply chain|inflation|gdp|unemployment rate|press release|proxy fight|board of directors|quarterly (?:report|results)|filing with|patent dispute|product recall|drug regulators?)\b/;

const DELIGHT_PATTERN =
  /\b(hidden|secret|mystery|mysterious|centuries-old|ancient|folklore|tradition|handmade|artisan|family[- ]owned|first time|rare|unusual|little-known|forgotten|quirky|surprising|remarkable|astonishing|breathtaking|stunning|beautiful|gorgeous|photographs?|photos reveal|images reveal|time-lapse|dazzling|since 19\d\d|since 20[0-2]\d|generations|neighborhood institution|beloved|tucked away|one[- ]of[- ]a[- ]kind)\b/;

/** Minimum score to earn Bandit's Pick — must feel friend-worthy, not filler. */
const BANDIT_PICK_MIN_SCORE = 54;

function passesFriendTest(discoveryItem: DiscoveryItem): boolean {
  const hay = `${discoveryItem.title} ${discoveryItem.dek}`.toLowerCase();
  if (isDisqualifyingTone(hay)) return false;
  if (discoveryItem.tags.includes("chain")) return false;

  const delightful = DELIGHT_PATTERN.test(hay);
  const worthTheTrip = WORTH_THE_TRIP_CATEGORIES.has(discoveryItem.category);
  const groundedNote = (discoveryItem.dek?.trim().length ?? 0) >= 35;
  const venueHay = [
    ...(discoveryItem.venueCategories ?? []),
    discoveryItem.title,
  ]
    .join(" ")
    .toLowerCase();
  const experienceVenue =
    /escape room|bowling|museum|dog park|trail|garden|theater|mini golf|climbing|axe|kayak|observatory|planetarium/i.test(
      venueHay
    );

  if (discoveryItem.category === "coffee" || discoveryItem.category === "restaurants") {
    return (delightful && groundedNote) || experienceVenue;
  }

  return worthTheTrip || delightful || groundedNote || experienceVenue;
}

function isDisqualifyingTone(text: string): boolean {
  const hay = text.toLowerCase();
  if (TECHNICAL_PATTERN.test(hay)) return true;
  const heavy = HEAVY_TONE_HINTS.test(hay);
  if (heavy && !isPublicSafetyStory(hay)) return true;
  return false;
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
    return "A quieter piece for curiosity, not the day’s hard news.";
  }
  return "One careful recommendation from the desk.";
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
    return {
      score: broadenScore(c, interests, frontPageIds, recentKeys),
      story: {
        kind: "article" as const,
        id: c.story.id,
        headline: cleanHeadline(c.story.title),
        summary: conciseSummary(c.story.description, c.story.title),
        source: c.story.source,
        url: c.story.url,
        publishedAt: c.story.publishedAt,
        imageUrl: c.story.imageUrl?.trim() || null,
        category: c.story.category,
        why: articleWhyLine(c, interests),
        discoveryItem: null,
        claim: null,
        voice: character.delightful ? "article" : ("general" as const),
      },
    };
  });
}

/**
 * "What should I go do?" / real, worth-the-trip categories — museums,
 * gardens, scenic drives, hiking, beaches, parks, and the Activities
 * roster. A plain coffee shop or generic restaurant only clears Bandit's
 * bar when its own note reads as genuinely delightful (see DELIGHT_PATTERN)
 * — Foursquare gives every verified place the same flat quality/uniqueness
 * priors today, so category + Kindred's own written note are the only real
 * rarity signal available.
 */
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

    const hay = `${discoveryItem.title} ${discoveryItem.dek}`;
    if (isDisqualifyingTone(hay)) return;
    if (matchesTitle(recentKeys, discoveryItem.title)) return;
    if (!passesFriendTest(discoveryItem)) return;

    const delightful = DELIGHT_PATTERN.test(hay.toLowerCase());
    const worthTheTrip = WORTH_THE_TRIP_CATEGORIES.has(discoveryItem.category);
    // Rarity gate: an everyday errand (coffee, a plain restaurant) only
    // earns this slot when its own note reads as genuinely special.
    if (!delightful && !worthTheTrip) return;

    const ranked = scoreDiscoveryItem(discoveryItem, ctx);
    let score = ranked.score;
    if (delightful) score += 20;

    const isActivity = discoveryItem.category === "activities";
    const isHiddenGem = delightful && !isActivity;
    const kind: BanditsPickKind = isActivity
      ? "activity"
      : isHiddenGem
      ? "hidden_gem"
      : "place";

    out.push({
      score,
      story: {
        kind,
        id: discoveryItem.id,
        headline: discoveryItem.title,
        summary: discoveryItem.dek,
        source: discoveryItem.source.name,
        url: discoveryItem.url ?? null,
        publishedAt: null,
        imageUrl: null,
        category: discoveryItem.category,
        why: discoveryWhyLine(ranked),
        discoveryItem,
        claim: { kind: "place", providerId: p.providerId },
        voice: isActivity ? "activity" : "hidden_gem",
      },
    });
  });

  return out;
}

function eventCandidates(
  events: LocalEvent[] | undefined,
  ctx: DiscoveryRankingContext,
  recentKeys: string[]
): Candidate[] {
  const list = (events ?? []).slice(0, 12);
  if (!list.length) return [];
  const items = localEventsAsDiscoveryItems(list);
  const out: Candidate[] = [];

  list.forEach((e, i) => {
    const discoveryItem = items[i];
    if (!discoveryItem) return;

    const hay = `${e.name} ${e.venue}`;
    if (isDisqualifyingTone(hay)) return;
    if (matchesTitle(recentKeys, e.name)) return;

    const ranked = scoreDiscoveryItem(discoveryItem, ctx);
    // Events are inherently fresh and time-limited — exactly the "don't
    // let this one slip by" feeling Bandit's Pick is for.
    const score = ranked.score + 14;

    out.push({
      score,
      story: {
        kind: "event",
        id: discoveryItem.id,
        headline: cleanHeadline(e.name.trim()),
        summary: `${e.venue}${e.city ? ` · ${e.city}` : ""}.`.trim(),
        source: e.sourceName?.trim() || "Local listing",
        url: e.sourceUrl?.trim() || null,
        publishedAt: null,
        imageUrl: e.imageUrl?.trim() || null,
        category: discoveryItem.category,
        why: discoveryWhyLine(ranked),
        discoveryItem,
        claim: { kind: "event", index: i },
        voice: "limited_time",
      },
    });
  });

  return out;
}

function seasonalCandidates(now: Date, recentKeys: string[]): Candidate[] {
  const active = activeSeasonalMoments(now);
  const out: Candidate[] = [];

  for (const { moment, score } of active) {
    if (matchesTitle(recentKeys, moment.title)) continue;
    out.push({
      score,
      story: {
        kind: "seasonal",
        id: `bandit_seasonal_${moment.id}`,
        headline: moment.title,
        summary: moment.line,
        source: "Kindred",
        url: null,
        publishedAt: null,
        imageUrl: null,
        category: "seasonal",
        why: "On the calendar today.",
        discoveryItem: null,
        claim: null,
        voice: "seasonal",
      },
    });
  }

  return out;
}

/**
 * Bandit's Pick — exactly one thing, chosen from every real pool Kindred
 * has today: news, verified local places, real local events, and Bandit's
 * own seasonal calendar. Not engagement optimization — a warm, rare,
 * intentional recommendation, closer to a trusted friend's nudge than an
 * algorithm's "top story."
 */
export function selectBanditsPick(input: {
  scored: ScoredCandidate[];
  leadId?: string | null;
  frontPageIds?: string[];
  interests?: string[];
  /** Recent front-page story keys (headlines) — anti-repetition for articles. */
  recentKeys?: string[];
  /**
   * Raw local events (pre-Bandit-note enrichment) — Bandit writes his own
   * line for the pick, so the events desk's separate enrichment pass
   * isn't needed here.
   */
  localEvents?: LocalEvent[];
  /** Discovery context — carries localPlaces/recentKeys(discovery)/weather/season. */
  discovery: DiscoveryRankingContext;
}): BanditsPickStory | null {
  const leadId = input.leadId ?? null;
  const frontPageIds = new Set(input.frontPageIds ?? []);
  const interests = input.interests ?? [];
  const recentKeys = input.recentKeys ?? [];
  const discoveryRecentKeys = input.discovery.recentKeys ?? [];
  const now = input.discovery.now ?? new Date();

  const strictPool: Candidate[] = [
    ...articleCandidates(
      input.scored,
      leadId,
      frontPageIds,
      interests,
      recentKeys,
      false
    ),
    ...placeCandidates(
      input.discovery.localPlaces,
      input.discovery,
      discoveryRecentKeys
    ),
    ...eventCandidates(input.localEvents, input.discovery, discoveryRecentKeys),
    ...seasonalCandidates(now, [...recentKeys, ...discoveryRecentKeys]),
  ];

  // A heavy-news day with no local places/events/season-worthy moment
  // either — better to let through a scored-down heavy article than show
  // nothing at all, mirroring every other "empty is a last resort" rule
  // in this file.
  const pool = strictPool.length
    ? strictPool
    : articleCandidates(
        input.scored,
        leadId,
        frontPageIds,
        interests,
        recentKeys,
        true
      );

  if (!pool.length) return null;

  const sorted = [...pool].sort((a, b) => b.score - a.score);
  const winner =
    sorted.find((c) => c.score >= BANDIT_PICK_MIN_SCORE) ?? sorted[0];
  return winner.story;
}

type BanditVoiceLines = Record<BanditVoiceBucket, string[]>;

const VOICE_LINES: BanditVoiceLines = {
  seasonal: [
    "Only around for a few weeks.",
    "I've been waiting to bring this one up.",
    "Right on time this year.",
  ],
  limited_time: [
    "Don't let this one slip by.",
    "This won't be around long.",
    "Worth building today around.",
  ],
  hidden_gem: [
    "Locals have known about this for years.",
    "Easy to miss if you're not looking.",
    "I had a feeling you'd enjoy this one.",
  ],
  activity: [
    "This looked too good not to share.",
    "Worth clearing an hour for.",
    "I had a feeling you'd enjoy this one.",
  ],
  article: [
    "This one stayed with me.",
    "Worth a slower read, if you have the time.",
    "I held onto this one for you.",
  ],
  general: [
    "I had a feeling you'd enjoy this one.",
    "This looked too good not to share.",
    "Don't let this one slip by.",
  ],
};

/**
 * Bandit's own line — one short sentence, never a pitch. He's still a
 * dog: he doesn't explain why, he just points. Deterministically rotated
 * per pick so the same line doesn't repeat edition to edition.
 */
export function composeBanditsPickIntro(
  pick: BanditsPickStory,
  editionDate?: string | null
): string {
  const bank = VOICE_LINES[pick.voice] ?? VOICE_LINES.general;
  const seed = `${editionDate ?? ""}:${pick.id}`;
  let n = 0;
  for (let i = 0; i < seed.length; i++) {
    n = (n + seed.charCodeAt(i) * (i + 1)) % bank.length;
  }
  return bank[n];
}
