/**
 * Authentic event image enrichment — venue photography when providers omit art.
 * Never AI-generated; Wikipedia lead images for named venues only.
 */

import type { LocalEvent } from "./provider.ts";

const USER_AGENT = "Kindred/1.0 (https://kindred.app; local-events-image-enrichment)";
const MAX_ENRICHMENTS = 8;

const SKIP_VENUE =
  /^(venue tba|tba|online|virtual|multiple locations?)$/i;

async function wikipediaThumbnailForVenue(venue: string): Promise<string | null> {
  const title = venue.trim();
  if (title.length < 4 || SKIP_VENUE.test(title)) return null;

  const path = encodeURIComponent(title.replace(/ /g, "_"));
  let res: Response;
  try {
    res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${path}`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;
  const data = (await res.json()) as { thumbnail?: { source?: string; width?: number } };
  const url = data.thumbnail?.source?.trim();
  const width = data.thumbnail?.width ?? 0;
  if (!url || (width > 0 && width < 320)) return null;
  return url;
}

/**
 * Fill missing listing photos for top events using authentic venue imagery.
 */
export async function enrichEventImages(
  events: LocalEvent[]
): Promise<LocalEvent[]> {
  let enriched = 0;
  const out: LocalEvent[] = [];

  for (const event of events) {
    if (event.imageUrl?.trim() || enriched >= MAX_ENRICHMENTS) {
      out.push(event);
      continue;
    }

    const venueThumb = await wikipediaThumbnailForVenue(event.venue);
    if (!venueThumb) {
      out.push(event);
      continue;
    }

    enriched += 1;
    out.push({
      ...event,
      imageUrl: venueThumb,
      imageSource: "provider_thumbnail",
    });
  }

  if (enriched > 0) {
    console.log("[localEvents:images] enriched venue photography", {
      count: enriched,
    });
  }

  return out;
}
