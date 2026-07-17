/**
 * Provider importers merge into Kindred-owned venue records via Source Manager.
 * Each provider (Foursquare today, Google/Yelp/etc. later) is just another importer.
 */

import {
  appendSourceHistory,
  computeVenueConfidenceFromFields,
  defaultSourceConfidence,
  mergeFieldObservation,
  resolveFieldValue,
  type FieldObservation,
  type KindredSource,
  type SourceHistoryEntry,
  type VenueFieldName,
  type VenueFieldSources,
} from "../editorial/sourceManager.ts";
import {
  resolveLifecycleAfterImport,
  type VenueLifecycle,
} from "../editorial/venueLifecycle.ts";
import { normalizeCatalogName } from "./foodDrinkCatalog.ts";
import type { NormalizedPlace } from "./types.ts";

export type ProviderImportContext = {
  source: KindredSource;
  observedAt: string;
  passesVerification: boolean;
  isNewDiscovery: boolean;
  missingFromFullSync: boolean;
  currentLifecycle: VenueLifecycle;
};

export type MergedVenueRecord = {
  name: string;
  normalized_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lon: number | null;
  url: string | null;
  phone: string | null;
  price_level: number | null;
  cuisine: string | null;
  editorial_categories: string[];
  field_sources: VenueFieldSources;
  source_history: SourceHistoryEntry[];
  confidence_score: number;
  lifecycle: VenueLifecycle;
  verification_status: "pending" | "verified" | "needs_review" | "rejected";
  content_fingerprint: string;
  materialChanged: boolean;
  status: "active" | "rejected" | "duplicate" | "possibly_closed";
};

function inferCuisineFromProviderCategories(categories: string[]): string | null {
  const hay = categories.join(" ").toLowerCase();
  if (/\bpizza\b/.test(hay)) return "pizza";
  if (/\bsushi\b|\bjapanese\b/.test(hay)) return "sushi";
  if (/\bmexican\b|\btaco\b/.test(hay)) return "mexican";
  if (/\bcoffee\b|\bcafé\b|\bcafe\b/.test(hay)) return "coffee";
  if (/\bbakery\b|\bbread\b/.test(hay)) return "bakery";
  if (/\bburger\b/.test(hay)) return "burgers";
  if (/\bsteak\b/.test(hay)) return "steakhouse";
  return null;
}

/** Build field observations from a Foursquare NormalizedPlace. */
export function observationsFromFoursquarePlace(
  place: NormalizedPlace,
  observedAt: string
): Partial<Record<VenueFieldName, FieldObservation>> {
  const source: KindredSource = "foursquare";
  const confidence = defaultSourceConfidence(source);
  const base = { source, confidence, observedAt };

  const cuisine = inferCuisineFromProviderCategories(place.providerCategories ?? []);

  return {
    name: { value: place.name.trim(), ...base },
    address: { value: place.address, ...base },
    city: { value: place.city, ...base },
    state: { value: place.state, ...base },
    lat: { value: place.lat, ...base },
    lon: { value: place.lon, ...base },
    website: { value: place.url, ...base },
    price_level:
      place.priceTier != null
        ? { value: place.priceTier, ...base }
        : undefined,
    cuisine: cuisine ? { value: cuisine, source: "kindred", confidence: 65, observedAt } : undefined,
    editorial_categories: {
      value: [place.category],
      source: "kindred",
      confidence: 80,
      observedAt,
    },
  };
}

function catalogContentFingerprintFromFields(
  fieldSources: VenueFieldSources,
  category: string
): string {
  const parts = [
    String(resolveFieldValue(fieldSources, "name") ?? ""),
    String(resolveFieldValue(fieldSources, "address") ?? ""),
    String(resolveFieldValue(fieldSources, "city") ?? ""),
    String(resolveFieldValue(fieldSources, "state") ?? ""),
    String(resolveFieldValue(fieldSources, "lat") ?? ""),
    String(resolveFieldValue(fieldSources, "lon") ?? ""),
    String(resolveFieldValue(fieldSources, "website") ?? ""),
    category,
  ];
  return parts.join("::").toLowerCase();
}

function verificationStatusForLifecycle(
  lifecycle: VenueLifecycle
): MergedVenueRecord["verification_status"] {
  switch (lifecycle) {
    case "verified":
    case "featured":
    case "evergreen":
      return "verified";
    case "needs_review":
      return "needs_review";
    case "rejected":
      return "rejected";
    default:
      return "pending";
  }
}

function legacyStatusForLifecycle(lifecycle: VenueLifecycle): MergedVenueRecord["status"] {
  switch (lifecycle) {
    case "verified":
    case "featured":
    case "evergreen":
    case "new":
      return "active";
    case "needs_review":
      return "possibly_closed";
    case "rejected":
      return "rejected";
    case "duplicate":
      return "duplicate";
    case "closed":
      return "possibly_closed";
    default:
      return "active";
  }
}

/**
 * Merge provider observations into an existing or empty Kindred venue record.
 * Never blind-overwrites — Source Manager picks the winning value per field.
 */
export function mergeProviderImport(input: {
  place: NormalizedPlace;
  existingFieldSources?: VenueFieldSources | null;
  existingHistory?: SourceHistoryEntry[] | null;
  currentLifecycle: VenueLifecycle;
  ctx: Omit<ProviderImportContext, "currentLifecycle">;
}): MergedVenueRecord {
  const { place, ctx } = input;
  let fieldSources: VenueFieldSources = { ...(input.existingFieldSources ?? {}) };
  let sourceHistory = [...(input.existingHistory ?? [])];
  let materialChanged = false;

  const observations = observationsFromFoursquarePlace(place, ctx.observedAt);

  for (const [field, observation] of Object.entries(observations)) {
    if (!observation) continue;
    const result = mergeFieldObservation(
      field as VenueFieldName,
      fieldSources[field as VenueFieldName],
      observation
    );
    fieldSources[field as VenueFieldName] = result.provenance;
    sourceHistory = appendSourceHistory(sourceHistory, result.history);
    if (result.changed) materialChanged = true;
  }

  sourceHistory = appendSourceHistory(sourceHistory, {
    at: ctx.observedAt,
    source: ctx.source,
    field: "import",
    action: "observed",
    note: `${ctx.source} import`,
  });

  const confidenceScore = computeVenueConfidenceFromFields(fieldSources);
  const lifecycle = resolveLifecycleAfterImport({
    current: input.currentLifecycle,
    confidenceScore,
    passesVerification: ctx.passesVerification,
    isNewDiscovery: ctx.isNewDiscovery,
    missingFromFullSync: ctx.missingFromFullSync,
  });

  const name = String(resolveFieldValue(fieldSources, "name") ?? place.name.trim());
  const fingerprint = catalogContentFingerprintFromFields(fieldSources, place.category);

  return {
    name,
    normalized_name: normalizeCatalogName(name),
    address: (resolveFieldValue(fieldSources, "address") as string | null) ?? place.address,
    city: (resolveFieldValue(fieldSources, "city") as string | null) ?? place.city,
    state: (resolveFieldValue(fieldSources, "state") as string | null) ?? place.state,
    lat: (resolveFieldValue(fieldSources, "lat") as number | null) ?? place.lat,
    lon: (resolveFieldValue(fieldSources, "lon") as number | null) ?? place.lon,
    url: (resolveFieldValue(fieldSources, "website") as string | null) ?? place.url,
    phone: (resolveFieldValue(fieldSources, "phone") as string | null) ?? null,
    price_level: (resolveFieldValue(fieldSources, "price_level") as number | null) ?? null,
    cuisine: (resolveFieldValue(fieldSources, "cuisine") as string | null) ?? null,
    editorial_categories:
      (resolveFieldValue(fieldSources, "editorial_categories") as string[]) ?? [place.category],
    field_sources: fieldSources,
    source_history: sourceHistory,
    confidence_score: confidenceScore,
    lifecycle,
    verification_status: verificationStatusForLifecycle(lifecycle),
    content_fingerprint: fingerprint,
    materialChanged,
    status: legacyStatusForLifecycle(lifecycle),
  };
}
