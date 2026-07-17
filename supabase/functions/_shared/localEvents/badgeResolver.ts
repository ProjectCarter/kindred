/**
 * Confidence-based badge resolver for Local Events.
 * Keep in sync with lib/edition/eventBadgeResolver.ts
 *
 * Priority: explicit provider metadata → structured SerpAPI data → AI hints → keywords.
 * The renderer only receives finalized badge IDs — never confidence or sources.
 */

export type EventInfoBadgeId =
  | "free"
  | "free_parking"
  | "tickets_required"
  | "dog_friendly"
  | "food_drinks"
  | "live_music";

export const EVENT_INFO_BADGE_ORDER: EventInfoBadgeId[] = [
  "free",
  "free_parking",
  "tickets_required",
  "dog_friendly",
  "food_drinks",
  "live_music",
];

export const EVENT_INFO_BADGE_MAX = 6;

export const BADGE_MIN_CONFIDENCE = 70;

export type EventCategory =
  | "music"
  | "comedy"
  | "arts"
  | "family"
  | "sports"
  | "food"
  | "market"
  | "nightlife"
  | "community";

export type VenueCategory =
  | "music_venue"
  | "restaurant"
  | "brewery"
  | "park";

export type BadgeSignalTier =
  | "provider_explicit"
  | "provider_structured"
  | "ai_extracted"
  | "keyword_inference";

export type BadgeCandidate = {
  id: EventInfoBadgeId;
  confidence: number;
  tier: BadgeSignalTier;
  source: string;
};

export type EventBadgeSignals = {
  name: string;
  venue: string;
  description?: string | null;
  date?: string;
  time?: string;
  eventCategory?: EventCategory | null;
  /** Provider classification tags — segment, genre, organizer labels. */
  providerTags?: string[];

  venueCategory?: VenueCategory | null;
  admissionCost?: "free" | "paid" | null;
  parkingInfo?: "free" | null;
  venueAttributes?: Partial<Record<EventInfoBadgeId, boolean>>;
  hasVendors?: boolean;

  hasTicketUrl?: boolean;
  ticketLinkType?: "tickets" | "more_info" | null;
  ticketProviders?: string[];
  priceText?: string | null;
  extractedPrice?: number | null;
  isFreePrice?: boolean;

  aiHints?: Partial<Record<EventInfoBadgeId, boolean>>;
};

type BadgeRule = (signals: EventBadgeSignals) => BadgeCandidate | null;

function textHay(signals: EventBadgeSignals): string {
  return `${signals.name} ${signals.venue} ${signals.date ?? ""} ${
    signals.time ?? ""
  }`.toLowerCase();
}

function titleHay(signals: EventBadgeSignals): string {
  return signals.name.toLowerCase();
}

function descriptionHay(signals: EventBadgeSignals): string {
  return (signals.description ?? "").toLowerCase();
}

export function inferVenueCategory(venue: string): VenueCategory | null {
  const v = venue.toLowerCase();
  if (
    /\b(music hall|concert hall|amphitheater|amphitheatre|jazz club|ballroom|auditorium|opera house)\b/.test(
      v
    )
  ) {
    return "music_venue";
  }
  if (/\b(theatre|theater)\b/.test(v) && /\b(music|concert|live)\b/.test(v)) {
    return "music_venue";
  }
  if (/\b(restaurant|cafe|café|bistro|grill|tavern|diner|eatery)\b/.test(v)) {
    return "restaurant";
  }
  if (/\b(brewery|brewing|taproom|brewpub)\b/.test(v)) {
    return "brewery";
  }
  if (/\b(park|garden|arboretum|plaza|square)\b/.test(v)) {
    return "park";
  }
  return null;
}

export function inferAdmissionCost(signals: Pick<
  EventBadgeSignals,
  "extractedPrice" | "priceText" | "isFreePrice"
>): "free" | "paid" | null {
  if (signals.isFreePrice || signals.extractedPrice === 0) return "free";
  if (
    signals.extractedPrice != null &&
    Number.isFinite(signals.extractedPrice) &&
    signals.extractedPrice > 0
  ) {
    return "paid";
  }
  const price = signals.priceText?.trim().toLowerCase();
  if (!price) return null;
  if (/\bfree\b/.test(price)) return "free";
  if (/\$\s*0(?:\b|\.00\b)/.test(price) || price === "0") return "free";
  if (/\$\d+/.test(price)) return "paid";
  return null;
}

/** Tier 3 — parse already-generated Bandit notes; no new AI calls. */
export function extractAiHintsFromBanditNote(
  note: string | null | undefined
): Partial<Record<EventInfoBadgeId, boolean>> {
  if (!note?.trim()) return {};
  const hay = note.toLowerCase();
  const hints: Partial<Record<EventInfoBadgeId, boolean>> = {};

  if (/\bdog[- ]?friendly\b|\bdogs welcome\b|\bpets welcome\b/.test(hay)) {
    hints.dog_friendly = true;
  }
  if (/\bfree parking\b|\bcomplimentary parking\b/.test(hay)) {
    hints.free_parking = true;
  }
  if (/\blive music\b|\bconcert\b/.test(hay)) {
    hints.live_music = true;
  }
  if (/\bfood\b|\bdrinks?\b|\bbrewery\b|\bbrunch\b/.test(hay)) {
    hints.food_drinks = true;
  }
  if (/\bfree admission\b|\bno cover\b|\bfree entry\b/.test(hay)) {
    hints.free = true;
  }
  if (/\btickets required\b|\bticketed\b|\bbuy tickets\b/.test(hay)) {
    hints.tickets_required = true;
  }

  return hints;
}

function resolveFree(signals: EventBadgeSignals): BadgeCandidate | null {
  if (signals.admissionCost === "free") {
    return {
      id: "free",
      confidence: 100,
      tier: "provider_explicit",
      source: "admission:free",
    };
  }
  if (signals.isFreePrice || signals.extractedPrice === 0) {
    return {
      id: "free",
      confidence: 100,
      tier: "provider_structured",
      source: "price:zero",
    };
  }
  if (signals.eventCategory === "community") {
    return {
      id: "free",
      confidence: 90,
      tier: "provider_explicit",
      source: "event_category:community",
    };
  }
  if (signals.aiHints?.free) {
    return {
      id: "free",
      confidence: 90,
      tier: "ai_extracted",
      source: "ai:free",
    };
  }

  const hay = textHay(signals);
  const freeAdmission =
    /\b(free admission|free entry|no cover|no charge|complimentary admission|admission is free|free event|no admission)\b/.test(
      hay
    ) ||
    (/\bfree\b/.test(hay) && !/\bfree parking\b/.test(hay));

  if (freeAdmission) {
    return {
      id: "free",
      confidence: 70,
      tier: "keyword_inference",
      source: "text:free_admission",
    };
  }
  return null;
}

function resolveFreeParking(signals: EventBadgeSignals): BadgeCandidate | null {
  if (signals.parkingInfo === "free") {
    return {
      id: "free_parking",
      confidence: 100,
      tier: "provider_explicit",
      source: "parking:free",
    };
  }
  if (signals.venueAttributes?.free_parking) {
    return {
      id: "free_parking",
      confidence: 95,
      tier: "provider_explicit",
      source: "venue_attribute:free_parking",
    };
  }
  if (signals.aiHints?.free_parking) {
    return {
      id: "free_parking",
      confidence: 85,
      tier: "ai_extracted",
      source: "ai:free_parking",
    };
  }

  const hay = textHay(signals);
  const desc = descriptionHay(signals);
  if (
    /\b(free parking|complimentary parking|parking included|parking is free)\b/.test(
      desc
    )
  ) {
    return {
      id: "free_parking",
      confidence: 90,
      tier: "provider_structured",
      source: "description:free_parking",
    };
  }
  if (
    /\b(free parking|complimentary parking|parking included|parking is free)\b/.test(
      hay
    )
  ) {
    return {
      id: "free_parking",
      confidence: 70,
      tier: "keyword_inference",
      source: "text:free_parking",
    };
  }
  return null;
}

function resolveTicketsRequired(
  signals: EventBadgeSignals
): BadgeCandidate | null {
  if (signals.hasTicketUrl) {
    return {
      id: "tickets_required",
      confidence: 100,
      tier: "provider_explicit",
      source: "ticket_url",
    };
  }
  if (signals.ticketProviders?.length) {
    return {
      id: "tickets_required",
      confidence: 100,
      tier: "provider_explicit",
      source: "ticket_provider",
    };
  }
  if (signals.admissionCost === "paid") {
    return {
      id: "tickets_required",
      confidence: 90,
      tier: "provider_structured",
      source: "admission:paid",
    };
  }
  if (signals.aiHints?.tickets_required) {
    return {
      id: "tickets_required",
      confidence: 85,
      tier: "ai_extracted",
      source: "ai:tickets_required",
    };
  }

  const hay = textHay(signals);
  if (
    /\b(tickets required|ticket required|buy tickets|get tickets|tickets on sale|ticketed|purchase tickets|admission fee|paid admission)\b/.test(
      hay
    )
  ) {
    return {
      id: "tickets_required",
      confidence: 70,
      tier: "keyword_inference",
      source: "text:tickets_required",
    };
  }
  if (/\$\d+/.test(hay) && !/\bfree\b/.test(hay)) {
    return {
      id: "tickets_required",
      confidence: 70,
      tier: "keyword_inference",
      source: "text:price_mention",
    };
  }
  return null;
}

function resolveDogFriendly(signals: EventBadgeSignals): BadgeCandidate | null {
  if (signals.venueAttributes?.dog_friendly) {
    return {
      id: "dog_friendly",
      confidence: 100,
      tier: "provider_explicit",
      source: "venue_attribute:dog_friendly",
    };
  }
  if (signals.aiHints?.dog_friendly) {
    return {
      id: "dog_friendly",
      confidence: 90,
      tier: "ai_extracted",
      source: "ai:dog_friendly",
    };
  }

  const desc = descriptionHay(signals);
  if (/\b(dog[- ]?friendly|dogs welcome|pet[- ]?friendly|pets welcome)\b/.test(desc)) {
    return {
      id: "dog_friendly",
      confidence: 85,
      tier: "provider_structured",
      source: "description:dog_friendly",
    };
  }

  const title = titleHay(signals);
  if (/\b(bring your dog|dogs welcome)\b/.test(title)) {
    return {
      id: "dog_friendly",
      confidence: 70,
      tier: "keyword_inference",
      source: "title:dog_friendly",
    };
  }

  const hay = textHay(signals);
  if (
    /\b(dog[- ]?friendly|dogs welcome|pet[- ]?friendly|pets welcome|bring your dog)\b/.test(
      hay
    )
  ) {
    return {
      id: "dog_friendly",
      confidence: 70,
      tier: "keyword_inference",
      source: "text:dog_friendly",
    };
  }
  return null;
}

function resolveFoodDrinks(signals: EventBadgeSignals): BadgeCandidate | null {
  if (signals.eventCategory === "food" || signals.eventCategory === "market") {
    return {
      id: "food_drinks",
      confidence: 100,
      tier: "provider_explicit",
      source: `event_category:${signals.eventCategory}`,
    };
  }
  if (
    signals.venueCategory === "restaurant" ||
    signals.venueCategory === "brewery"
  ) {
    return {
      id: "food_drinks",
      confidence: 95,
      tier: "provider_explicit",
      source: `venue_category:${signals.venueCategory}`,
    };
  }
  if (signals.hasVendors) {
    return {
      id: "food_drinks",
      confidence: 90,
      tier: "provider_structured",
      source: "vendor_metadata",
    };
  }
  if (signals.aiHints?.food_drinks) {
    return {
      id: "food_drinks",
      confidence: 85,
      tier: "ai_extracted",
      source: "ai:food_drinks",
    };
  }

  const hay = textHay(signals);
  if (
    /\b(food and drinks?|food & drinks?|wine tasting|beer garden|brewery|brunch|dinner|culinary|food truck|bbq|tasting|craft beer|farmers?\s*market)\b/.test(
      hay
    )
  ) {
    return {
      id: "food_drinks",
      confidence: 70,
      tier: "keyword_inference",
      source: "text:food_drinks",
    };
  }
  return null;
}

function resolveLiveMusic(signals: EventBadgeSignals): BadgeCandidate | null {
  if (signals.eventCategory === "music") {
    return {
      id: "live_music",
      confidence: 100,
      tier: "provider_explicit",
      source: "event_category:music",
    };
  }
  if (signals.venueCategory === "music_venue") {
    return {
      id: "live_music",
      confidence: 95,
      tier: "provider_explicit",
      source: "venue_category:music_venue",
    };
  }

  const desc = descriptionHay(signals);
  if (/\blive music\b/.test(desc)) {
    return {
      id: "live_music",
      confidence: 90,
      tier: "provider_structured",
      source: "description:live_music",
    };
  }
  if (signals.aiHints?.live_music) {
    return {
      id: "live_music",
      confidence: 90,
      tier: "ai_extracted",
      source: "ai:live_music",
    };
  }

  const hay = textHay(signals);
  if (
    /\b(live music|live band|concert|dj set|jazz night|symphony|acoustic set|open mic|karaoke)\b/.test(
      hay
    )
  ) {
    return {
      id: "live_music",
      confidence: 85,
      tier: "keyword_inference",
      source: "text:live_music",
    };
  }

  const title = titleHay(signals);
  if (/\bband\b/.test(title)) {
    return {
      id: "live_music",
      confidence: 70,
      tier: "keyword_inference",
      source: "title:band",
    };
  }
  return null;
}

/** Modular rules — add a new badge by registering one resolver function. */
export const BADGE_RULES: Record<EventInfoBadgeId, BadgeRule> = {
  free: resolveFree,
  free_parking: resolveFreeParking,
  tickets_required: resolveTicketsRequired,
  dog_friendly: resolveDogFriendly,
  food_drinks: resolveFoodDrinks,
  live_music: resolveLiveMusic,
};

export function applyBadgeConflicts(
  candidates: BadgeCandidate[]
): BadgeCandidate[] {
  const byId = new Map<EventInfoBadgeId, BadgeCandidate>();
  for (const candidate of candidates) {
    byId.set(candidate.id, candidate);
  }

  const free = byId.get("free");
  const tickets = byId.get("tickets_required");
  if (free && tickets) {
    if (tickets.confidence > free.confidence) {
      byId.delete("free");
    } else if (free.confidence > tickets.confidence) {
      byId.delete("tickets_required");
    } else if (tickets.confidence >= 80) {
      byId.delete("free");
    } else {
      byId.delete("tickets_required");
    }
  }

  return EVENT_INFO_BADGE_ORDER.filter((id) => byId.has(id)).map(
    (id) => byId.get(id)!
  );
}

export function resolveEventBadgeCandidates(
  signals: EventBadgeSignals
): BadgeCandidate[] {
  const candidates: BadgeCandidate[] = [];
  for (const id of EVENT_INFO_BADGE_ORDER) {
    const candidate = BADGE_RULES[id](signals);
    if (candidate && candidate.confidence >= BADGE_MIN_CONFIDENCE) {
      candidates.push(candidate);
    }
  }
  return applyBadgeConflicts(candidates);
}

export function resolveEventBadges(signals: EventBadgeSignals): EventInfoBadgeId[] {
  return resolveEventBadgeCandidates(signals)
    .map((c) => c.id)
    .slice(0, EVENT_INFO_BADGE_MAX);
}

export type EventBadgeSignalInput = {
  name: string;
  venue: string;
  description?: string | null;
  date?: string;
  time?: string;
  category?: EventCategory | null;
  providerTags?: string[];
  banditNote?: string | null;
  hasTicketListing?: boolean;
  ticketLinkType?: "tickets" | "more_info" | null;
  ticketProviders?: string[];
  priceText?: string | null;
  extractedPrice?: number | null;
  parkingInfo?: "free" | null;
  venueAttributes?: Partial<Record<EventInfoBadgeId, boolean>>;
  hasVendors?: boolean;
};

export function buildEventBadgeSignals(
  input: EventBadgeSignalInput
): EventBadgeSignals {
  const venueCategory = inferVenueCategory(input.venue);
  const admissionCost = inferAdmissionCost({
    extractedPrice: input.extractedPrice,
    priceText: input.priceText,
    isFreePrice:
      input.extractedPrice === 0 ||
      input.priceText?.trim().toLowerCase() === "free",
  });

  const aiHints = {
    ...extractAiHintsFromBanditNote(input.banditNote),
  };

  const hasTicketUrl = Boolean(input.hasTicketListing);
  const ticketProviders = (input.ticketProviders ?? []).filter(Boolean);

  const hasVendors =
    input.hasVendors ??
    (input.category === "market" ||
      /\b(vendors?|food trucks?|craft fair|artisan market)\b/i.test(
        `${input.name} ${input.description ?? ""}`
      ));

  return {
    name: input.name,
    venue: input.venue,
    description: input.description ?? null,
    date: input.date,
    time: input.time,
    eventCategory: input.category ?? null,
    providerTags: input.providerTags?.filter(Boolean),
    venueCategory,
    admissionCost,
    parkingInfo: input.parkingInfo ?? null,
    venueAttributes: input.venueAttributes,
    hasVendors,
    hasTicketUrl,
    ticketLinkType: input.ticketLinkType ?? null,
    ticketProviders,
    priceText: input.priceText ?? null,
    extractedPrice: input.extractedPrice ?? null,
    isFreePrice:
      input.extractedPrice === 0 ||
      input.priceText?.trim().toLowerCase() === "free",
    aiHints: Object.keys(aiHints).length ? aiHints : undefined,
  };
}
