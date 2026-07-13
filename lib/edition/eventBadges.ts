import type { LocalEventCard, LocalEventCategory } from "./localEvents";
import {
  EVENT_INFO_BADGE_MAX,
  EVENT_INFO_BADGE_ORDER,
  buildEventBadgeSignals,
  resolveEventBadges,
  type EventInfoBadgeId,
} from "./eventBadgeResolver";

export {
  BADGE_MIN_CONFIDENCE,
  BADGE_RULES,
  EVENT_INFO_BADGE_MAX,
  EVENT_INFO_BADGE_ORDER,
  applyBadgeConflicts,
  buildEventBadgeSignals,
  extractAiHintsFromBanditNote,
  inferAdmissionCost,
  inferVenueCategory,
  resolveEventBadgeCandidates,
  resolveEventBadges,
  type BadgeCandidate,
  type BadgeSignalTier,
  type EventBadgeSignalInput,
  type EventBadgeSignals,
  type EventCategory,
  type EventInfoBadgeId,
  type VenueCategory,
} from "./eventBadgeResolver";

export type EventBadgeInferenceInput = {
  name: string;
  venue: string;
  date?: string;
  time?: string;
  category?: LocalEventCategory | null;
  hasTicketListing?: boolean;
  description?: string | null;
  banditNote?: string | null;
  ticketLinkType?: "tickets" | "more_info" | null;
  ticketProviders?: string[];
  priceText?: string | null;
  extractedPrice?: number | null;
};

/** Infer utility badges from available signals — never invent facts. */
export function inferEventInfoBadges(
  input: EventBadgeInferenceInput
): EventInfoBadgeId[] {
  return resolveEventBadges(
    buildEventBadgeSignals({
      ...input,
      category: input.category ?? null,
    })
  );
}

function normalizeBadgeList(value: unknown): EventInfoBadgeId[] | null {
  if (!Array.isArray(value)) return null;
  const allowed = new Set(EVENT_INFO_BADGE_ORDER);
  const out: EventInfoBadgeId[] = [];
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item as EventInfoBadgeId)) {
      out.push(item as EventInfoBadgeId);
    }
  }
  return out.length ? out : null;
}

/** Resolve badges for a card — stored metadata first, inference as fallback. */
export function eventInfoBadgesFor(
  event: Pick<
    LocalEventCard,
    "name" | "venue" | "date" | "time" | "category" | "badges" | "banditNote"
  >
): EventInfoBadgeId[] {
  const stored = normalizeBadgeList(event.badges);
  if (stored?.length) {
    return EVENT_INFO_BADGE_ORDER.filter((id) => stored.includes(id)).slice(
      0,
      EVENT_INFO_BADGE_MAX
    );
  }
  return inferEventInfoBadges({
    name: event.name,
    venue: event.venue,
    date: event.date,
    time: event.time,
    category: event.category ?? null,
    banditNote: event.banditNote ?? null,
  });
}

export function eventInfoBadgeAccessibilitySummary(
  badges: EventInfoBadgeId[]
): string {
  if (!badges.length) return "";
  const labels: Record<EventInfoBadgeId, string> = {
    free: "Free",
    free_parking: "Free parking",
    tickets_required: "Tickets required",
    dog_friendly: "Dog friendly",
    food_drinks: "Food and drinks",
    live_music: "Live music",
  };
  return badges.map((id) => labels[id]).join(", ");
}
