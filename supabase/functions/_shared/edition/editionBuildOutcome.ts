/**
 * Structured edition build outcomes — minimum operational visibility for
 * generation workers, cron recovery, and flagship QA markets.
 */

import type { DiscoveryGateReport, LocalEventsGateReport } from "./finalPublicationGate.ts";

export type EditionBuildOutcome = {
  kind: "edition_build_outcome";
  at: string;
  editionId?: string | null;
  metroKey?: string | null;
  userId?: string | null;
  jobId?: string | null;
  traceId?: string | null;
  status: "ready" | "failed" | "skipped";
  skipped?: string | null;
  durationMs?: number | null;
  error?: string | null;
  completeness?: {
    complete: boolean;
    reasons: string[];
  } | null;
  gates?: {
    localEvents?: LocalEventsGateReport | null;
    discovery?: DiscoveryGateReport | null;
  } | null;
};

export function logEditionBuildOutcome(outcome: EditionBuildOutcome): void {
  console.log(JSON.stringify(outcome));
}
