/**
 * History of Your City — verified city image resolution and fallbacks.
 * Primary → metro alternate → compact placeholder (never generic editorial stock).
 */

import type { HistoricalImageAsset } from "./knowledgeGrounding";
import { parseStoryOfSourceNote } from "./storyOf";

export type StoryOfImageFallbackLevel = "primary" | "alternate" | "placeholder";

export type ResolvedStoryOfImage = HistoricalImageAsset & {
  fallbackLevel: StoryOfImageFallbackLevel;
  originalUrl: string | null;
  resolvedUrl: string;
};

/** Editorial card ratio — wider than portrait, matches Today in History desks. */
export const STORY_OF_CARD_ASPECT_RATIO = 3 / 2;

const GILBERT_PRIMARY_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Gilbert-Gilbert_Water_Tower-1925.jpg/960px-Gilbert-Gilbert_Water_Tower-1925.jpg";

/** Correct known bad URLs persisted before the Gilbert image fix. */
const KNOWN_IMAGE_URL_CORRECTIONS: Record<string, string> = {
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Gilbert_Water_Tower%2C_Gilbert%2C_Arizona.jpg/960px-Gilbert_Water_Tower%2C_Gilbert%2C_Arizona.jpg":
    GILBERT_PRIMARY_URL,
  "https://upload.wikimedia.org/wikipedia/commons/5/5e/Gilbert_Water_Tower%2C_Gilbert%2C_Arizona.jpg":
    GILBERT_PRIMARY_URL,
};

type CityImageCandidate = {
  url: string;
  caption: string;
  credit: string;
  sourcePageUrl: string;
  license: string | null;
  level: StoryOfImageFallbackLevel;
};

/** Approved alternates per metro — direct upload.wikimedia.org URLs only. */
const METRO_IMAGE_ALTERNATES: Record<string, CityImageCandidate[]> = {
  "gilbert-az": [
    {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Gilbert_Watertower_-_North_-_2009-09-14.jpg/960px-Gilbert_Watertower_-_North_-_2009-09-14.jpg",
      caption:
        "The Gilbert water tower and Water Tower Plaza in the Heritage District.",
      credit: "Photo: Cygnusloop99 / Wikimedia Commons (CC BY-SA 3.0)",
      sourcePageUrl:
        "https://commons.wikimedia.org/wiki/File:Gilbert_Watertower_-_North_-_2009-09-14.jpg",
      license: "CC BY-SA 3.0",
      level: "alternate",
    },
  ],
};

export function isDirectLoadableImageUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return false;
  if (/commons\.wikimedia\.org\/wiki/i.test(trimmed)) return false;
  if (/wikipedia\.org\/wiki\//i.test(trimmed)) return false;
  return (
    /^https:\/\/upload\.wikimedia\.org\//i.test(trimmed) ||
    /^https:\/\/[^/]+\/.+\.(jpg|jpeg|png|webp)(\?|$)/i.test(trimmed)
  );
}

export function normalizeStoryOfImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return KNOWN_IMAGE_URL_CORRECTIONS[trimmed] ?? trimmed;
}

function candidateFromHistorical(
  image: HistoricalImageAsset,
  level: StoryOfImageFallbackLevel
): CityImageCandidate {
  return {
    url: image.url,
    caption: image.caption,
    credit: image.credit,
    sourcePageUrl: image.sourcePageUrl,
    license: image.license ?? null,
    level,
  };
}

function buildCandidateChain(input: {
  sourceNote?: string | null;
  metroKey?: string | null;
}): CityImageCandidate[] {
  const note = parseStoryOfSourceNote(input.sourceNote ?? null);
  const metroKey = input.metroKey?.trim() || note?.metroKey?.trim() || "";
  const chain: CityImageCandidate[] = [];

  if (note?.cityImage?.url) {
    const corrected = normalizeStoryOfImageUrl(note.cityImage.url);
    if (corrected && isDirectLoadableImageUrl(corrected)) {
      chain.push(
        candidateFromHistorical(
          { ...note.cityImage, url: corrected },
          "primary"
        )
      );
    }
  }

  for (const alt of METRO_IMAGE_ALTERNATES[metroKey] ?? []) {
    if (!chain.some((c) => c.url === alt.url)) {
      chain.push(alt);
    }
  }

  return chain;
}

export function resolveStoryOfCityImage(input: {
  sourceNote?: string | null;
  metroKey?: string | null;
  skipUrls?: string[];
}): ResolvedStoryOfImage | null {
  const skip = new Set((input.skipUrls ?? []).map((u) => u.trim()).filter(Boolean));
  const chain = buildCandidateChain(input);
  const originalUrl = chain[0]?.url ?? null;

  for (const candidate of chain) {
    if (skip.has(candidate.url)) continue;
    const resolved = resolveStoryOfCityImageFromCandidate(candidate, originalUrl);
    logStoryOfImageEvent("resolve", {
      sectionType: "story_of",
      originalUrl,
      resolvedUrl: resolved.resolvedUrl,
      fallbackLevel: resolved.fallbackLevel,
      metroKey: input.metroKey ?? parseStoryOfSourceNote(input.sourceNote ?? null)?.metroKey ?? null,
    });
    return resolved;
  }

  logStoryOfImageEvent("resolve", {
    sectionType: "story_of",
    originalUrl,
    resolvedUrl: null,
    fallbackLevel: "placeholder",
    metroKey: input.metroKey ?? null,
  });
  return null;
}

function resolveStoryOfCityImageFromCandidate(
  candidate: CityImageCandidate,
  originalUrl: string | null
): ResolvedStoryOfImage {
  return {
    url: candidate.url,
    resolvedUrl: candidate.url,
    originalUrl,
    fallbackLevel: candidate.level,
    caption: candidate.caption,
    credit: candidate.credit,
    sourcePageUrl: candidate.sourcePageUrl,
    assetKind: "photograph",
    source: "wikimedia_commons",
    license: candidate.license,
    resolvedAt: new Date().toISOString(),
  };
}

export function nextStoryOfImageFallback(input: {
  sourceNote?: string | null;
  metroKey?: string | null;
  failedUrl: string;
}): ResolvedStoryOfImage | null {
  return resolveStoryOfCityImage({
    sourceNote: input.sourceNote,
    metroKey: input.metroKey,
    skipUrls: [input.failedUrl],
  });
}

export function logStoryOfImageEvent(
  event: "resolve" | "load_success" | "load_error",
  detail: Record<string, unknown>
): void {
  if (event === "load_error") {
    console.warn(`[storyOf:image] ${event}`, detail);
    return;
  }
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log(`[storyOf:image] ${event}`, detail);
  }
}

/** Re-export for callers that only need the asset without fallback metadata. */
export function storyOfImageAssetFromSourceNote(
  sourceNote: string | null | undefined,
  metroKey?: string | null
): HistoricalImageAsset | null {
  const resolved = resolveStoryOfCityImage({ sourceNote, metroKey });
  if (!resolved) return null;
  const { fallbackLevel: _level, originalUrl: _orig, resolvedUrl: _resolved, ...asset } =
    resolved;
  return asset;
}
