import type { ResolvedEditionMarket } from "./resolveEditionMarket";
import { filterLocalEventsByMarket, filterPlacesByMarket } from "./editionMarketIsolation";
import type { EditionMarketAnchor } from "./editionMarketIsolation";

export type EditionSectionWriteRow = {
  edition_id: string;
  section_type: string;
  position: number;
  headline: string;
  body: string;
  source_note?: string | null;
};

export type EditionSectionAuditRecord = {
  editionId: string;
  sectionType: string;
  position: number;
  metroKey: string;
  catalogMetroKey: string;
  city: string | null;
  state: string | null;
  sourceCatalog: string;
  itemCount: number | null;
  sampleCities: string[];
  crossMetroRejected: boolean;
  rejectReason: string | null;
};

export type EditionDeskGapReport = {
  localNews: { present: boolean; reason?: string };
  banditsPick: { present: boolean; reason?: string };
  morningHero: { present: boolean; reason?: string };
  localEvents: { present: boolean; count: number; reason?: string };
  activities: { present: boolean; count: number; reason?: string };
  recommendations: { present: boolean; count: number; reason?: string };
  foodDrink: { present: boolean; count: number; reason?: string };
};

function parseLocalEventsBody(body: string): Array<{ city?: string; name?: string }> {
  try {
    const parsed = JSON.parse(body) as { events?: Array<{ city?: string; name?: string }> };
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

function parseStoryOfMetroKey(sourceNote: string | null | undefined): string | null {
  if (!sourceNote?.trim()) return null;
  try {
    const parsed = JSON.parse(sourceNote) as { metroKey?: string };
    return parsed.metroKey?.trim() || null;
  } catch {
    return null;
  }
}

function majorityCity(cities: string[]): string | null {
  if (!cities.length) return null;
  const counts = new Map<string, number>();
  for (const c of cities) {
    const key = c.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [city, n] of counts) {
    if (n > bestN) {
      best = city;
      bestN = n;
    }
  }
  return best;
}

export function auditEditionSectionRow(input: {
  row: EditionSectionWriteRow;
  market: ResolvedEditionMarket;
  catalogMetroKey: string;
  anchor: EditionMarketAnchor;
}): EditionSectionAuditRecord {
  const { row, market, catalogMetroKey, anchor } = input;
  const base: EditionSectionAuditRecord = {
    editionId: row.edition_id,
    sectionType: row.section_type,
    position: row.position,
    metroKey: market.metroKey,
    catalogMetroKey,
    city: anchor.city,
    state: anchor.state ?? market.stateCode,
    sourceCatalog: "edition_build",
    itemCount: null,
    sampleCities: [],
    crossMetroRejected: false,
    rejectReason: null,
  };

  switch (row.section_type) {
    case "local_events": {
      const events = parseLocalEventsBody(row.body).map((e) => ({
        name: e.name ?? "event",
        venue: "",
        city: e.city ?? "",
      }));
      base.itemCount = events.length;
      base.sampleCities = events.map((e) => e.city).filter(Boolean).slice(0, 6);
      base.sourceCatalog = `events_catalog:${catalogMetroKey}`;
      const isolation = filterLocalEventsByMarket(events, market, anchor);
      if (isolation.rejected.length > 0) {
        base.crossMetroRejected = true;
        base.rejectReason = isolation.rejected
          .slice(0, 3)
          .map((r) => `${r.name}:${r.reason}`)
          .join("; ");
      }
      base.city = majorityCity(base.sampleCities) ?? base.city;
      return base;
    }
    case "story_of": {
      const storyMetro = parseStoryOfMetroKey(row.source_note);
      base.sourceCatalog = storyMetro ? `kindred_city_articles:${storyMetro}` : "kindred_city_articles";
      if (storyMetro && storyMetro !== catalogMetroKey && storyMetro !== market.metroKey) {
        base.crossMetroRejected = true;
        base.rejectReason = `story_of_metro_mismatch:${storyMetro}`;
      }
      return base;
    }
    case "weather":
      base.sourceCatalog = "open_meteo";
      return base;
    case "top_stories":
      base.sourceCatalog = "newsapi";
      return base;
    case "today_in_history":
      base.sourceCatalog = "wikipedia_on_this_day";
      return base;
    case "looking_ahead":
      base.sourceCatalog = "open_meteo+local_events";
      return base;
    case "greeting":
      base.sourceCatalog = "edition_compose";
      return base;
    default:
      base.sourceCatalog = "unknown";
      return base;
  }
}

export function filterEditionSectionRowsByMarket(input: {
  rows: EditionSectionWriteRow[];
  market: ResolvedEditionMarket;
  catalogMetroKey: string;
  anchor: EditionMarketAnchor;
}): {
  kept: EditionSectionWriteRow[];
  audits: EditionSectionAuditRecord[];
  rejected: EditionSectionAuditRecord[];
} {
  const kept: EditionSectionWriteRow[] = [];
  const audits: EditionSectionAuditRecord[] = [];
  const rejected: EditionSectionAuditRecord[] = [];

  for (const row of input.rows) {
    const audit = auditEditionSectionRow({
      row,
      market: input.market,
      catalogMetroKey: input.catalogMetroKey,
      anchor: input.anchor,
    });
    audits.push(audit);
    if (audit.crossMetroRejected) {
      rejected.push(audit);
      continue;
    }
    kept.push(row);
  }

  return { kept, audits, rejected };
}

export function logEditionSectionWriteAudit(input: {
  traceId?: string | null;
  phase: "pre_delete" | "pre_insert" | "post_insert";
  editionId: string;
  market: ResolvedEditionMarket;
  catalogMetroKey: string;
  anchor: EditionMarketAnchor;
  audits?: EditionSectionAuditRecord[];
  existingSectionTypes?: string[];
  existingSectionCount?: number;
  deleteError?: string | null;
  insertError?: string | null;
}): void {
  console.log("[buildEdition:section-audit]", {
    traceId: input.traceId ?? null,
    phase: input.phase,
    editionId: input.editionId,
    metroKey: input.market.metroKey,
    catalogMetroKey: input.catalogMetroKey,
    city: input.anchor.city,
    state: input.anchor.state ?? input.market.stateCode,
    existingSectionCount: input.existingSectionCount ?? null,
    existingSectionTypes: input.existingSectionTypes ?? null,
    deleteError: input.deleteError ?? null,
    insertError: input.insertError ?? null,
    sections: input.audits ?? null,
  });
}

export function buildEditionDeskGapReport(input: {
  city: string;
  catalogMetroKey: string;
  market: ResolvedEditionMarket | null;
  catalogBootstrap?: {
    eventsCatalogBootstrapped: boolean;
    activitiesCatalogBootstrapped: boolean;
    foodDrinkCatalogBootstrapped: boolean;
  };
  leadStoryPresent: boolean;
  topStoriesCount: number;
  banditsPickPresent: boolean;
  morningHeroPresent: boolean;
  localEventsCount: number;
  discoverySurfaces: Record<string, { items?: unknown[] } | undefined>;
  localPlacesCount: number;
  localPlacesFilteredCount: number;
}): EditionDeskGapReport {
  const surfaceCount = (key: string) =>
    input.discoverySurfaces[key]?.items?.length ?? 0;

  const activitySurfaces = [
    "activities",
    "hiking",
    "museums",
    "parks",
    "beaches",
    "gardens",
    "scenic_drives",
  ];
  const activityCount = activitySurfaces.reduce(
    (sum, key) => sum + surfaceCount(key),
    0
  );

  const recSurfaces = ["coffee", "restaurants", "bakeries"];
  const recCount = recSurfaces.reduce((sum, key) => sum + surfaceCount(key), 0);

  const bootstrap = input.catalogBootstrap;
  const catalogPending =
    bootstrap &&
    !bootstrap.eventsCatalogBootstrapped &&
    !bootstrap.activitiesCatalogBootstrapped &&
    !bootstrap.foodDrinkCatalogBootstrapped;

  return {
    localNews: {
      present: input.leadStoryPresent || input.topStoriesCount > 0,
      reason:
        input.leadStoryPresent || input.topStoriesCount > 0
          ? undefined
          : "newsapi_returned_no_front_page_stories",
    },
    banditsPick: {
      present: input.banditsPickPresent,
      reason: input.banditsPickPresent
        ? undefined
        : "selectBanditsPick_returned_null",
    },
    morningHero: {
      present: input.morningHeroPresent,
      reason: input.morningHeroPresent
        ? undefined
        : "hero_library_empty_or_detail_incomplete",
    },
    localEvents: {
      present: input.localEventsCount > 0,
      count: input.localEventsCount,
      reason:
        input.localEventsCount > 0
          ? undefined
          : catalogPending
            ? `events_catalog_not_bootstrapped:${input.catalogMetroKey}`
            : `events_catalog_empty:${input.catalogMetroKey}`,
    },
    activities: {
      present: activityCount > 0,
      count: activityCount,
      reason:
        activityCount > 0
          ? undefined
          : input.localPlacesFilteredCount === 0
            ? `activities_catalog_empty:${input.catalogMetroKey}`
            : "discovery_allocator_returned_zero_activities",
    },
    recommendations: {
      present: recCount > 0,
      count: recCount,
      reason:
        recCount > 0
          ? undefined
          : input.localPlacesFilteredCount === 0
            ? `food_drink_catalog_empty:${input.catalogMetroKey}`
            : "discovery_allocator_returned_zero_recommendations",
    },
    foodDrink: {
      present: recCount > 0,
      count: recCount,
      reason:
        recCount > 0
          ? undefined
          : `food_drink_catalog_empty:${input.catalogMetroKey}`,
    },
  };
}

export function logEditionDeskGapReport(input: {
  traceId?: string | null;
  editionId: string;
  report: EditionDeskGapReport;
}): void {
  console.log("[buildEdition:desk-gaps]", {
    traceId: input.traceId ?? null,
    editionId: input.editionId,
    ...input.report,
  });
}
