/**
 * Venue classification from structured metadata — Foursquare categories,
 * provider labels, and tags take priority over title keyword guessing.
 *
 * Delegates to editorialCategory.ts for verified multi-signal resolution.
 * Server mirror: supabase/functions/_shared/venueClassification.ts
 */

import type { ImageCategoryTag } from "./imageTaxonomy";
import type { EditorialCategoryId } from "./editorialCategory";
import {
  buildCategoryImageSearchQueries,
  resolveVerifiedEditorialCategory,
  type EditorialCategoryInput,
} from "./editorialCategory";

export type VenueClassificationInput = EditorialCategoryInput & {
  tags?: string[] | null;
};

export type VenueClassification = {
  /** Verified Kindred editorial category id. */
  categoryId: EditorialCategoryId;
  /** Image taxonomy tag — drives search + library lookup. */
  editorialType: ImageCategoryTag;
  /** Human label for articles and cards — e.g. "dog park", "escape room". */
  displayLabel: string;
  confidence: "high" | "medium" | "low";
  /** Where the classification came from. */
  source: "foursquare" | "metadata" | "title" | "discovery_category";
};

const CONFIDENCE_MAP = {
  verified: "high",
  likely: "medium",
  tentative: "low",
} as const satisfies Record<
  ReturnType<typeof resolveVerifiedEditorialCategory>["confidence"],
  VenueClassification["confidence"]
>;

function resolveSource(
  verified: ReturnType<typeof resolveVerifiedEditorialCategory>
): VenueClassification["source"] {
  if (verified.sources.includes("foursquare")) return "foursquare";
  if (verified.sources.includes("name")) return "title";
  if (verified.sources.length > 0) return "metadata";
  return "discovery_category";
}

export function resolveVenueClassification(
  input: VenueClassificationInput
): VenueClassification {
  const verified = resolveVerifiedEditorialCategory(input);
  return {
    categoryId: verified.categoryId,
    editorialType: verified.imageTag,
    displayLabel: verified.displayLabel,
    confidence: CONFIDENCE_MAP[verified.confidence],
    source: resolveSource(verified),
  };
}

/** Normalized key for library venue reuse. */
export function venueLibraryTag(
  title: string,
  city?: string | null
): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, "-");
  const t = normalize(title);
  const c = city ? normalize(city) : "";
  return c ? `venue:${t}:${c}` : `venue:${t}`;
}

export function extractCityState(address?: string | null): {
  city: string | null;
  state: string | null;
} {
  if (!address?.trim()) return { city: null, state: null };
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const statePart = parts[parts.length - 1];
    const cityPart = parts[parts.length - 2];
    const stateMatch = statePart.match(/\b(AZ|Arizona|CA|California|TX|Texas|UT|Utah|CO|Colorado|NM|New Mexico)\b/i);
    return {
      city: cityPart || null,
      state: stateMatch ? stateMatch[0] : statePart || null,
    };
  }
  return { city: null, state: null };
}

/**
 * Image search priority:
 * 1. Exact venue + place
 * 2. Venue name + verified category
 * 3. Category-specific editorial phrases (never generic substitutes)
 */
export function buildEditorialImageSearchQueries(input: {
  title: string;
  city?: string | null;
  state?: string | null;
  classification: VenueClassification;
}): string[] {
  return buildCategoryImageSearchQueries({
    title: input.title,
    city: input.city,
    state: input.state,
    category: {
      categoryId: input.classification.categoryId,
      displayLabel: input.classification.displayLabel,
      imageTag: input.classification.editorialType,
      confidence:
        input.classification.confidence === "high"
          ? "verified"
          : input.classification.confidence === "medium"
            ? "likely"
            : "tentative",
      sources: [],
    },
  });
}

/** Editorial display label for articles — prefers Foursquare over bucket. */
export function venueDisplayLabel(input: VenueClassificationInput): string {
  return resolveVenueClassification(input).displayLabel;
}
