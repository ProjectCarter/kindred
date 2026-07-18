/**
 * Editorial Confidence Score (0–100) — internal only, never shown to readers.
 *
 * Kindred behaves like a newspaper editor: when in doubt, leave it out.
 * Accuracy always comes before quantity.
 */

import { hasSubstance, isPlaceholderCopy } from "../contentQuality.ts";
import type { DiscoveryItem } from "../discovery/types.ts";
import type { LocalEvent } from "../localEvents/provider.ts";
import { isGenericEventTitle } from "./venueQuality.ts";

export const EDITORIAL_CONFIDENCE_PUBLISH_IMMEDIATE = 90;
export const EDITORIAL_CONFIDENCE_PUBLISH_COMPLETE = 80;
export const EDITORIAL_CONFIDENCE_ENRICH_MIN = 70;

export type EditorialConfidenceSignal = {
  code: string;
  label: string;
  delta: number;
};

export type EditorialConfidenceAction = "publish" | "enrich" | "reject";

export type EditorialConfidence = {
  score: number;
  action: EditorialConfidenceAction;
  signals: EditorialConfidenceSignal[];
  /** Listing has the fields an editor expects before printing. */
  completeness: boolean;
  /** At least one trusted source corroborates the listing. */
  verified: boolean;
  scoredAt: string;
};

const PLACE_LIKE_CATEGORIES = new Set([
  "coffee",
  "restaurants",
  "beaches",
  "hiking",
  "parks",
  "museums",
  "scenic_drives",
  "experiences",
  "activities",
  "bakeries",
  "gardens",
]);

const OFFICIAL_URL_PATTERN =
  /\.gov\b|nps\.gov|stateparks?|cityof|county\.|library\.|museum\.|\.edu\b|chamber|tourism|visit[a-z]+/i;

const OFFICIAL_SOURCE_PATTERN =
  /\b(national park service|state park|city of|county|library|museum|university|college|chamber of commerce|tourism bureau|ticketmaster|eventbrite)\b/i;

const RECURRING_FAVORITE_PATTERN =
  /\b(annual|tradition|every (year|month|week)|recurring|classic|beloved|staple|farmers market|symphony|museum|festival)\b/i;

const GENERIC_TEMPLATE_TITLE =
  /^(a quiet café|a neighborhood table|an early shoreline|a ridge trail|an afternoon in a city park|one calm weeknight recipe|a museum afternoon worth the trip)/i;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function pushSignal(
  signals: EditorialConfidenceSignal[],
  code: string,
  label: string,
  delta: number
): number {
  signals.push({ code, label, delta });
  return delta;
}

function resolveAction(
  score: number,
  completeness: boolean
): EditorialConfidenceAction {
  if (score >= EDITORIAL_CONFIDENCE_PUBLISH_IMMEDIATE) return "publish";
  if (score >= EDITORIAL_CONFIDENCE_PUBLISH_COMPLETE) {
    return completeness ? "publish" : "enrich";
  }
  if (score >= EDITORIAL_CONFIDENCE_ENRICH_MIN) return "enrich";
  return "reject";
}

export function shouldPublishEditorialConfidence(
  result: EditorialConfidence
): boolean {
  return result.action === "publish";
}

export function isPlaceLikeDiscoveryItem(item: DiscoveryItem): boolean {
  return PLACE_LIKE_CATEGORIES.has(item.category);
}

function hasOfficialWebsite(item: DiscoveryItem): boolean {
  if (item.officialWebsite?.trim()) return true;
  const url = (item.url ?? item.source.url ?? "").trim();
  if (!url) return false;
  if (/foursquare\.com|google\.com\/maps|yelp\.com|tripadvisor/i.test(url)) {
    return false;
  }
  if (/\b(ticketmaster|eventbrite|axs|dice\.fm|seatgeek|stubhub)\b/i.test(url)) {
    return false;
  }
  return true;
}

function isVerifiedPlaceProvider(item: DiscoveryItem): boolean {
  if (item.tags.includes("verified") && item.source.tier === "local") {
    return true;
  }
  if (item.id.startsWith("place_") && item.source.tier === "local") {
    return true;
  }
  return false;
}

function isOfficialInstitutionSource(item: DiscoveryItem): boolean {
  if (item.tags.includes("nps_park")) return true;
  const hay = `${item.source.name} ${item.source.url ?? ""} ${item.url ?? ""}`;
  return OFFICIAL_URL_PATTERN.test(hay) || OFFICIAL_SOURCE_PATTERN.test(hay);
}

function hasAuthenticImage(item: DiscoveryItem): boolean {
  const img = item.editorialImage;
  if (!img?.url?.trim()) return false;
  return (
    img.source === "provider" ||
    img.source === "wikimedia" ||
    (img.source === "kindred" && Boolean(item.tags.includes("nps_park")))
  );
}

function hasCrossSourceLocation(item: DiscoveryItem): boolean {
  const hasAddress = Boolean(item.address?.trim());
  const hasCoords =
    typeof item.lat === "number" &&
    typeof item.lon === "number" &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lon);
  const hasCity = Boolean(item.place?.city?.trim());
  const hasVenueCategory = (item.venueCategories?.length ?? 0) > 0;
  const confirmedFields = [hasAddress, hasCoords, hasCity, hasVenueCategory].filter(
    Boolean
  ).length;
  return confirmedFields >= 3;
}

function hasStrongEditorialSignals(item: DiscoveryItem): boolean {
  if (item.tags.includes("chain")) return false;
  if (item.quality >= 0.75 && item.localExpertise >= 0.7) return true;
  if (item.uniqueness >= 0.7 && item.localExpertise >= 0.8) return true;
  if (isVerifiedPlaceProvider(item) && item.localExpertise >= 0.8) return true;
  if (
    item.knowledgeGrounding?.editorialSummary &&
    hasSubstance(item.knowledgeGrounding.editorialSummary, 12)
  ) {
    return true;
  }
  return false;
}

function isInventedOrTemplatePlace(item: DiscoveryItem): boolean {
  if (item.tags.includes("template")) return true;
  if (item.source.name === "Kindred Desk" && isPlaceLikeDiscoveryItem(item)) {
    return true;
  }
  if (GENERIC_TEMPLATE_TITLE.test(item.title.trim())) return true;
  if (isPlaceholderCopy(item.title)) return true;
  return false;
}

function categoryConflictsWithCopy(item: DiscoveryItem): boolean {
  if (!isPlaceLikeDiscoveryItem(item)) return false;
  const hay = [
    item.title,
    item.dek,
    ...(item.venueCategories ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  if (!hay.trim()) return false;

  const contradictions: Partial<Record<string, RegExp>> = {
    beaches: /country club|golf club|rock shop|hardware|pharmacy|bank\b/i,
    museums: /rock shop|gem shop|coffee|café|cafe/i,
    restaurants: /coffee|café|cafe|espresso|roaster/i,
    coffee: /restaurant|steakhouse|pizzeria|diner/i,
    parks: /restaurant|coffee|bowling|escape room|country club/i,
    hiking: /restaurant|coffee shop|bowling|country club|indoor mall/i,
  };
  const re = contradictions[item.category];
  return re ? re.test(hay) : false;
}

function hasWeakOrUnverifiableSource(item: DiscoveryItem): boolean {
  if (isPlaceLikeDiscoveryItem(item)) {
    if (item.source.tier === "kindred" && !item.url && !item.source.url) {
      return true;
    }
    if (item.source.name === "Kindred Desk" && !item.tags.includes("verified")) {
      return true;
    }
  }
  return false;
}

function missingEssentialDiscoveryFields(item: DiscoveryItem): boolean {
  if (!isPlaceLikeDiscoveryItem(item)) {
    return isPlaceholderCopy(item.title) || isPlaceholderCopy(item.dek);
  }
  if (!item.title?.trim()) return true;
  if (!item.place?.city?.trim() && !item.address?.trim()) return true;
  if (!item.url?.trim() && !item.source.url?.trim()) return true;
  if (isPlaceholderCopy(item.dek) && !item.address?.trim()) return true;
  return false;
}

export function isDiscoveryEditoriallyComplete(item: DiscoveryItem): boolean {
  if (!isPlaceLikeDiscoveryItem(item)) {
    return (
      !isPlaceholderCopy(item.title) &&
      !isPlaceholderCopy(item.dek) &&
      Boolean(item.source.name?.trim())
    );
  }
  if (isInventedOrTemplatePlace(item)) return false;
  if (!item.title?.trim()) return false;
  if (!isVerifiedPlaceProvider(item) && !hasOfficialWebsite(item)) return false;
  if (!item.address?.trim() && !(item.lat != null && item.lon != null)) {
    return false;
  }
  if (!item.place?.city?.trim()) return false;
  if (isPlaceholderCopy(item.dek) && !hasSubstance(item.dek, 8)) {
    if (!item.address?.trim()) return false;
  }
  return true;
}

export function hasTrustedDiscoverySource(item: DiscoveryItem): boolean {
  if (isVerifiedPlaceProvider(item)) return true;
  if (isOfficialInstitutionSource(item)) return true;
  if (hasOfficialWebsite(item)) return true;
  if (item.source.tier === "wire" || item.source.tier === "guide") return true;
  if (!isPlaceLikeDiscoveryItem(item) && item.source.tier === "kindred") {
    return !isPlaceholderCopy(item.title);
  }
  return false;
}

/** Score a discovery candidate — internal editorial gate only. */
export function computeDiscoveryConfidence(
  item: DiscoveryItem,
  options?: { scoredAt?: string }
): EditorialConfidence {
  const signals: EditorialConfidenceSignal[] = [];
  let score = 0;

  if (hasOfficialWebsite(item)) {
    score += pushSignal(signals, "official_website", "Official website found", 30);
  }
  if (isVerifiedPlaceProvider(item)) {
    score += pushSignal(
      signals,
      "verified_place",
      "Verified local place listing",
      25
    );
  }
  if (isOfficialInstitutionSource(item)) {
    score += pushSignal(
      signals,
      "official_institution",
      "Government or official institution source",
      20
    );
  }
  if (hasAuthenticImage(item)) {
    score += pushSignal(
      signals,
      "authentic_image",
      "Authentic image from verified source",
      15
    );
  }
  if (hasCrossSourceLocation(item)) {
    score += pushSignal(
      signals,
      "location_confirmed",
      "Address, category, and location corroborated",
      10
    );
  }
  if (
    isVerifiedPlaceProvider(item) &&
    hasOfficialWebsite(item) &&
    Boolean(item.address?.trim()) &&
    Boolean(item.place?.city?.trim())
  ) {
    score += pushSignal(
      signals,
      "verified_listing_complete",
      "Complete verified local listing",
      20
    );
  }
  if (hasStrongEditorialSignals(item)) {
    score += pushSignal(
      signals,
      "editorial_strength",
      "Strong editorial signals",
      10
    );
  }

  // Shared metro catalog rows already passed verification at ingest —
  // do not re-reject them because the provider URL is a maps listing.
  if (
    item.id.startsWith("place_") &&
    isVerifiedPlaceProvider(item) &&
    hasCrossSourceLocation(item) &&
    isDiscoveryEditoriallyComplete(item)
  ) {
    score += pushSignal(
      signals,
      "shared_catalog_listing",
      "Verified shared metro catalog entry",
      45
    );
  }

  if (isInventedOrTemplatePlace(item)) {
    score += pushSignal(
      signals,
      "invented_name",
      "Template or unverified place name",
      -40
    );
  }
  if (
    isPlaceLikeDiscoveryItem(item) &&
    !item.address?.trim() &&
    !(item.lat != null && item.lon != null)
  ) {
    score += pushSignal(
      signals,
      "missing_address",
      "Missing verified address",
      -30
    );
  }
  if (categoryConflictsWithCopy(item)) {
    score += pushSignal(
      signals,
      "category_conflict",
      "Category conflicts with venue copy",
      -25
    );
  }
  if (hasWeakOrUnverifiableSource(item)) {
    score += pushSignal(
      signals,
      "weak_source",
      "Weak or unverifiable source",
      -20
    );
  }
  if (missingEssentialDiscoveryFields(item)) {
    score += pushSignal(
      signals,
      "missing_essential",
      "Missing essential information",
      -15
    );
  }

  const finalScore = clampScore(score);
  const completeness = isDiscoveryEditoriallyComplete(item);
  const verified = hasTrustedDiscoverySource(item);
  const action =
    verified && resolveAction(finalScore, completeness) === "publish"
      ? "publish"
      : resolveAction(finalScore, completeness);

  return {
    score: finalScore,
    action: verified ? action : action === "publish" ? "enrich" : action,
    signals,
    completeness,
    verified,
    scoredAt: options?.scoredAt ?? new Date().toISOString(),
  };
}

function hasOfficialEventWebsite(event: LocalEvent): boolean {
  const url = event.sourceUrl?.trim() ?? "";
  if (!url) return false;
  return (
    OFFICIAL_URL_PATTERN.test(url) ||
    OFFICIAL_SOURCE_PATTERN.test(`${url} ${event.sourceName}`) ||
    event.sourceTier === "official"
  );
}

function hasVerifiedEventVenue(event: LocalEvent): boolean {
  const venue = event.venue?.trim() ?? "";
  if (!venue || venue.toLowerCase() === "venue tba") return false;
  return venue.length >= 3;
}

function hasAuthenticEventImage(event: LocalEvent): boolean {
  return Boolean(event.imageUrl?.trim()) && event.imageSource === "provider_thumbnail";
}

function isEventEditoriallyComplete(event: LocalEvent): boolean {
  if (!event.name?.trim() || isGenericEventTitle(event.name)) return false;
  if (!event.sourceUrl?.trim()) return false;
  if (!hasVerifiedEventVenue(event)) return false;
  if (!event.city?.trim()) return false;
  const schedule = event.startDateTime.trim().toLowerCase();
  if (
    !schedule ||
    schedule === "time tba" ||
    schedule === "date tba" ||
    schedule === "date tba time tba"
  ) {
    return false;
  }
  return true;
}

function hasTrustedEventSource(event: LocalEvent): boolean {
  if (event.sourceTier === "official" || event.sourceTier === "venue") return true;
  const hay = `${event.sourceUrl} ${event.sourceName}`;
  return OFFICIAL_URL_PATTERN.test(hay) || OFFICIAL_SOURCE_PATTERN.test(hay);
}

/** Score a local event — internal editorial gate only. */
export function computeEventConfidence(
  event: LocalEvent,
  options?: { scoredAt?: string }
): EditorialConfidence {
  const signals: EditorialConfidenceSignal[] = [];
  let score = 0;

  if (hasOfficialEventWebsite(event)) {
    score += pushSignal(signals, "official_website", "Official listing URL", 30);
  }
  if (hasVerifiedEventVenue(event)) {
    score += pushSignal(signals, "verified_venue", "Verified venue name", 25);
  }
  if (event.sourceTier === "official" || event.sourceId === "nps_park_events") {
    score += pushSignal(
      signals,
      "official_institution",
      "Official institution source",
      20
    );
  } else if (
    OFFICIAL_SOURCE_PATTERN.test(`${event.sourceName} ${event.sourceUrl}`)
  ) {
    score += pushSignal(
      signals,
      "official_institution",
      "Official institution source",
      20
    );
  }
  if (hasAuthenticEventImage(event)) {
    score += pushSignal(
      signals,
      "authentic_image",
      "Authentic event image",
      15
    );
  } else if (event.imageUrl?.trim()) {
    score += pushSignal(signals, "listing_image", "Listing photograph", 10);
  }

  const locationFields = [
    Boolean(event.city?.trim()),
    hasVerifiedEventVenue(event),
    Boolean(event.sourceUrl?.trim()),
  ].filter(Boolean).length;
  if (locationFields >= 3) {
    score += pushSignal(
      signals,
      "location_confirmed",
      "Venue, city, and listing confirmed",
      10
    );
  }

  const hay = `${event.name} ${event.venue} ${event.category ?? ""}`;
  if (
    RECURRING_FAVORITE_PATTERN.test(hay) ||
    event.sourceTier === "official" ||
    event.badges?.includes("free")
  ) {
    score += pushSignal(
      signals,
      "editorial_strength",
      "Strong editorial signals",
      10
    );
  }

  if (isGenericEventTitle(event.name)) {
    score += pushSignal(
      signals,
      "generic_title",
      "Generic or unverified event title",
      -40
    );
  }
  if (!hasVerifiedEventVenue(event)) {
    score += pushSignal(signals, "missing_venue", "Missing verified venue", -30);
  }
  if (event.sourceTier === "aggregator" && !event.imageUrl?.trim()) {
    if (event.dateSourceType !== "official_ticketing_page") {
      score += pushSignal(
        signals,
        "weak_source",
        "Weak aggregator listing",
        -20
      );
    }
  }
  if (!event.sourceUrl?.trim()) {
    score += pushSignal(
      signals,
      "missing_essential",
      "Missing listing URL",
      -15
    );
  }

  const finalScore = clampScore(score);
  const completeness = isEventEditoriallyComplete(event);
  const verified = hasTrustedEventSource(event);
  const action =
    verified && resolveAction(finalScore, completeness) === "publish"
      ? "publish"
      : resolveAction(finalScore, completeness);

  return {
    score: finalScore,
    action: verified ? action : action === "publish" ? "enrich" : action,
    signals,
    completeness,
    verified,
    scoredAt: options?.scoredAt ?? new Date().toISOString(),
  };
}
