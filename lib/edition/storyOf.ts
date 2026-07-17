/**
 * The Story of [City Name] — permanent civic editorial feature (client).
 * Server mirror: supabase/functions/_shared/storyOf/sourceNote.ts
 */

import type { HistoricalImageAsset } from "./knowledgeGrounding";
import type { EditionSection } from "./types";
import { normalizeStoryOfImageUrl, storyOfImageAssetFromSourceNote } from "./storyOfImage";

export const STORY_OF_SECTION_TYPE = "story_of";

/** Legacy section_type from early Your City builds — still parsed for archives. */
export const LEGACY_YOUR_CITY_SECTION_TYPE = "your_city";

export type StoryOfSourceNote = {
  kind: "story_of";
  metroKey: string;
  subtitle: string;
  furtherReading: string[];
  cityImage: HistoricalImageAsset;
};

type RawCityImage = {
  url?: string;
  caption?: string;
  credit?: string;
  sourcePageUrl?: string;
  sourceUrl?: string;
  license?: string;
  assetKind?: HistoricalImageAsset["assetKind"];
  source?: HistoricalImageAsset["source"];
  resolvedAt?: string;
};

function normalizeCityImage(raw: RawCityImage | null | undefined): HistoricalImageAsset | null {
  const url = normalizeStoryOfImageUrl(raw?.url?.trim() ?? null);
  if (!url) return null;
  return {
    url,
    caption: raw?.caption?.trim() || "Historic photograph",
    credit: raw?.credit?.trim() || "",
    sourcePageUrl: raw?.sourcePageUrl?.trim() || raw?.sourceUrl?.trim() || url,
    assetKind: raw?.assetKind ?? "photograph",
    source: raw?.source ?? "wikimedia_commons",
    license: raw?.license?.trim() ?? null,
    resolvedAt: raw?.resolvedAt ?? new Date(0).toISOString(),
  };
}

function isStoryOfKind(kind: string | undefined): boolean {
  return kind === "story_of" || kind === "your_city";
}

/** Canonical homepage and article title. */
export function storyOfTitle(cityName: string): string {
  const name = cityName.trim();
  return name ? `The Story of ${name}` : "The Story of…";
}

function words(text: string): string[] {
  return text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
}

const INTRO_MAX_WORDS = 80;

/** First paragraph for the homepage card — one short editorial preview. */
export function storyOfCardIntro(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const firstParagraph = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .find(Boolean);

  if (firstParagraph) {
    const firstWords = words(firstParagraph);
    if (firstWords.length <= INTRO_MAX_WORDS) return firstParagraph;
    const slice = firstWords.slice(0, INTRO_MAX_WORDS).join(" ");
    const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "));
    if (lastStop > 40) return slice.slice(0, lastStop + 1).trim();
    return `${slice}…`;
  }

  const allWords = words(cleaned);
  if (allWords.length <= INTRO_MAX_WORDS) return cleaned;
  return `${allWords.slice(0, INTRO_MAX_WORDS).join(" ")}…`;
}

export function parseStoryOfSourceNote(
  sourceNote: string | null | undefined
): StoryOfSourceNote | null {
  const raw = sourceNote?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      kind?: string;
      metroKey?: string;
      subtitle?: string;
      furtherReading?: string[];
      cityImage?: RawCityImage;
    };
    if (!isStoryOfKind(parsed?.kind)) return null;
    const cityImage = normalizeCityImage(parsed.cityImage);
    if (!cityImage) return null;
    return {
      kind: "story_of",
      metroKey: parsed.metroKey ?? "",
      subtitle: parsed.subtitle?.trim() ?? "",
      furtherReading: Array.isArray(parsed.furtherReading)
        ? parsed.furtherReading.filter((u) => typeof u === "string" && u.trim())
        : [],
      cityImage,
    };
  } catch {
    return null;
  }
}

export function storyOfImageFromSourceNote(
  sourceNote: string | null | undefined,
  metroKey?: string | null
): HistoricalImageAsset | null {
  return storyOfImageAssetFromSourceNote(sourceNote, metroKey);
}

export function isStoryOfSection(sectionType: string): boolean {
  return (
    sectionType === STORY_OF_SECTION_TYPE ||
    sectionType === LEGACY_YOUR_CITY_SECTION_TYPE
  );
}

export type CityArticleLibraryRow = {
  metro_key: string;
  city_name: string;
  headline: string;
  subtitle: string | null;
  body: string;
  image_url: string;
  image_caption: string;
  image_credit: string;
  image_source_url: string;
  image_license: string;
  sources: string[] | null;
};

/** Build source_note JSON — mirrors supabase/functions/_shared/storyOf/sourceNote.ts */
export function buildStoryOfSourceNote(input: {
  metroKey: string;
  subtitle: string;
  furtherReading: string[];
  image: {
    url: string;
    caption: string;
    credit: string;
    sourceUrl: string;
    license: string;
  };
}): string {
  const payload: StoryOfSourceNote = {
    kind: "story_of",
    metroKey: input.metroKey,
    subtitle: input.subtitle.trim(),
    furtherReading: input.furtherReading,
    cityImage: {
      url: input.image.url,
      caption: input.image.caption,
      credit: input.image.credit,
      sourcePageUrl: input.image.sourceUrl,
      assetKind: "photograph",
      source: "wikimedia_commons",
      license: input.image.license,
      resolvedAt: new Date().toISOString(),
    },
  };
  return JSON.stringify(payload);
}

export function editionSectionFromCityArticle(
  row: CityArticleLibraryRow,
  metroKey: string
): EditionSection | null {
  const headline = row.headline?.trim();
  const body = row.body?.trim();
  const subtitle = row.subtitle?.trim();
  const expectedHeadline = storyOfTitle(row.city_name);
  if (!headline || !body || !subtitle) return null;
  if (headline !== expectedHeadline) return null;

  const imageUrl = normalizeStoryOfImageUrl(row.image_url?.trim() ?? null);
  if (!imageUrl) return null;

  return {
    id: syntheticStoryOfSectionId(metroKey),
    section_type: STORY_OF_SECTION_TYPE,
    position: 5,
    headline,
    body,
    source_note: buildStoryOfSourceNote({
      metroKey,
      subtitle,
      furtherReading: Array.isArray(row.sources)
        ? row.sources.filter((u) => typeof u === "string" && u.trim())
        : [],
      image: {
        url: imageUrl,
        caption: row.image_caption?.trim() || "Historic photograph",
        credit: row.image_credit?.trim() || "",
        sourceUrl: row.image_source_url?.trim() || imageUrl,
        license: row.image_license?.trim() || "public_domain",
      },
    }),
  };
}

/** Stable synthetic id for client-recovered sections (not clippable until persisted). */
export function syntheticStoryOfSectionId(metroKey: string): string {
  let hash = 2166136261;
  for (let i = 0; i < metroKey.length; i++) {
    hash ^= metroKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
}
