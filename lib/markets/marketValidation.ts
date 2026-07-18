/**
 * U.S. Market validation specification — shared between client and server.
 * Every section must pass before a market is considered Complete.
 */

import type { MarketCompletenessReport, MarketCompletenessSection } from "./types.ts";

/** Canonical validation desk IDs — stable across tooling and logs. */
export const MARKET_VALIDATION_SECTIONS = [
  { id: "local_events", label: "Local Events", required: true },
  { id: "activities", label: "Activities", required: true },
  { id: "food_drinks", label: "Food & Drinks", required: true },
  { id: "story_of", label: "Story of Your City", required: true },
  { id: "bandits_pick", label: "Bandit's Pick candidates", required: true },
  { id: "today_in_history", label: "Today in History", required: true },
  { id: "artwork", label: "Morning artwork pool", required: true },
  { id: "maps", label: "Verified map coordinates", required: true },
  { id: "coordinates", label: "Market anchor coordinates", required: true },
  { id: "editorial_quality", label: "Editorial quality gates", required: true },
  { id: "family_safe", label: "Family-safe filtering", required: true },
] as const;

export type MarketValidationSectionId =
  (typeof MARKET_VALIDATION_SECTIONS)[number]["id"];

export function marketValidationSectionIds(): MarketValidationSectionId[] {
  return MARKET_VALIDATION_SECTIONS.map((s) => s.id);
}

export function summarizeMarketValidation(
  report: MarketCompletenessReport | null | undefined
): {
  complete: boolean;
  ready: boolean;
  passed: number;
  required: number;
  missing: string[];
} {
  if (!report) {
    return {
      complete: false,
      ready: false,
      passed: 0,
      required: MARKET_VALIDATION_SECTIONS.length,
      missing: MARKET_VALIDATION_SECTIONS.map((s) => s.label),
    };
  }

  const requiredSections = report.sections.filter((s) => s.required);
  const passed = requiredSections.filter((s) => s.complete).length;
  const missing = requiredSections
    .filter((s) => !s.complete)
    .map((s) => s.label);

  return {
    complete: report.complete,
    ready: report.foundationComplete,
    passed,
    required: requiredSections.length,
    missing,
  };
}

export function formatValidationSections(
  sections: MarketCompletenessSection[]
): string {
  return sections
    .map((s) => `${s.complete ? "✓" : "✗"} ${s.label}${s.detail ? ` — ${s.detail}` : ""}`)
    .join("\n");
}
