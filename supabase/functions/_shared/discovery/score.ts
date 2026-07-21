import { sourceQualityPrior } from "./sources.ts";
import { haversineKm } from "./geo.ts";
import { PLANNING_VALUE_PATTERN } from "../editorial/editorialStandard.ts";
import {
  DISCOVERY_ACTIVITY_RADIUS_KM,
  DISCOVERY_FOOD_RADIUS_KM,
} from "../editorial/discoveryGeography.ts";
import { FOOD_DRINK_CATEGORIES } from "./foodDrinkDesk.ts";
import {
  LOCAL_DISCOVERY_CATEGORIES,
  passesLocalDiscoveryRadius,
  surfaceUsesLocalDiscoveryRadius,
} from "./localDiscoveryScope.ts";
import {
  interestToDiscoveryCategories,
  seasonForDate,
  weatherBucket,
} from "./taxonomy.ts";
import {
  sumWeatherIntelligenceScore,
  weatherIntelligenceAdjustments,
} from "../weather/scoring.ts";
import {
  isLowValueVenue,
  isParticipatoryActivityVenue,
  isScenicOrHiddenGem,
  venueHayFromParts,
} from "../editorial/venueQuality.ts";
import { isEditoriallyExcludedListing } from "../localEvents/familyFriendlyFilter.ts";
import type {
  DiscoveryItem,
  DiscoveryRankingContext,
  DiscoveryReason,
  RankedDiscoveryItem,
} from "./types.ts";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * "Experiences first" (kindred-recommendations.mdc): escape rooms, axe
 * throwing, hiking trails, museums, scenic drives — things worth leaving
 * the house for — should generally rank above coffee, restaurants, and
 * other everyday errands. `activities` already collapses every Foursquare
 * activity subtype (kayaking, bowling, mini golf, escape rooms, rock
 * climbing, axe throwing, go-karts, pickleball) into one category.
 */
const EXPERIENCE_CATEGORIES = new Set([
  "activities",
  "hiking",
  "museums",
  "gardens",
  "scenic_drives",
  "beaches",
  "parks",
  "experiences",
]);

function parseEditionDate(editionDate: string, fallback: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(editionDate)) {
    const [y, m, d] = editionDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return fallback;
}

function isValidCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSource(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Score a discovery candidate the way an editorial desk would —
 * quality first, then place, season, weather, taste, uniqueness.
 */
export function scoreDiscoveryItem(
  item: DiscoveryItem,
  ctx: DiscoveryRankingContext
): RankedDiscoveryItem {
  const now = ctx.now ?? new Date();
  const date = parseEditionDate(ctx.editionDate, now);
  const season = ctx.season ?? seasonForDate(date);
  const weather = ctx.weatherIntel?.bucket ?? weatherBucket(ctx.weatherSummary);
  const reasons: DiscoveryReason[] = [];
  let score = 0;

  const listingHay = venueHayFromParts([
    item.title,
    item.dek,
    item.place?.name,
    item.place?.city,
    item.place?.address,
    ...item.tags,
    ...(item.venueCategories ?? []),
  ]);
  const editorialExclusion = isEditoriallyExcludedListing(listingHay);
  if (editorialExclusion.excluded) {
    score -= 500;
    reasons.push({
      code: "editorially_excluded",
      label: `Excluded — ${editorialExclusion.signal ?? "not family-friendly editorial"}`,
      weight: -500,
    });
    return { item, score, reasons };
  }

  // Editorial quality
  const quality = item.quality * 22;
  score += quality;
  reasons.push({
    code: "editorial_quality",
    label: "Worth a closer look",
    weight: quality,
  });

  // Trusted source
  const trusted = sourceQualityPrior(item.source.name);
  const trustScore = trusted.score * 14;
  score += trustScore;
  if (trusted.score >= 0.85) {
    reasons.push({
      code: "trusted_source",
      label: `Trusted source (${item.source.name})`,
      weight: trustScore,
    });
  }

  // Reader interests / affinities
  const interestCats = new Set([
    ...interestToDiscoveryCategories(ctx.interests),
    ...interestToDiscoveryCategories(ctx.followedTopics),
  ]);
  if (interestCats.has(item.category)) {
    score += 12;
    reasons.push({
      code: "reader_interest",
      label: "Fits what you’ve been reading",
      weight: 12,
    });
  }
  const hay = normalize(`${item.title} ${item.dek} ${item.tags.join(" ")}`);
  for (const topic of ctx.followedTopics.slice(0, 6)) {
    const t = normalize(topic);
    if (t.length >= 3 && hay.includes(t)) {
      score += 8;
      reasons.push({
        code: "followed_topic",
        label: `Echoes a topic you follow`,
        weight: 8,
      });
      break;
    }
  }

  // Personalization — favorite publishers (same signal family as news scoring).
  const sourceKey = normalize(item.source.name);
  for (const fav of (ctx.favoriteSources ?? []).slice(0, 6)) {
    const key = normalizeSource(fav);
    if (!key) continue;
    if (sourceKey.includes(key) || key.includes(sourceKey)) {
      score += 10;
      reasons.push({
        code: "favorite_source",
        label: `From a source you often read (${item.source.name})`,
        weight: 10,
      });
      break;
    }
  }

  // Location
  if (ctx.city) {
    const city = normalize(ctx.city);
    const itemCity = normalize(item.place?.city ?? "");
    if (item.tags.includes("local") || item.localExpertise >= 0.7) {
      score += 10;
      reasons.push({
        code: "local_expertise",
        label: `Local character for ${ctx.city}`,
        weight: 10,
      });
    }
    if (itemCity && city && (itemCity.includes(city) || city.includes(itemCity))) {
      score += 14;
      reasons.push({
        code: "location_match",
        label: `In ${ctx.city}`,
        weight: 14,
      });
    }
  }

  // Proximity — verified coordinates only; never geocode or guess.
  if (
    isValidCoord(ctx.readerLat) &&
    isValidCoord(ctx.readerLon) &&
    isValidCoord(item.lat) &&
    isValidCoord(item.lon)
  ) {
    const km = haversineKm(ctx.readerLat, ctx.readerLon, item.lat, item.lon);
    const isLocalDesk = LOCAL_DISCOVERY_CATEGORIES.has(item.category);
    const localRadiusKm = FOOD_DRINK_CATEGORIES.has(item.category)
      ? DISCOVERY_FOOD_RADIUS_KM
      : DISCOVERY_ACTIVITY_RADIUS_KM;

    if (km <= localRadiusKm) {
      score += 12;
      reasons.push({
        code: "proximity_near",
        label: "Close enough to visit soon",
        weight: 12,
      });
    } else if (isLocalDesk) {
      score -= 40;
      reasons.push({
        code: "local_out_of_radius",
        label: "Outside the local newspaper radius",
        weight: -40,
      });
    } else if (km <= 80) {
      score += 6;
      reasons.push({
        code: "proximity_regional",
        label: "A reasonable day trip from home",
        weight: 6,
      });
    } else if (item.tags.includes("nps_park") && km > 200) {
      score -= 10;
      reasons.push({
        code: "proximity_far_nps",
        label: "National park held back — outside the local newspaper radius",
        weight: -10,
      });
    }
  }

  // NPS geographic confidence from provider — low-confidence parks stay off desk.
  if (item.tags.includes("nps_park")) {
    const confidence = item.providerConfidence ?? 0.75;
    if (confidence >= 0.9) {
      score += 8;
      reasons.push({
        code: "nps_high_confidence",
        label: "National Park Service listing near you",
        weight: 8,
      });
    } else if (confidence < 0.6) {
      score -= 12;
      reasons.push({
        code: "nps_low_confidence",
        label: "Park held back — not geographically relevant",
        weight: -12,
      });
    }
  }

  // Season
  if (
    item.seasons.includes("anytime") ||
    item.seasons.includes(season) ||
    (season === "autumn" && item.seasons.includes("fall"))
  ) {
    score += 8;
    reasons.push({
      code: "season_fit",
      label: `In season for ${season}`,
      weight: 8,
    });
  } else {
    score -= 6;
    reasons.push({
      code: "season_mismatch",
      label: "Off-season for this recommendation",
      weight: -6,
    });
  }

  if (PLANNING_VALUE_PATTERN.test(hay)) {
    score += 6;
    reasons.push({
      code: "planning_value",
      label: "Worth planning for this month",
      weight: 6,
    });
  }

  // Weather
  if (
    item.weatherFit.includes("any") ||
    item.weatherFit.includes(weather)
  ) {
    score += 7;
    if (weather !== "any") {
      reasons.push({
        code: "weather_fit",
        label: "Suits today’s weather",
        weight: 7,
      });
    }
  } else if (weather === "rainy" && item.tags.includes("outdoors")) {
    score -= 10;
    reasons.push({
      code: "weather_mismatch",
      label: "Outdoor pick held back for wet weather",
      weight: -10,
    });
  }

  const intelReasons = weatherIntelligenceAdjustments(item, ctx.weatherIntel);
  if (intelReasons.length) {
    score += sumWeatherIntelligenceScore(intelReasons);
    reasons.push(...intelReasons);
  }

  const venueHay = venueHayFromParts([
    item.title,
    item.dek,
    ...(item.venueCategories ?? []),
    item.address,
  ]);

  const participatory =
    item.category !== "activities" || isParticipatoryActivityVenue(venueHay);

  // Experience first (kindred-recommendations.mdc): Kindred isn't a
  // business directory — hands-on experiences and destinations worth the
  // trip should generally outrank a coffee shop or another everyday
  // errand.
  if (EXPERIENCE_CATEGORIES.has(item.category) && participatory) {
    score += 10;
    reasons.push({
      code: "experience_first",
      label: "An experience, not just an errand",
      weight: 10,
    });
  }

  // Local Business First: chains allowed, but should not crowd out a verified
  // local alternative when quality is comparable (kindred-local-business-first.mdc).
  if (item.tags.includes("chain")) {
    const chainPenalty =
      item.category === "coffee" ||
      item.category === "restaurants" ||
      item.category === "bakeries"
        ? -35
        : -20;
    score += chainPenalty;
    reasons.push({
      code: "chain_deprioritized",
      label: "A local alternative is usually the better find",
      weight: chainPenalty,
    });
  }

  if (
    item.tags.includes("local_place") &&
    !item.tags.includes("chain") &&
    (item.category === "coffee" ||
      item.category === "restaurants" ||
      item.category === "bakeries")
  ) {
    score += 12;
    reasons.push({
      code: "local_food_gem",
      label: "Independently owned — worth discovering",
      weight: 12,
    });
  }

  if (item.tags.includes("local_place")) {
    if (isLowValueVenue(venueHay)) {
      score -= 28;
      reasons.push({
        code: "low_value_venue",
        label: "Held back — not the kind of place worth recommending",
        weight: -28,
      });
    }
    if (isScenicOrHiddenGem(venueHay)) {
      score += 12;
      reasons.push({
        code: "scenic_gem",
        label: "A scenic or neighborhood find worth discovering",
        weight: 12,
      });
    }
    if (item.category === "activities" && !participatory) {
      score -= 32;
      reasons.push({
        code: "not_participatory",
        label: "Held back — not a real activity to go do",
        weight: -32,
      });
    }
    if (item.category === "gardens" || /botanical|arboretum/i.test(venueHay)) {
      score += 8;
      reasons.push({
        code: "botanical_gem",
        label: "A beautiful garden worth a slow visit",
        weight: 8,
      });
    }
    if (/historic|heritage|landmark|neighborhood/i.test(venueHay)) {
      score += 6;
      reasons.push({
        code: "local_institution",
        label: "A place with local character and history",
        weight: 6,
      });
    }
  }

  if (isScenicOrHiddenGem(venueHay) && item.uniqueness >= 0.5) {
    score += 6;
    reasons.push({
      code: "hidden_gem_signal",
      label: "A quieter find — worth leaving the usual route",
      weight: 6,
    });
  }

  // Popularity — soft; never dominate uniqueness
  score += item.popularity * 4;

  // Uniqueness / hidden gem
  const uniq = item.uniqueness * 12;
  score += uniq;
  if (item.uniqueness >= 0.75) {
    reasons.push({
      code: "uniqueness",
      label: "A quieter find — uniqueness over hype",
      weight: uniq,
    });
  }

  // Local expertise
  score += item.localExpertise * 8;

  // Freshness — events get a boost; evergreen catalog is stable
  if (item.tags.includes("local_event")) {
    score += 9;
    reasons.push({
      code: "freshness",
      label: "Happening soon — fresh for this edition",
      weight: 9,
    });
  }

  // Weekend preference for outing tags
  if (ctx.isWeekend && (item.tags.includes("weekend") || item.tags.includes("outdoors"))) {
    score += 6;
    reasons.push({
      code: "weekend_fit",
      label: "Suits a weekend edition",
      weight: 6,
    });
  }

  // Anti-repetition
  const recent = ctx.recentKeys ?? [];
  const titleKey = normalize(item.title).slice(0, 60);
  if (
    recent.some(
      (r) =>
        normalize(r).slice(0, 60) === titleKey ||
        normalize(r) === normalize(item.id)
    )
  ) {
    score -= 20;
    reasons.push({
      code: "repetition",
      label: "Recently recommended — held for variety",
      weight: -20,
    });
  }

  // Curation bar — don't recommend a place just because it exists.
  if (item.tags.includes("local_place")) {
    const noteLen = (item.dek?.trim().length ?? 0);
    const everyday = item.category === "coffee" || item.category === "restaurants";
    const venueHayLocal = venueHayFromParts([
      ...(item.venueCategories ?? []),
      item.title,
      item.dek ?? "",
    ]);
    const experienceVenue =
      isParticipatoryActivityVenue(venueHayLocal) ||
      /museum|dog park|trail|garden|theater|observatory|planetarium|farmers market/i.test(
        venueHayLocal
      );

    if (everyday && noteLen < 32 && !experienceVenue) {
      score -= 18;
      reasons.push({
        code: "thin_recommendation",
        label: "Held back — not enough reason to recommend",
        weight: -18,
      });
    }

    if (experienceVenue) {
      score += 8;
      reasons.push({
        code: "experience_venue",
        label: "A real experience worth leaving the house for",
        weight: 8,
      });
    }
  }

  return {
    item,
    score,
    reasons: reasons.sort((a, b) => b.weight - a.weight),
    surfaces: [],
  };
}
