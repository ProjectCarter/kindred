import type { CachedEditionBundle } from "../edition/editionCache";
import type { KindredPlace } from "../location/types";
import { formatPlaceLabel } from "../location/cities";
import { buildEditionDiagnostics } from "./editionDiagnostics";
import {
  appendDevEditionHistory,
  touchDevRecentPlace,
} from "./editionOverrideStore";
import type { DevEditionHistoryEntry } from "./editionOverrideTypes";
import { buildEditionHealthReport } from "./editionHealthReport";

export function devEditionHistoryId(
  place: KindredPlace,
  editionDate: string,
  editionId: string
): string {
  return `${place.city}-${editionDate}-${editionId}`.toLowerCase().replace(/\s+/g, "-");
}

export async function recordDevEditionSnapshot(input: {
  place: KindredPlace;
  editionDate: string;
  bundle: CachedEditionBundle;
  generationTimeMs?: number | null;
  apiErrors?: string[];
  cacheStatus?: "memory" | "disk" | "network";
  discovery?: unknown;
}): Promise<DevEditionHistoryEntry> {
  const generatedAt = new Date().toISOString();
  const diagnostics = buildEditionDiagnostics({
    place: input.place,
    editionDate: input.editionDate,
    sections: input.bundle.sections,
    discovery: input.discovery,
    generatedAt,
    generationTimeMs: input.generationTimeMs ?? null,
    cacheStatus: input.cacheStatus ?? "network",
    apiErrors: input.apiErrors,
  });

  const health = buildEditionHealthReport({
    bundle: input.bundle,
    diagnostics,
    place: input.place,
  });

  const entry: DevEditionHistoryEntry = {
    id: devEditionHistoryId(input.place, input.editionDate, input.bundle.editionId),
    label: `${formatPlaceLabel(input.place)} · ${input.editionDate}`,
    place: input.place,
    editionDate: input.editionDate,
    editionId: input.bundle.editionId,
    generatedAt,
    generationTimeMs: input.generationTimeMs ?? null,
    diagnostics,
    health,
    bundle: input.bundle,
  };

  await touchDevRecentPlace(input.place);
  await appendDevEditionHistory(entry);
  return entry;
}
