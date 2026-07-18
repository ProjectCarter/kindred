/**
 * Normalize frozen History Around Town snapshots for v1.0 → v1.1 compatibility.
 */

import type {
  HistoryNearbyLink,
  HistoryPlaceEditorialModule,
  HistoryPlaceSnapshot,
  HistoryTimelineEntry,
} from "./types";

type ModuleLike = Pick<HistoryPlaceEditorialModule, "id" | "body">;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asTimelineArray(value: unknown): HistoryTimelineEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as { year?: unknown; event?: unknown };
      const year = typeof item.year === "string" ? item.year.trim() : "";
      const event = typeof item.event === "string" ? item.event.trim() : "";
      if (!year || !event) return null;
      return { year, event };
    })
    .filter((entry): entry is HistoryTimelineEntry => entry != null);
}

function asNearbyLinks(value: unknown): HistoryNearbyLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Partial<HistoryNearbyLink>;
      if (typeof item.id !== "string" || typeof item.slug !== "string") return null;
      if (typeof item.placeName !== "string" || !item.placeName.trim()) return null;
      return {
        id: item.id,
        slug: item.slug,
        placeName: item.placeName.trim(),
        teaser: typeof item.teaser === "string" ? item.teaser.trim() : null,
        historicalMetadataLine:
          typeof item.historicalMetadataLine === "string"
            ? item.historicalMetadataLine.trim()
            : null,
      };
    })
    .filter((entry): entry is HistoryNearbyLink => entry != null);
}

function asModules(value: unknown): ModuleLike[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Partial<HistoryPlaceEditorialModule>;
      if (typeof item.id !== "string" || typeof item.body !== "string") return null;
      const body = item.body.trim();
      if (!body) return null;
      return { id: item.id, body };
    })
    .filter((entry): entry is ModuleLike => entry != null);
}

function moduleText(modules: ModuleLike[], id: string): string | null {
  const body = modules.find((mod) => mod.id === id)?.body?.trim();
  return body || null;
}

function factsFromModules(modules: ModuleLike[]): string[] {
  const body = moduleText(modules, "interesting_facts");
  if (!body) return [];
  return body
    .split(/(?<=[.!?])\s+/)
    .map((fact) => fact.trim())
    .filter((fact) => fact.length > 20);
}

function lookingCloserFromModules(modules: ModuleLike[]): string[] {
  const architecture = moduleText(modules, "architecture");
  return architecture ? [architecture] : [];
}

function nearbyLinksFromNames(names: string[]): HistoryNearbyLink[] {
  return names.map((name) => {
    const trimmed = name.trim();
    return {
      id: trimmed,
      slug: trimmed.toLowerCase().replace(/\s+/g, "-"),
      placeName: trimmed,
      teaser: null,
      historicalMetadataLine: null,
    };
  });
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Back-compat for v1.0 frozen editions missing v1.1 structured fields. */
export function normalizeHistoryPlaceSnapshot(
  place: Partial<HistoryPlaceSnapshot> & {
    id: string;
    slug: string;
    placeName: string;
    category: HistoryPlaceSnapshot["category"];
    categoryLabel: string;
    teaser: string;
  }
): HistoryPlaceSnapshot {
  const modules = asModules(place.modules);
  const legacyBody = asStringArray(place.body);
  const explicitStory = asStringArray(place.theStory);
  const body = legacyBody.length ? legacyBody : explicitStory;

  const editorialIntroduction =
    optionalString(place.editorialIntroduction) ||
    (body.length ? body[0] : null);

  const theStory = explicitStory.length
    ? explicitStory
    : body.length > 1
      ? body.slice(1)
      : body;

  const didYouKnow = asStringArray(place.didYouKnow).length
    ? asStringArray(place.didYouKnow)
    : factsFromModules(modules);

  const lookingCloser = asStringArray(place.lookingCloser).length
    ? asStringArray(place.lookingCloser)
    : lookingCloserFromModules(modules);

  const nearbyLinks = asNearbyLinks(place.nearbyLinks).length
    ? asNearbyLinks(place.nearbyLinks)
    : nearbyLinksFromNames(asStringArray(place.nearbyPlaces));

  return {
    id: place.id,
    slug: place.slug,
    placeName: place.placeName,
    category: place.category,
    categoryLabel: place.categoryLabel,
    teaser: place.teaser,
    historicalMetadataLine: optionalString(place.historicalMetadataLine),
    yearEstablished: optionalString(place.yearEstablished),
    historicalEra: optionalString(place.historicalEra),
    designations: asStringArray(place.designations),
    editorialIntroduction,
    theStory,
    whyItMatters:
      optionalString(place.whyItMatters) ?? moduleText(modules, "why_it_matters"),
    lookingCloser,
    timeline: asTimelineArray(place.timeline),
    didYouKnow,
    visitingToday: optionalString(place.visitingToday),
    beforeYouGo: optionalString(place.beforeYouGo),
    nearbyLinks,
    closingNote: optionalString(place.closingNote),
    heroImageUrl: optionalString(place.heroImageUrl),
    imageCredit: optionalString(place.imageCredit),
    imageSourceUrl: optionalString(place.imageSourceUrl),
    imageLicense: optionalString(place.imageLicense),
    imagePhotographer: optionalString(place.imagePhotographer),
    imageEra: optionalString(place.imageEra),
    imageDate: optionalString(place.imageDate),
    lat: place.lat ?? null,
    lon: place.lon ?? null,
    address: optionalString(place.address),
    city: optionalString(place.city),
    state: optionalString(place.state),
    phone: optionalString(place.phone),
    officialWebsite: optionalString(place.officialWebsite),
    googleMapsUrl: optionalString(place.googleMapsUrl),
    admissionUrl: optionalString(place.admissionUrl),
    hoursText: optionalString(place.hoursText) ?? moduleText(modules, "hours"),
    admissionText:
      optionalString(place.admissionText) ?? moduleText(modules, "admission"),
    parkingText:
      optionalString(place.parkingText) ?? moduleText(modules, "parking"),
    accessibilityText:
      optionalString(place.accessibilityText) ??
      moduleText(modules, "accessibility"),
    bestTimeToVisit:
      optionalString(place.bestTimeToVisit) ?? moduleText(modules, "best_time"),
    visitDuration: optionalString(place.visitDuration),
    dogPolicy: optionalString(place.dogPolicy),
    body,
    modules: modules.map((mod) => ({
      id: mod.id,
      label: mod.id,
      body: mod.body,
    })),
    nearbyPlaces: asStringArray(place.nearbyPlaces),
  };
}

/** Dedupe Did You Know facts against story copy already shown in the article. */
export function filterUniqueFacts(place: HistoryPlaceSnapshot): string[] {
  const theStory = Array.isArray(place.theStory) ? place.theStory : [];
  const didYouKnow = Array.isArray(place.didYouKnow) ? place.didYouKnow : [];

  const hay = [
    place.editorialIntroduction,
    ...theStory,
    place.whyItMatters,
    place.visitingToday,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return didYouKnow.filter((fact) => {
    const snippet = fact.slice(0, 48).toLowerCase();
    return snippet.length > 12 && !hay.includes(snippet);
  });
}
