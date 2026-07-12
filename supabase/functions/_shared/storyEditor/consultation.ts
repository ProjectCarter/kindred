/**
 * Consultation pack — Learning Engine plug-in point.
 * Today: seed principles. Later: Editorial Brain fills playbooks + reader craft.
 */

import { SEED_EDITORIAL_PRINCIPLES } from "./constitutions.ts";
import type { ConsultationPack, StorySurfaceRole } from "./types.ts";

export function buildConsultationPack(input: {
  surfaceRole: StorySurfaceRole;
  locale: string;
  /** Future: reader craft patterns, beat playbooks, avoid patterns from Learning Engine. */
  learningHints?: Partial<ConsultationPack> | null;
}): ConsultationPack {
  const learning = input.learningHints;
  return {
    principles: [
      ...SEED_EDITORIAL_PRINCIPLES.map((p) => ({
        id: p.id,
        title: p.title,
        guidance: p.guidance,
      })),
      ...(learning?.principles ?? []),
    ],
    playbookHints: [
      `Surface role: ${input.surfaceRole}`,
      `Locale: ${input.locale}`,
      "Protect the reader from boring articles without inventing facts.",
      ...(learning?.playbookHints ?? []),
    ],
    avoidPatterns: [
      "procedural openings",
      "press-release voice",
      "AI filler",
      "clickbait curiosity gaps",
      "CTA endings",
      ...(learning?.avoidPatterns ?? []),
    ],
    readerNotes: learning?.readerNotes ?? [],
    confidence: learning?.confidence ?? 0.35,
  };
}
