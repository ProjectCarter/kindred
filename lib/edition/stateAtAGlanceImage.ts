/**
 * State symbol image URLs — direct upload.wikimedia.org only.
 * Thumb widths must match sizes Wikimedia actually generates (500px for these assets).
 *
 * Capitol Photo Standard: official state capitol building photographs only —
 * never skylines, downtown views, or generic city images.
 */

/** Normalize protocol-relative Wikipedia media URLs. */
export function normalizeStateSymbolImageUrl(
  url: string | null | undefined
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return trimmed;
}

function isDirectLoadableImageUrl(url: string): boolean {
  if (/commons\.wikimedia\.org\/wiki/i.test(url)) return false;
  if (/wikipedia\.org\/wiki\//i.test(url)) return false;
  return (
    /^https:\/\/upload\.wikimedia\.org\//i.test(url) ||
    /^https:\/\/[^/]+\/.+\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)
  );
}

export function isVerifiedStateSymbolImageUrl(
  url: string | null | undefined
): boolean {
  const normalized = normalizeStateSymbolImageUrl(url);
  return normalized != null && isDirectLoadableImageUrl(normalized);
}
