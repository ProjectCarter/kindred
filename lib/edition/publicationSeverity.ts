/**
 * Edition Pipeline V2 — Kindred V1 publication severity by desk.
 * Core discovery desks block publish; editorial/support desks warn or skip.
 */

import type { EditionValidationDesk } from "./editionValidationTypes.ts";

export type PublicationSeverity = "blocking" | "warning" | "non_blocking";

/** Kindred V1 — must pass or edition cannot publish. */
export const BLOCKING_PUBLICATION_DESKS: ReadonlySet<EditionValidationDesk> = new Set([
  "local_events",
  "activities",
  "food_drinks",
]);

/** Publish allowed on WARNING when fallback or partial content exists. */
export const WARNING_PUBLICATION_DESKS: ReadonlySet<EditionValidationDesk> = new Set([
  "weather",
  "story_of",
  "local_news",
  "national_news",
]);

/** Delight desks — never block an otherwise valid edition. */
export const NON_BLOCKING_PUBLICATION_DESKS: ReadonlySet<EditionValidationDesk> = new Set([
  "masterpiece",
  "today_in_history",
  "history_around_town",
  "bandits_pick",
]);

/** Edition row / status integrity — infrastructure blocking (not a reader desk). */
export const INFRASTRUCTURE_BLOCKING_DESKS: ReadonlySet<EditionValidationDesk> = new Set([
  "edition",
]);

export const PUBLICATION_SEVERITY_BY_DESK: Record<
  EditionValidationDesk,
  PublicationSeverity
> = {
  edition: "blocking",
  local_events: "blocking",
  activities: "blocking",
  food_drinks: "blocking",
  weather: "warning",
  story_of: "warning",
  local_news: "warning",
  national_news: "warning",
  masterpiece: "non_blocking",
  today_in_history: "non_blocking",
  history_around_town: "non_blocking",
  bandits_pick: "non_blocking",
};

export function publicationSeverityForDesk(
  desk: EditionValidationDesk
): PublicationSeverity {
  return PUBLICATION_SEVERITY_BY_DESK[desk];
}

export function isBlockingPublicationDesk(desk: EditionValidationDesk): boolean {
  return publicationSeverityForDesk(desk) === "blocking";
}

/** Map a desk with validation issues to its publication status (never FAIL for non-blocking). */
export function deskStatusForPublicationIssues(
  desk: EditionValidationDesk,
  hasIssues: boolean
): "PASS" | "WARNING" | "FAIL" {
  if (!hasIssues) return "PASS";
  return isBlockingPublicationDesk(desk) ? "FAIL" : "WARNING";
}

export function recordDeskPublicationOutcome(input: {
  desk: EditionValidationDesk;
  status: "PASS" | "WARNING" | "FAIL" | "SKIPPED";
  reasons: string[];
  blockingFailures: string[];
  warnings: string[];
}): "PASS" | "WARNING" | "FAIL" | "SKIPPED" {
  if (input.status === "SKIPPED") return "SKIPPED";

  let status = input.status;
  if (status === "FAIL" && !isBlockingPublicationDesk(input.desk)) {
    status = "WARNING";
  }

  if (status === "FAIL") {
    input.blockingFailures.push(...input.reasons.map((r) => `${input.desk}:${r}`));
  } else if (input.reasons.length && status === "WARNING") {
    input.warnings.push(...input.reasons.map((r) => `${input.desk}:${r}`));
  }

  return status;
}
