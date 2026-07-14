import type { ImageSourcePropType } from "react-native";
import type { EventInfoBadgeId } from "./eventBadges";
import { inferEventInfoBadges } from "./eventBadges";
import { claimImage } from "./imageRegistry";

export type LocalEventImageSource = "provider_thumbnail";
export type LocalEventCategory =
  | "music"
  | "comedy"
  | "arts"
  | "family"
  | "sports"
  | "food"
  | "market"
  | "nightlife"
  | "community";

const EVENT_CATEGORY_LABEL: Record<LocalEventCategory, string> = {
  music: "Music",
  comedy: "Comedy",
  arts: "Arts",
  family: "Family",
  sports: "Sports",
  food: "Food & Drink",
  market: "Market",
  nightlife: "Nightlife",
  community: "Community",
};

export function eventCategoryLabel(category?: LocalEventCategory | null): string | null {
  if (!category) return null;
  return EVENT_CATEGORY_LABEL[category] ?? null;
}

/**
 * "A recommendation without an image should be considered incomplete"
 * (kindred-mission.mdc). SerpAPI doesn't always return a listing photo —
 * when it doesn't, fall back to a bundled, editorial-quality photograph
 * for that event's genre rather than a bare icon. Still ranked behind a
 * real photo everywhere this is used (see `orderEventsForGrid`).
 */
const EVENT_FALLBACK_IMAGE: Record<LocalEventCategory, ImageSourcePropType> = {
  music: require("../../assets/discovery/event-music.jpg"),
  comedy: require("../../assets/discovery/event-comedy.jpg"),
  arts: require("../../assets/discovery/event-arts.jpg"),
  family: require("../../assets/discovery/event-family.jpg"),
  sports: require("../../assets/discovery/event-sports.jpg"),
  food: require("../../assets/discovery/event-food.jpg"),
  market: require("../../assets/discovery/event-market.jpg"),
  nightlife: require("../../assets/discovery/event-nightlife.jpg"),
  community: require("../../assets/discovery/event-community.jpg"),
};

const ALL_EVENT_FALLBACK_IMAGES = Object.values(EVENT_FALLBACK_IMAGE);

/**
 * `id` (e.g. the event's own name/venue) lets several photo-less events in
 * the same genre rotate through different fallback art instead of all
 * showing the exact same stock photo (kindred-mission.mdc: no duplicate
 * images) — still deduped against every other photo claimed in today's
 * edition, and stable across re-renders for the same event.
 */
export function eventFallbackImage(
  category?: LocalEventCategory | null,
  id?: string | null
): ImageSourcePropType {
  const primary = EVENT_FALLBACK_IMAGE[category ?? "community"] ?? EVENT_FALLBACK_IMAGE.community;
  if (!id) return primary;
  return claimImage(id, [primary], ALL_EVENT_FALLBACK_IMAGES);
}

export type LocalEventCard = {
  name: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  sourceUrl: string;
  sourceName: string;
  /** Authentic listing photograph when the provider supplies one. */
  imageUrl?: string | null;
  /** Provenance — never filled by HeroImageService / weather stock. */
  imageSource?: LocalEventImageSource | null;
  /** Bandit’s invitation — why this is worth leaving the house. */
  banditNote?: string | null;
  /** Keyword-inferred genre, e.g. "music" or "food" — never invented. */
  category?: LocalEventCategory;
  /** Utility badges — structured metadata from the events provider. */
  badges?: EventInfoBadgeId[];
};

export type LocalEventsBody = {
  events: LocalEventCard[];
};

/** Split provider schedule strings like "Sat, Jul 12, 7 – 9 PM" into date + time. */
export function splitEventSchedule(startDateTime: string): {
  date: string;
  time: string;
} {
  const raw = startDateTime.trim();
  if (!raw || raw === "Time TBA") {
    return { date: "Date TBA", time: "Time TBA" };
  }

  const timeMatch = raw.match(
    /(\d{1,2}(?::\d{2})?(?:\s*[–-]\s*\d{1,2}(?::\d{2})?)?\s*[AaPp][Mm].*)$/
  );
  if (timeMatch) {
    const time = timeMatch[1].trim();
    const date = raw.slice(0, raw.length - time.length).replace(/[,\s]+$/, "").trim();
    return {
      date: date || "This week",
      time,
    };
  }

  return { date: raw, time: "See listing" };
}

function normalizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (/google\.com\/maps\/vt/i.test(trimmed)) return null;
  if (/\/favicon/i.test(trimmed) || /faviconV2/i.test(trimmed)) return null;
  if (
    /logo|wordmark|brandmark|sprite|badge|seal|emblem|avatar|icon[_-]?only/i.test(
      trimmed
    )
  ) {
    return null;
  }
  return trimmed;
}

const VALID_CATEGORIES = new Set<LocalEventCategory>([
  "music",
  "comedy",
  "arts",
  "family",
  "sports",
  "food",
  "market",
  "nightlife",
  "community",
]);

/** Same keyword heuristic as the server — only used when an older cached edition has no category yet. */
function inferEventCategoryClient(name: string, venue: string): LocalEventCategory {
  const hay = `${name} ${venue}`.toLowerCase();
  if (/\b(comedy|stand-?up|improv)\b/.test(hay)) return "comedy";
  if (
    /\b(game|match|tournament|marathon|5k|10k|race|triathlon|football|basketball|baseball|softball|soccer|hockey|golf|tennis|pickleball|fitness|yoga|workout|bootcamp)\b/.test(
      hay
    )
  )
    return "sports";
  if (
    /\b(concert|live music|band|dj\b|jazz|symphony|orchestra|choir|singer|album|open mic|acoustic|karaoke)\b/.test(
      hay
    )
  )
    return "music";
  if (
    /\b(art|gallery|exhibit|museum|theater|theatre|play\b|ballet|film screening|movie screening|poetry|opera|dance recital)\b/.test(
      hay
    )
  )
    return "arts";
  if (/\b(kids|children|family|storytime|petting zoo|carnival|toddler)\b/.test(hay))
    return "family";
  if (
    /\b(food|wine|beer|brewery|brewing|tasting|dinner|brunch|culinary|chef|bake sale|bbq|farmers?\s*market)\b/.test(
      hay
    )
  )
    return "food";
  if (/\b(market|craft fair|flea market|pop-?up shop|bazaar|vendor)\b/.test(hay))
    return "market";
  if (/\b(club\b|nightlife|happy hour|late night)\b/.test(hay)) return "nightlife";
  return "community";
}

function normalizeCategory(
  value: unknown,
  name: string,
  venue: string
): LocalEventCategory {
  if (typeof value === "string" && VALID_CATEGORIES.has(value as LocalEventCategory)) {
    return value as LocalEventCategory;
  }
  return inferEventCategoryClient(name, venue);
}

function normalizeBadges(value: unknown): EventInfoBadgeId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set<EventInfoBadgeId>([
    "free",
    "free_parking",
    "tickets_required",
    "dog_friendly",
    "food_drinks",
    "live_music",
  ]);
  const out = value.filter(
    (item): item is EventInfoBadgeId =>
      typeof item === "string" && allowed.has(item as EventInfoBadgeId)
  );
  return out.length ? out : undefined;
}

function normalizeImageSource(
  value: unknown,
  imageUrl: string | null
): LocalEventImageSource | null {
  if (!imageUrl) return null;
  if (value === "provider_thumbnail") return "provider_thumbnail";
  return "provider_thumbnail";
}

/** Client fallback when edition has no Bandit note yet. */
export function fallbackBanditNote(event: Pick<LocalEventCard, "venue">): string {
  const venue = event.venue?.trim();
  if (venue && venue !== "Venue TBA") {
    return `Worth stepping out for — ${venue} has something happening tonight.`;
  }
  return "Worth leaving the house for — a local moment you might otherwise miss.";
}

export function parseLocalEventsBody(
  body: string
): LocalEventCard[] | null {
  try {
    const parsed = JSON.parse(body) as LocalEventsBody;
    if (!parsed || !Array.isArray(parsed.events)) return null;
    return parsed.events
      .filter((e) => e && typeof e.name === "string" && e.name.trim().length > 0)
      .map((e) => {
        const imageUrl = normalizeImageUrl(e.imageUrl);
        const venue = typeof e.venue === "string" ? e.venue.trim() : "";
        const name = e.name.trim();
        const banditNote =
          typeof e.banditNote === "string" && e.banditNote.trim()
            ? e.banditNote.trim()
            : fallbackBanditNote({ venue });
        const category = normalizeCategory(e.category, name, venue);
        const badges =
          normalizeBadges(e.badges) ??
          inferEventInfoBadges({
            name,
            venue,
            date: typeof e.date === "string" ? e.date : undefined,
            time: typeof e.time === "string" ? e.time : undefined,
            category,
            banditNote,
          });
        return {
          name,
          date: typeof e.date === "string" && e.date.trim() ? e.date.trim() : "Date TBA",
          time: typeof e.time === "string" && e.time.trim() ? e.time.trim() : "Time TBA",
          venue,
          city: typeof e.city === "string" ? e.city.trim() : "",
          sourceUrl: typeof e.sourceUrl === "string" ? e.sourceUrl.trim() : "",
          sourceName:
            typeof e.sourceName === "string" && e.sourceName.trim()
              ? e.sourceName.trim()
              : "Listing",
          imageUrl,
          imageSource: normalizeImageSource(e.imageSource, imageUrl),
          banditNote,
          category,
          badges: badges.length ? badges : undefined,
        };
      });
  } catch {
    return null;
  }
}

/**
 * Prefer photograph-backed events, but don't let the grid's 4 slots fill up
 * with the same genre when a livelier day has real variety on offer —
 * a concert, a market, and two food events reads richer than four concerts.
 */
export const LOCAL_EVENTS_GRID_LIMIT = 8;

/**
 * `limit` defaults to the front page's cap (8). Pass a larger value (or
 * `events.length`) for a "show everything" surface like the full Events
 * list — the photo-first / category-diversity ordering still applies, it
 * just stops trimming once `limit` is reached.
 */
export function orderEventsForGrid(
  events: LocalEventCard[],
  limit: number = LOCAL_EVENTS_GRID_LIMIT
): LocalEventCard[] {
  const withPhoto = events.filter((e) => Boolean(e.imageUrl));
  const without = events.filter((e) => !e.imageUrl);
  const byPhotoFirst = [...withPhoto, ...without];

  if (byPhotoFirst.length <= limit) return byPhotoFirst.slice(0, limit);

  const picked: LocalEventCard[] = [];
  const seenCategory = new Set<LocalEventCategory | undefined>();

  for (const event of byPhotoFirst) {
    if (picked.length >= limit) break;
    if (event.category && seenCategory.has(event.category)) continue;
    picked.push(event);
    if (event.category) seenCategory.add(event.category);
  }
  for (const event of byPhotoFirst) {
    if (picked.length >= limit) break;
    if (picked.includes(event)) continue;
    picked.push(event);
  }

  return picked;
}

/**
 * Feature the strongest visual story first: prefer an event that has its own photo.
 */
export function splitFeaturedEvents(events: LocalEventCard[]): {
  featured: LocalEventCard | null;
  secondary: LocalEventCard[];
} {
  if (!events.length) return { featured: null, secondary: [] };

  const featuredIndex = events.findIndex((e) => Boolean(e.imageUrl));
  const index = featuredIndex >= 0 ? featuredIndex : 0;
  const featured = events[index] ?? null;
  const secondary = events.filter((_, i) => i !== index).slice(0, 2);

  return { featured, secondary };
}
