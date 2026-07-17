import type { DevEditionHistoryEntry } from "./editionOverrideTypes";
import { buildEditionHealthReport, type EditionHealthReport } from "./editionHealthReport";

/** Resolve health for a history entry — rebuilds legacy snapshots on the fly. */
export function resolveEditionHealth(entry: DevEditionHistoryEntry): EditionHealthReport {
  if (entry.health) return entry.health;
  return buildEditionHealthReport({
    bundle: entry.bundle,
    diagnostics: entry.diagnostics,
    place: entry.place,
  });
}
