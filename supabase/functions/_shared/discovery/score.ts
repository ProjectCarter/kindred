import { sourceQualityPrior } from "./sources.ts";
import {
  interestToDiscoveryCategories,
  seasonForDate,
  weatherBucket,
} from "./taxonomy.ts";
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
  const weather = weatherBucket(ctx.weatherSummary);
  const reasons: DiscoveryReason[] = [];
  let score = 0;

  // Editorial quality
  const quality = item.quality * 22;
  score += quality;
  reasons.push({
    code: "editorial_quality",
    label: "A quiet desk recommendation",
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
        label: "Fits your place",
        weight: 14,
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

  // Experience first (kindred-recommendations.mdc): Kindred isn't a
  // business directory — hands-on experiences and destinations worth the
  // trip should generally outrank a coffee shop or another everyday
  // errand.
  if (EXPERIENCE_CATEGORIES.has(item.category)) {
    score += 10;
    reasons.push({
      code: "experience_first",
      label: "An experience, not just an errand",
      weight: 10,
    });
  }

  // Local first: a chain is still allowed, but it should never crowd out
  // a strong local alternative a reader couldn't have found on their own.
  if (item.tags.includes("chain")) {
    score -= 16;
    reasons.push({
      code: "chain_deprioritized",
      label: "A local alternative is usually the better find",
      weight: -16,
    });
  }

  // Popularity — soft; never dominate uniqueness
  score += item.popularity * 4;

  // Uniqueness / hidden gem
  const uniq = item.uniqueness * 10;
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
    const venueHay = [
      ...(item.venueCategories ?? []),
      item.title,
      item.dek ?? "",
    ]
      .join(" ")
      .toLowerCase();
    const experienceVenue =
      /escape room|bowling|museum|dog park|trail|garden|theater|mini golf|climbing|axe|kayak|paddle|observatory|planetarium|farmers market/i.test(
        venueHay
      );

    if (everyday && noteLen < 32 && !experienceVenue) {
      score -= 16;
      reasons.push({
        code: "thin_recommendation",
        label: "Held back — not enough reason to recommend today",
        weight: -16,
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
