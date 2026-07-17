/**
 * Kindred Source Manager — provenance-aware field merging.
 *
 * Provider APIs are discovery tools. Once imported, each field on a Kindred
 * venue record tracks where it came from and how confident we are in it.
 * Higher-trust sources win; we never blind-overwrite editorial data.
 *
 * Keep in sync with supabase/functions/_shared/editorial/sourceManager.ts
 */

/** Every importer Kindred may wire in over time. */
export type KindredSource =
  | "kindred"
  | "official_website"
  | "google_places"
  | "foursquare"
  | "yelp"
  | "opentable"
  | "resy"
  | "michelin"
  | "james_beard"
  | "licensed_photo"
  | "community";

/** Fields tracked on a Kindred venue editorial record. */
export type VenueFieldName =
  | "name"
  | "address"
  | "city"
  | "state"
  | "lat"
  | "lon"
  | "website"
  | "phone"
  | "hours"
  | "price_level"
  | "cuisine"
  | "editorial_categories"
  | "editorial_tags"
  | "editorial_teaser"
  | "editorial_article"
  | "photos"
  | "coordinates";

export type FieldObservation = {
  value: unknown;
  source: KindredSource;
  /** 0–100 trust for this observation. */
  confidence: number;
  observedAt: string;
};

/** Resolved value + winning source stored on the venue record. */
export type FieldProvenance = {
  value: unknown;
  source: KindredSource;
  confidence: number;
  verifiedAt: string;
  /** Lower-trust observations kept for audit and future re-merge. */
  alternatives: FieldObservation[];
};

export type VenueFieldSources = Partial<Record<VenueFieldName, FieldProvenance>>;

export type SourceHistoryEntry = {
  at: string;
  source: KindredSource;
  field: VenueFieldName | "import";
  action: "observed" | "merged" | "kept" | "editorial";
  previousSource?: KindredSource;
  previousConfidence?: number;
  note?: string;
};

/** Default trust tier per source — editorial and official win. */
export const SOURCE_TRUST: Record<KindredSource, number> = {
  official_website: 99,
  kindred: 98,
  michelin: 95,
  james_beard: 95,
  google_places: 85,
  opentable: 82,
  resy: 82,
  foursquare: 75,
  yelp: 70,
  licensed_photo: 90,
  community: 60,
};

export const SOURCE_LABELS: Record<KindredSource, string> = {
  kindred: "Kindred",
  official_website: "Official Website",
  google_places: "Google",
  foursquare: "Foursquare",
  yelp: "Yelp",
  opentable: "OpenTable",
  resy: "Resy",
  michelin: "Michelin Guide",
  james_beard: "James Beard",
  licensed_photo: "Licensed source",
  community: "Community correction",
};

export function defaultSourceConfidence(source: KindredSource): number {
  return SOURCE_TRUST[source] ?? 60;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 0.000_001;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export type MergeFieldResult = {
  provenance: FieldProvenance;
  changed: boolean;
  history?: SourceHistoryEntry;
};

/**
 * Merge one incoming observation into the stored field provenance.
 * Keeps the higher-confidence value; archives the loser in alternatives.
 */
export function mergeFieldObservation(
  field: VenueFieldName,
  current: FieldProvenance | null | undefined,
  incoming: FieldObservation
): MergeFieldResult {
  const observedAt = incoming.observedAt;
  const incomingConfidence = Math.max(
    0,
    Math.min(100, incoming.confidence || defaultSourceConfidence(incoming.source))
  );

  if (incoming.value == null || incoming.value === "") {
    return {
      provenance: current ?? {
        value: null,
        source: incoming.source,
        confidence: 0,
        verifiedAt: observedAt,
        alternatives: [],
      },
      changed: false,
    };
  }

  if (!current) {
    return {
      provenance: {
        value: incoming.value,
        source: incoming.source,
        confidence: incomingConfidence,
        verifiedAt: observedAt,
        alternatives: [],
      },
      changed: true,
      history: {
        at: observedAt,
        source: incoming.source,
        field,
        action: "merged",
        note: "Initial field value",
      },
    };
  }

  if (valuesEqual(current.value, incoming.value)) {
    const altExists = current.alternatives.some(
      (alt) =>
        alt.source === incoming.source && valuesEqual(alt.value, incoming.value)
    );
    const alternatives = altExists
      ? current.alternatives
      : [
          ...current.alternatives,
          {
            value: incoming.value,
            source: incoming.source,
            confidence: incomingConfidence,
            observedAt,
          },
        ];
    return {
      provenance: {
        ...current,
        verifiedAt: observedAt,
        alternatives,
      },
      changed: false,
      history: {
        at: observedAt,
        source: incoming.source,
        field,
        action: "observed",
      },
    };
  }

  if (incomingConfidence > current.confidence) {
    return {
      provenance: {
        value: incoming.value,
        source: incoming.source,
        confidence: incomingConfidence,
        verifiedAt: observedAt,
        alternatives: [
          {
            value: current.value,
            source: current.source,
            confidence: current.confidence,
            observedAt: current.verifiedAt,
          },
          ...current.alternatives.filter(
            (alt) => !valuesEqual(alt.value, incoming.value)
          ),
        ],
      },
      changed: true,
      history: {
        at: observedAt,
        source: incoming.source,
        field,
        action: "merged",
        previousSource: current.source,
        previousConfidence: current.confidence,
      },
    };
  }

  const alternatives = [
    ...current.alternatives.filter(
      (alt) => !valuesEqual(alt.value, incoming.value)
    ),
    {
      value: incoming.value,
      source: incoming.source,
      confidence: incomingConfidence,
      observedAt,
    },
  ];

  return {
    provenance: { ...current, alternatives },
    changed: false,
    history: {
      at: observedAt,
      source: incoming.source,
      field,
      action: "kept",
      previousSource: current.source,
      previousConfidence: current.confidence,
    },
  };
}

const FIELD_CONFIDENCE_WEIGHTS: Partial<Record<VenueFieldName, number>> = {
  name: 15,
  address: 12,
  lat: 10,
  lon: 10,
  website: 10,
  phone: 8,
  hours: 10,
  price_level: 5,
  cuisine: 10,
  coordinates: 10,
};

/** Aggregate venue confidence from resolved field provenance (0–100). */
export function computeVenueConfidenceFromFields(
  fieldSources: VenueFieldSources
): number {
  let weighted = 0;
  let totalWeight = 0;

  for (const [field, weight] of Object.entries(FIELD_CONFIDENCE_WEIGHTS)) {
    const provenance = fieldSources[field as VenueFieldName];
    if (!provenance || provenance.value == null || provenance.value === "") continue;
    weighted += provenance.confidence * (weight ?? 5);
    totalWeight += weight ?? 5;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weighted / totalWeight);
}

export function resolveFieldValue<T>(
  fieldSources: VenueFieldSources,
  field: VenueFieldName,
  fallback?: T
): T | undefined {
  const provenance = fieldSources[field];
  if (!provenance || provenance.value == null) return fallback;
  return provenance.value as T;
}

export function appendSourceHistory(
  history: SourceHistoryEntry[],
  entry: SourceHistoryEntry | undefined,
  maxEntries = 100
): SourceHistoryEntry[] {
  if (!entry) return history;
  return [...history, entry].slice(-maxEntries);
}

/** Human-readable attribution for a field (e.g. "Hours: Google"). */
export function fieldSourceLabel(
  fieldSources: VenueFieldSources,
  field: VenueFieldName
): string | null {
  const provenance = fieldSources[field];
  if (!provenance) return null;
  return SOURCE_LABELS[provenance.source] ?? provenance.source;
}
