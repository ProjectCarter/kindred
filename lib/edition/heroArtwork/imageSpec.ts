/** Client mirror — keep in sync with supabase/functions/_shared/heroArtwork/imageSpec.ts */

export const HERO_TARGET_WIDTH_MIN = 1200;
export const HERO_TARGET_WIDTH_MAX = 1600;
export const HERO_TARGET_WIDTH_DEFAULT = 1400;

export function heroFrameHeight(
  containerWidth: number,
  imageWidth?: number | null,
  imageHeight?: number | null,
  aspectRatio?: number | null,
  maxHeight = 420
): number {
  if (imageWidth && imageHeight && imageWidth > 0) {
    return Math.min(maxHeight, Math.round(containerWidth * (imageHeight / imageWidth)));
  }
  if (aspectRatio && aspectRatio > 0) {
    return Math.min(maxHeight, Math.round(containerWidth / aspectRatio));
  }
  return Math.round(Math.min(containerWidth * 0.92, maxHeight));
}
