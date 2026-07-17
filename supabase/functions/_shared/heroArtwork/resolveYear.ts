/** Resolve artwork year from stored field or verified metadata text. */
import {
  containsWikidataSyntax,
  stripWikidataMarkup,
} from "./sanitizeMetadata.ts";

export function resolveArtworkYear(input: {
  year?: string | null;
  artworkTitle?: string | null;
  sourceUrl?: string | null;
  tags?: string[] | null;
  aboutArtworkBody?: string | null;
}): string | null {
  const stored = input.year?.trim();
  if (stored) {
    const propSources = [
      input.artworkTitle,
      input.aboutArtworkBody,
      ...(input.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ");
    const prop = propSources.match(/QS:P(\d+)/i);
    if (prop && prop[1] === stored) {
      // Wikidata property id mistaken for year — fall through to text parsing.
    } else if (!containsWikidataSyntax(stored)) {
      return stored;
    }
  }

  const haystack = stripWikidataMarkup(
    [
      input.sourceUrl,
      input.artworkTitle,
      ...(input.tags ?? []),
      input.aboutArtworkBody,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (!haystack.trim()) return null;

  const range = haystack.match(
    /(?:^|[^\d])(1[0-9]{3}|20[0-1][0-9])\s*[–-]\s*(1[0-9]{3}|20[0-1][0-9])(?:[^\d]|$)/
  );
  if (range) return `${range[1]}–${range[2]}`;

  const commaYear = haystack.match(/,\s*(1[0-9]{3}|20[0-1][0-9])\s*,/);
  if (commaYear) return commaYear[1];

  const circa = haystack.match(/(?:^|[^\d])c\.?\s*(1[0-9]{3}|20[0-1][0-9])(?:[^\d]|$)/i);
  if (circa) return circa[1];

  const paren = haystack.match(
    /\(\s*((?:1[0-9]{3}|20[0-1][0-9])(?:\s*[–-]\s*(?:1[0-9]{3}|20[0-1][0-9]))?)\s*\)/
  );
  if (paren) return paren[1].replace(/\s*[–-]\s*/g, "–");

  const single = haystack.match(/(?:^|[^\d])(1[0-9]{3}|20[0-1][0-9])(?:[^\d]|$)/);
  return single?.[1] ?? null;
}
