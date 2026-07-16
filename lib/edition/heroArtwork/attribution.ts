/**
 * Client mirror — supabase/functions/_shared/heroArtwork/attribution.ts
 * Credit lines are built at ingest only; the app renders stored creditLine.
 */

export type { MasterpieceCreditInput, MediumLabel } from "./attributionTypes";

/** Render-only helper — returns pre-stored credit, never composes at runtime. */
export function renderMasterpieceCreditLine(
  morningHero: { creditLine?: string | null; attributionText?: string | null }
): string | null {
  const line = morningHero.creditLine?.trim() || morningHero.attributionText?.trim();
  return line || null;
}
