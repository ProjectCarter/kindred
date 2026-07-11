import { buildEditorialCalendar } from "./calendar.ts";
import type { EditorialCalendar, EditorialPolicy } from "./types.ts";

/**
 * Desk policy for assembling today’s paper.
 * Weekday: fresh wire, clear desks, emotional balance.
 * Weekend: more leisure / feature, slightly softer freshness.
 */
export function buildEditorialPolicy(
  calendar: EditorialCalendar,
  maxStories = 4
): EditorialPolicy {
  if (calendar.mode === "sunday_weekend") {
    return {
      mode: calendar.mode,
      maxStories,
      roleOrder: ["feature", "national", "interest", "local", "world", "breaking"],
      similarityLimit: 0.36,
      freshnessSoftHours: 48,
      freshnessHardHours: 96,
      breakingMinScore: 34,
      requireEmotionalBalance: true,
      maxHeavyStories: 1,
      preferWorldBalance: true,
      preferLeisureTone: true,
      morningFreshHours: 12,
      personalizationIntegrityCap: 16,
      leadDistinctFromSlate: true,
    };
  }

  if (calendar.mode === "saturday_weekend") {
    return {
      mode: calendar.mode,
      maxStories,
      roleOrder: ["national", "feature", "interest", "local", "world", "breaking"],
      similarityLimit: 0.37,
      freshnessSoftHours: 42,
      freshnessHardHours: 90,
      breakingMinScore: 33,
      requireEmotionalBalance: true,
      maxHeavyStories: 1,
      preferWorldBalance: true,
      preferLeisureTone: true,
      morningFreshHours: 10,
      personalizationIntegrityCap: 18,
      leadDistinctFromSlate: true,
    };
  }

  // Weekday morning — purposeful, fresh, balanced desks.
  return {
    mode: "weekday_morning",
    maxStories,
    roleOrder: ["national", "interest", "local", "feature", "world", "breaking"],
    similarityLimit: 0.38,
    freshnessSoftHours: 36,
    freshnessHardHours: 84,
    breakingMinScore: 32,
    requireEmotionalBalance: true,
    maxHeavyStories: 2,
    preferWorldBalance: true,
    preferLeisureTone: false,
    morningFreshHours: 6,
    personalizationIntegrityCap: 18,
    leadDistinctFromSlate: true,
  };
}

export function policyForEditionDate(
  editionDate: string,
  now: Date = new Date(),
  maxStories = 4
): { calendar: EditorialCalendar; policy: EditorialPolicy } {
  const calendar = buildEditorialCalendar(editionDate, now);
  return { calendar, policy: buildEditorialPolicy(calendar, maxStories) };
}
