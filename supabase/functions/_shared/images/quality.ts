import type { ImageOrientation } from "./types.ts";

/**
 * Per-dimension quality signals (0–100 each). Future versions can populate
 * sharpness, composition, lighting, and editorial appeal via CV or human review.
 * Stored on every library row so editions can rank candidates over time.
 */
export type ImageQualitySignals = {
  resolution?: number;
  sharpness?: number;
  composition?: number;
  lighting?: number;
  editorialAppeal?: number;
  orientationFit?: number;
  cropSuitability?: number;
};

export type QualityInput = {
  width: number | null;
  height: number | null;
  orientation: ImageOrientation | null;
  preferredOrientation?: ImageOrientation;
  compositionTag?: string | null;
  tags?: string[];
};

const MIN_EDITORIAL_EDGE = 720;

function resolutionScore(width: number | null, height: number | null): number {
  if (!width || !height) return 35;
  const pixels = width * height;
  const minEdge = Math.min(width, height);
  if (minEdge >= 1600) return 95;
  if (minEdge >= 1200) return 85;
  if (minEdge >= MIN_EDITORIAL_EDGE) return 72;
  if (minEdge >= 540) return 55;
  return 30;
}

function orientationFitScore(
  orientation: ImageOrientation | null,
  preferred?: ImageOrientation
): number {
  if (!preferred || !orientation) return 60;
  if (orientation === preferred) return 90;
  if (orientation === "square") return 70;
  return 45;
}

function cropSuitabilityScore(
  width: number | null,
  height: number | null,
  orientation: ImageOrientation | null
): number {
  if (!width || !height) return 50;
  const ratio = width / height;
  if (orientation === "portrait" && ratio >= 0.65 && ratio <= 0.85) return 88;
  if (orientation === "landscape" && ratio >= 1.2 && ratio <= 1.8) return 88;
  if (orientation === "square" && ratio >= 0.95 && ratio <= 1.05) return 82;
  return 62;
}

/** Baseline editorial appeal from tag richness — refined later by human/CV review. */
function editorialAppealScore(tags: string[] = []): number {
  const unique = new Set(tags.map((t) => t.toLowerCase().trim()).filter(Boolean));
  if (unique.size >= 8) return 78;
  if (unique.size >= 4) return 68;
  if (unique.size >= 1) return 58;
  return 50;
}

/**
 * Computes a 1–100 quality score from signals we can measure today.
 * Future pipelines can merge CV/human scores into `quality_signals` and
 * recompute `quality_score` without changing selection callers.
 */
export function computeBaselineQualityScore(input: QualityInput): {
  score: number;
  signals: ImageQualitySignals;
} {
  const signals: ImageQualitySignals = {
    resolution: resolutionScore(input.width, input.height),
    orientationFit: orientationFitScore(input.orientation, input.preferredOrientation),
    cropSuitability: cropSuitabilityScore(
      input.width,
      input.height,
      input.orientation
    ),
    editorialAppeal: editorialAppealScore(input.tags),
    // Reserved for future CV / curator review — absent today.
    sharpness: undefined,
    composition: input.compositionTag ? 70 : undefined,
    lighting: undefined,
  };

  const weights: { key: keyof ImageQualitySignals; weight: number }[] = [
    { key: "resolution", weight: 0.3 },
    { key: "orientationFit", weight: 0.2 },
    { key: "cropSuitability", weight: 0.2 },
    { key: "editorialAppeal", weight: 0.2 },
    { key: "composition", weight: 0.1 },
  ];

  let total = 0;
  let weightSum = 0;
  for (const { key, weight } of weights) {
    const value = signals[key];
    if (value == null) continue;
    total += value * weight;
    weightSum += weight;
  }

  const score = Math.max(1, Math.min(100, Math.round(total / (weightSum || 1))));
  return { score, signals };
}

/** Effective rank for library selection — higher quality wins; heavy skips fade out. */
export function effectiveSelectionScore(
  qualityScore: number,
  skipCount: number,
  recentUseCount: number
): number {
  const skipPenalty = Math.min(40, skipCount * 3);
  const overusePenalty = Math.min(15, recentUseCount * 2);
  return qualityScore - skipPenalty - overusePenalty;
}

/** Weak images naturally stop surfacing without manual cleanup. */
export function isLibraryRowSelectable(
  qualityScore: number,
  skipCount: number
): boolean {
  if (skipCount >= 20 && qualityScore < 45) return false;
  if (skipCount >= 35) return false;
  return true;
}
