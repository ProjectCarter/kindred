export type LocalEventImageSource = "provider_thumbnail";

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
    return `A good reason to step out — ${venue} has something on.`;
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
        const banditNote =
          typeof e.banditNote === "string" && e.banditNote.trim()
            ? e.banditNote.trim()
            : fallbackBanditNote({ venue });
        return {
          name: e.name.trim(),
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
        };
      });
  } catch {
    return null;
  }
}

/**
 * Prefer photograph-backed events for the grid, keep provider order among peers.
 */
export function orderEventsForGrid(events: LocalEventCard[]): LocalEventCard[] {
  const withPhoto = events.filter((e) => Boolean(e.imageUrl));
  const without = events.filter((e) => !e.imageUrl);
  return [...withPhoto, ...without].slice(0, 4);
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
