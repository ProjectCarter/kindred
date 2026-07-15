/**
 * Bandit's Pick experience evidence gate.
 *
 * Hierarchy (highest priority first):
 * 1. Verified seasonal experiences
 * 2. Verified local events
 * 3. Verified places and destinations
 * 4. Verified natural phenomena (parks, preserves, viewpoints)
 * 5. Verified community traditions
 *
 * "What meaningful experience could someone have this week?" — not
 * "What business can I recommend?"
 */

import type { DiscoveryRankingContext } from "../discovery/types.ts";
import type { NpsParkRecord } from "../nps/types.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import {
  assessRegionalAuthenticity,
  experienceProfile,
} from "./experienceProfiles.ts";

export type EvidenceTier =
  | "seasonal_experience"
  | "local_event"
  | "place_destination"
  | "natural_phenomenon"
  | "community_tradition";

export type EvidenceSource =
  | "experience"
  | "event"
  | "place"
  | "park"
  | "tradition";

export type ExperienceEvidenceItem = {
  tier: EvidenceTier;
  source: EvidenceSource;
  name: string;
  description: string;
  venue?: string | null;
  address?: string | null;
  city?: string | null;
  url?: string | null;
  category?: string | null;
  strength: "strong" | "moderate";
  score: number;
};

export type ExperienceEvidenceBundle = {
  momentId: string;
  area: string;
  items: ExperienceEvidenceItem[];
  primary: ExperienceEvidenceItem;
  glyph: string;
  /** True when the lead story is the experience itself, not a venue. */
  experienceLed: boolean;
};

type LocalPlace = NonNullable<DiscoveryRankingContext["localPlaces"]>[number];

type MomentMatcher = {
  strongText: RegExp;
  moderateText?: RegExp;
  moderatePlaceCategories?: LocalPlace["category"][];
  parkText?: RegExp;
  traditionText?: RegExp;
};

const CHAIN_PATTERN = /\b(chain|starbucks|mcdonald|walmart|target|costco)\b/i;

const MOMENT_GLYPH: Record<string, string> = {
  monsoon_evenings: "🌧",
  blueberry_season: "🫐",
  peach_season: "🍑",
  strawberry_season: "🍓",
  firefly_season: "✨",
  wildflower_bloom: "🌸",
  cherry_blossoms: "🌸",
  lavender_bloom: "💜",
  pumpkin_patches: "🎃",
  apple_picking: "🍎",
  meteor_showers: "✨",
  butterfly_season: "🦋",
  sunflower_bloom: "🌻",
  holiday_market: "🎄",
  christmas_lights: "✨",
  farmers_markets_reopen: "🧺",
  harvest_peak: "🧺",
  citrus_season: "🍊",
  tomato_season: "🍅",
  apple_cider_donuts: "🍩",
  fall_foliage: "🍂",
  cider_season: "🍎",
  early_lights: "✨",
  salmon_run: "🐟",
  whale_migration: "🐋",
};

const MOMENT_MATCHERS: Record<string, MomentMatcher> = {
  monsoon_evenings: {
    strongText: /\b(monsoon|storm watch|desert sunset|thunderhead)\b/i,
    parkText: /\b(scenic|overlook|preserve|trail|butte|mountain)\b/i,
    moderatePlaceCategories: ["parks", "scenic_drives", "attractions"],
    moderateText: /\b(park|trail|overlook|preserve|scenic)\b/i,
  },
  blueberry_season: { strongText: /\bblueberr/i },
  strawberry_season: { strongText: /\bstrawberr/i },
  peach_season: { strongText: /\bpeach(es)?\b/i },
  tomato_season: { strongText: /\btomato(es)?\b/i },
  citrus_season: { strongText: /\b(citrus|orange grove|lemon grove|grapefruit)\b/i },
  lavender_bloom: { strongText: /\blavender\b/i },
  sunflower_bloom: { strongText: /\bsunflower/i },
  pumpkin_patches: { strongText: /\b(pumpkin patch|pumpkin farm|pumpkin)\b/i },
  apple_picking: { strongText: /\b(apple pick|apple orchard|u-?pick apple)\b/i },
  apple_cider_donuts: { strongText: /\b(cider donut|apple cider|cidery|cider mill)\b/i },
  cider_season: { strongText: /\b(cider mill|cidery|apple cider)\b/i },
  cherry_blossoms: { strongText: /\b(cherry blossom|sakura)\b/i },
  wildflower_bloom: {
    strongText: /\b(wildflower|super bloom|desert bloom)\b/i,
    parkText: /\b(trail|meadow|preserve|wildflower|botanical)\b/i,
    moderatePlaceCategories: ["parks", "gardens", "scenic_drives"],
    moderateText: /\b(botanical|preserve|trail|meadow)\b/i,
  },
  firefly_season: { strongText: /\bfirefl/i },
  butterfly_season: { strongText: /\b(butterfly garden|butterfly exhibit|monarch)\b/i },
  meteor_showers: {
    strongText: /\b(perseid|meteor shower|star party|astronomy)\b/i,
    parkText: /\b(dark sky|observatory|stargaz|scenic|overlook)\b/i,
    moderatePlaceCategories: ["parks", "scenic_drives"],
    moderateText: /\b(park|overlook|trail|preserve)\b/i,
  },
  holiday_market: {
    strongText: /\b(holiday market|christmas market|winter market|craft fair)\b/i,
    traditionText: /\b(holiday market|christmas market|winter market|annual tradition)\b/i,
  },
  christmas_lights: {
    strongText: /\b(holiday lights|christmas lights|light display|tree lighting)\b/i,
    traditionText: /\b(tree lighting|holiday lights|festival of lights)\b/i,
  },
  early_lights: {
    strongText: /\b(holiday lights|christmas lights|light display|tree lighting)\b/i,
  },
  farmers_markets_reopen: {
    strongText: /\b(farmers? market|farm market|producer market)\b/i,
    traditionText: /\b(farmers? market|saturday market)\b/i,
  },
  harvest_peak: {
    strongText: /\b(harvest festival|harvest fair|farmers? market)\b/i,
    moderateText: /\b(farm stand|orchard|produce)\b/i,
    moderatePlaceCategories: ["attractions", "gardens"],
  },
  fall_foliage: {
    strongText: /\b(fall color|leaf peep|autumn foliage)\b/i,
    parkText: /\b(scenic|overlook|trail|forest|drive)\b/i,
    moderatePlaceCategories: ["parks", "scenic_drives"],
    moderateText: /\b(scenic overlook|state park|trail|drive)\b/i,
  },
  salmon_run: { strongText: /\b(salmon run|salmon ladder|spawning salmon)\b/i },
  whale_migration: { strongText: /\b(whale watch|gray whale|orca|whale migration)\b/i },
  fresh_start_january: {
    moderatePlaceCategories: ["museums", "parks", "gardens", "attractions"],
    moderateText: /\b(museum|botanical|garden|park|trail)\b/i,
    strongText: /\b(winter walk|first friday|gallery)\b/i,
  },
  early_spring_thaw: {
    moderatePlaceCategories: ["gardens", "parks", "museums"],
    moderateText: /\b(botanical|garden|arboretum|nature center)\b/i,
    strongText: /\b(botanical garden|spring bloom|garden walk)\b/i,
  },
  longest_days: {
    moderatePlaceCategories: ["parks", "beaches", "water_recreation", "gardens", "attractions"],
    moderateText: /\b(park|lake|beach|trail|pool|splash)\b/i,
    parkText: /\b(lake|trail|scenic|recreation)\b/i,
    strongText: /\b(summer concert|outdoor movie|evening event|solstice)\b/i,
  },
  first_cool_morning: {
    moderatePlaceCategories: ["parks", "scenic_drives", "gardens"],
    moderateText: /\b(trail|hike|preserve|nature|overlook)\b/i,
    parkText: /\b(trail|hike|scenic)\b/i,
  },
  quiet_year_end: {
    moderatePlaceCategories: ["museums", "parks", "attractions"],
    moderateText: /\b(museum|garden|park|downtown)\b/i,
    traditionText: /\b(tree lighting|holiday tradition|lantern)\b/i,
    strongText: /\b(holiday|new year|winter walk|lantern)\b/i,
  },
};

const MIN_ANCHOR_SCORE = 45;

function areaLabel(ctx: DiscoveryRankingContext): string {
  const city = ctx.city?.trim();
  if (city && city.toLowerCase() !== "your area") return city;
  const region = ctx.region?.trim();
  if (region) return region;
  return "the area";
}

function placeHay(place: LocalPlace): string {
  return [
    place.name,
    place.note,
    place.category,
    ...(place.providerCategories ?? []),
    place.address,
    place.city,
  ]
    .filter(Boolean)
    .join(" ");
}

function verifiedDescription(
  note: string | null | undefined,
  fallback: string
): string {
  const trimmed = note?.trim();
  if (trimmed && trimmed.length >= 20 && trimmed.length <= 200) {
    const sentence = trimmed.split(/(?<=[.!?])\s+/)[0]?.trim();
    if (sentence && sentence.length >= 20) {
      return sentence.endsWith(".") ? sentence : `${sentence}.`;
    }
  }
  return fallback;
}

function scoreMatcher(
  matcher: MomentMatcher,
  hay: string,
  name: string,
  ctx: DiscoveryRankingContext,
  city: string | null | undefined,
  options?: { category?: string | null; hasNote?: boolean }
): { score: number; strength: "strong" | "moderate" } | null {
  if (CHAIN_PATTERN.test(name)) return null;

  const readerCity = ctx.city?.trim().toLowerCase();
  const itemCity = city?.trim().toLowerCase();

  if (matcher.strongText.test(hay)) {
    let score = matcher.strongText.test(name) ? 72 : 58;
    if (readerCity && itemCity && readerCity === itemCity) score += 12;
    if (options?.hasNote) score += 6;
    return { score, strength: "strong" };
  }

  if (
    matcher.moderateText?.test(hay) &&
    options?.category &&
    matcher.moderatePlaceCategories?.includes(
      options.category as LocalPlace["category"]
    )
  ) {
    let score = 48;
    if (readerCity && itemCity && readerCity === itemCity) score += 10;
    if (options?.hasNote) score += 6;
    return { score, strength: "moderate" };
  }

  return null;
}

function tierForSource(
  source: EvidenceSource,
  item: { strength: "strong" | "moderate" },
  matcher: MomentMatcher,
  hay: string
): EvidenceTier {
  if (source === "experience") return "seasonal_experience";
  if (source === "event") {
    return matcher.traditionText?.test(hay) ? "community_tradition" : "local_event";
  }
  if (source === "park") return "natural_phenomenon";
  return item.strength === "strong" ? "place_destination" : "natural_phenomenon";
}

function collectEvents(
  matcher: MomentMatcher,
  ctx: DiscoveryRankingContext,
  localEvents?: LocalEvent[]
): ExperienceEvidenceItem[] {
  const out: ExperienceEvidenceItem[] = [];
  for (const event of localEvents ?? []) {
    const hay = `${event.name} ${event.venue} ${event.banditNote ?? ""}`;
    const scored = scoreMatcher(matcher, hay, event.name, ctx, event.city, {
      hasNote: Boolean(event.banditNote?.trim()),
    });
    if (!scored || scored.score < MIN_ANCHOR_SCORE) continue;

    out.push({
      tier: tierForSource("event", scored, matcher, hay),
      source: "event",
      name: event.name.trim(),
      description: verifiedDescription(
        event.banditNote,
        `${event.name.trim()}${event.venue ? ` at ${event.venue}` : ""} is on the local calendar this week.`
      ),
      venue: event.venue,
      city: event.city,
      url: event.sourceUrl,
      strength: scored.strength,
      score: scored.score + 8,
    });
  }
  return out;
}

function collectPlaces(
  matcher: MomentMatcher,
  ctx: DiscoveryRankingContext
): ExperienceEvidenceItem[] {
  const out: ExperienceEvidenceItem[] = [];
  for (const place of ctx.localPlaces ?? []) {
    const hay = placeHay(place);
    const scored = scoreMatcher(matcher, hay, place.name, ctx, place.city, {
      category: place.category,
      hasNote: Boolean(place.note?.trim()),
    });
    if (!scored || scored.score < MIN_ANCHOR_SCORE) continue;

    out.push({
      tier: tierForSource("place", scored, matcher, hay),
      source: "place",
      name: place.name.trim(),
      description: verifiedDescription(
        place.note,
        `${place.name.trim()} is one of the local places where this actually happens near ${areaLabel(ctx)}.`
      ),
      address: place.address,
      city: place.city,
      url: place.url,
      category: place.category,
      strength: scored.strength,
      score: scored.score,
    });
  }
  return out;
}

function collectParks(
  matcher: MomentMatcher,
  ctx: DiscoveryRankingContext
): ExperienceEvidenceItem[] {
  if (!matcher.parkText) return [];
  const out: ExperienceEvidenceItem[] = [];
  for (const park of ctx.npsParks ?? []) {
    const hay = `${park.fullName} ${park.description} ${park.designation}`;
    if (!matcher.parkText.test(hay)) continue;
    if ((park.confidence ?? 0) < 0.5) continue;

    let score = 54;
    if ((park.distanceKm ?? 999) < 80) score += 10;
    if ((park.distanceKm ?? 999) < 40) score += 8;

    const snippet = park.description.trim().split(/(?<=[.!?])\s+/)[0]?.trim();
    out.push({
      tier: "natural_phenomenon",
      source: "park",
      name: park.fullName.trim(),
      description:
        snippet && snippet.length >= 30
          ? snippet.endsWith(".")
            ? snippet
            : `${snippet}.`
          : `${park.fullName.trim()} is a verified outdoor destination within reach of ${areaLabel(ctx)}.`,
      city: null,
      url: park.url,
      category: "park",
      strength: "moderate",
      score,
    });
  }
  return out;
}

function buildSeasonalExperience(
  momentId: string,
  ctx: DiscoveryRankingContext
): ExperienceEvidenceItem | null {
  const profile = experienceProfile(momentId);
  if (!profile || profile.requiresVenue || !profile.phenomenon) return null;

  const regional = assessRegionalAuthenticity(momentId, ctx);
  if (!regional.ok) return null;

  const area = areaLabel(ctx);
  return {
    tier: "seasonal_experience",
    source: "experience",
    name: profile.experienceTitle,
    description: profile.describeExperience(area, ctx),
    strength: "strong",
    score: 88,
  };
}

function dedupeItems(items: ExperienceEvidenceItem[]): ExperienceEvidenceItem[] {
  const tierRank: Record<EvidenceTier, number> = {
    seasonal_experience: 5,
    local_event: 4,
    community_tradition: 3,
    place_destination: 2,
    natural_phenomenon: 1,
  };

  return items
    .sort((a, b) => {
      const tierDiff = tierRank[b.tier] - tierRank[a.tier];
      if (tierDiff !== 0) return tierDiff;
      return b.score - a.score;
    })
    .filter((item, index, list) => {
      const key = item.name.trim().toLowerCase();
      return list.findIndex((x) => x.name.trim().toLowerCase() === key) === index;
    });
}

/**
 * Verify that a seasonal moment is a genuine local experience this week.
 */
export function verifySeasonalLocalEvidence(
  momentId: string,
  ctx: DiscoveryRankingContext,
  localEvents?: LocalEvent[]
): ExperienceEvidenceBundle | null {
  const matcher = MOMENT_MATCHERS[momentId];
  const profile = experienceProfile(momentId);
  if (!matcher || !profile) return null;

  const regional = assessRegionalAuthenticity(momentId, ctx);
  if (!regional.ok) return null;

  const experience = buildSeasonalExperience(momentId, ctx);
  const anchors = dedupeItems([
    ...collectEvents(matcher, ctx, localEvents),
    ...collectPlaces(matcher, ctx),
    ...collectParks(matcher, ctx),
  ]);

  if (profile.requiresVenue) {
    const venueAnchors = anchors.filter(
      (a) =>
        a.tier === "local_event" ||
        a.tier === "community_tradition" ||
        (a.tier === "place_destination" && a.strength === "strong")
    );
    if (!venueAnchors.length) return null;

    return {
      momentId,
      area: areaLabel(ctx),
      items: venueAnchors.slice(0, 3),
      primary: venueAnchors[0],
      glyph: MOMENT_GLYPH[momentId] ?? "📍",
      experienceLed: false,
    };
  }

  if (!experience && !anchors.length) return null;

  const items = dedupeItems([
    ...(experience ? [experience] : []),
    ...anchors,
  ]).slice(0, 4);

  const primary = items[0];
  const experienceLed = primary.tier === "seasonal_experience";

  return {
    momentId,
    area: areaLabel(ctx),
    items: items.slice(0, 3),
    primary,
    glyph: MOMENT_GLYPH[momentId] ?? "📍",
    experienceLed,
  };
}

const TIER_SCORE_BONUS: Record<EvidenceTier, number> = {
  seasonal_experience: 24,
  local_event: 14,
  community_tradition: 12,
  place_destination: 8,
  natural_phenomenon: 6,
};

/** Ranking bonus — experience-led picks win over bare venue listings. */
export function evidenceScoreBonus(bundle: ExperienceEvidenceBundle): number {
  const tierBonus = TIER_SCORE_BONUS[bundle.primary.tier] ?? 0;
  const anchorBonus = Math.min(
    16,
    bundle.items.filter((i) => i.tier !== "seasonal_experience").length * 4
  );
  const experienceLedBonus = bundle.experienceLed ? 10 : 0;
  return tierBonus + anchorBonus + experienceLedBonus;
}

export function evidenceWhyLine(bundle: ExperienceEvidenceBundle): string {
  const description = bundle.primary.description?.trim();
  if (description && !/\b(verified|evidence|confidence)\b/i.test(description)) {
    return description;
  }
  return "";
}

// Back-compat aliases for existing imports
export type LocalEvidenceBundle = ExperienceEvidenceBundle;
export type LocalEvidenceItem = ExperienceEvidenceItem;
