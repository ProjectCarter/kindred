import { parseLocalEventsBody } from "../edition/localEvents";
import { parseDiscoveryPayload } from "../edition/discovery";
import type { EditionSection } from "../edition/types";
import type { KindredPlace } from "../location/types";
import { KINDRED_LOCAL_RADIUS_MILES } from "../edition/editorialStandard";
import { resolveSportsMarketId } from "../edition/hometownTeams";
import { metroKeyFromPlace } from "../location/metroKey";
import { localEditionDate } from "../edition/dates";
import type { DevEditionDiagnostics } from "./editionOverrideTypes";

function countryFromPlace(place: KindredPlace | null): string | null {
  if (!place) return null;
  if (place.state) return "United States";
  if (place.region) {
    const region = place.region.toLowerCase();
    if (region.includes("england") || region.includes("uk")) return "United Kingdom";
    if (region.includes("france")) return "France";
    if (region.includes("italy")) return "Italy";
    if (region.includes("japan")) return "Japan";
    if (region.includes("australia")) return "Australia";
    if (region.includes("canada") || region.includes("ontario")) return "Canada";
    return place.region;
  }
  return null;
}

export function buildEditionDiagnostics(input: {
  place: KindredPlace | null;
  editionDate: string;
  sections: EditionSection[];
  discovery?: unknown;
  historyAroundTown?: unknown;
  generatedAt?: string | null;
  generationTimeMs?: number | null;
  cacheStatus?: DevEditionDiagnostics["cacheStatus"];
  apiErrors?: string[];
}): DevEditionDiagnostics {
  const eventsSection = input.sections.find((s) => s.section_type === "local_events");
  const events =
    eventsSection?.body != null
      ? parseLocalEventsBody(eventsSection.body) ?? []
      : [];
  const discovery = parseDiscoveryPayload(input.discovery);
  const activities = discovery?.surfaces?.activities?.items.length ?? 0;
  const restaurants =
    discovery?.surfaces?.restaurants?.items.length ??
    discovery?.surfaces?.coffee?.items.length ??
    0;
  const newsStories = input.sections.filter(
    (s) =>
      s.section_type === "top_stories" ||
      s.section_type === "lead_story" ||
      s.section_type === "news"
  ).length;

  const historyBody = input.sections.find(
    (s) => s.section_type === "history_around_town"
  )?.body;
  let historicalArticles = 0;
  if (historyBody) {
    try {
      const parsed = JSON.parse(historyBody) as { places?: unknown[] };
      historicalArticles = parsed.places?.length ?? 0;
    } catch {
      historicalArticles = 0;
    }
  }

  const metroKey = input.place ? metroKeyFromPlace(input.place) : null;

  return {
    city: input.place?.city ?? null,
    country: countryFromPlace(input.place),
    state: input.place?.state ?? input.place?.region ?? null,
    coordinates: input.place
      ? { lat: input.place.lat, lon: input.place.lon }
      : null,
    metroId: resolveSportsMarketId({
      city: input.place?.city,
      state: input.place?.state,
      region: input.place?.region,
      metroKey,
    }),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    localDate: localEditionDate(),
    editionDate: input.editionDate,
    editionGeneratedAt: input.generatedAt ?? null,
    cacheStatus: input.cacheStatus ?? "none",
    radiusMiles: KINDRED_LOCAL_RADIUS_MILES,
    totalEvents: events.length,
    sportsEvents: events.filter((e) => e.category === "sports").length,
    activities,
    restaurants,
    newsStories,
    historicalArticles,
    generationTimeMs: input.generationTimeMs ?? null,
    apiErrors: input.apiErrors ?? [],
  };
}
