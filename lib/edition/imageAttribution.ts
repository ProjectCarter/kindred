/**
 * Image attribution records — stored on each editorialImage, surfaced in
 * detail views and app credits rather than on every newspaper card.
 */

export type ImageAttribution = {
  photographerName?: string | null;
  sourcePageUrl?: string | null;
  attributionText?: string | null;
  source: "pexels" | "pixabay" | "unsplash" | "provider" | "kindred";
};

export function attributionFromEditorialImage(
  image:
    | {
        source: ImageAttribution["source"];
        photographerName?: string | null;
        sourcePageUrl?: string | null;
        attributionText?: string | null;
      }
    | null
    | undefined
): ImageAttribution | null {
  if (!image) return null;
  return {
    photographerName: image.photographerName ?? null,
    sourcePageUrl: image.sourcePageUrl ?? null,
    attributionText: image.attributionText ?? null,
    source: image.source,
  };
}

/** General credit line for settings / about screen. */
export const STOCK_PHOTO_CREDITS = [
  { label: "Photos provided by Unsplash", url: "https://unsplash.com" },
  { label: "Photos provided by Pexels", url: "https://www.pexels.com" },
  { label: "Photos provided by Pixabay", url: "https://pixabay.com" },
] as const;
