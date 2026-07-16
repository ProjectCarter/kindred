/** Mobile hero target — optimized at ingest, never fetched at full museum resolution. */
export const HERO_TARGET_WIDTH_MIN = 1200;
export const HERO_TARGET_WIDTH_MAX = 1600;
export const HERO_TARGET_WIDTH_DEFAULT = 1400;

export type HeroDisplayDimensions = {
  imageWidth: number;
  imageHeight: number;
  aspectRatio: number;
};

export function computeHeroDisplayDimensions(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth = HERO_TARGET_WIDTH_DEFAULT
): HeroDisplayDimensions | null {
  if (sourceWidth < 640 || sourceHeight < 400) return null;

  const clampedTarget = Math.min(
    HERO_TARGET_WIDTH_MAX,
    Math.max(HERO_TARGET_WIDTH_MIN, Math.min(targetWidth, sourceWidth))
  );
  const aspectRatio = sourceWidth / sourceHeight;
  const imageWidth = clampedTarget;
  const imageHeight = Math.max(1, Math.round(clampedTarget / aspectRatio));

  return {
    imageWidth,
    imageHeight,
    aspectRatio: Number(aspectRatio.toFixed(6)),
  };
}
