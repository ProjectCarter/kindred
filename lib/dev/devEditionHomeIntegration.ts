import { isDeveloperMode } from "./developerMode";
import type { CachedEditionBundle } from "../edition/editionCache";
import { calendarEditionDate, isPastEditionDate } from "../edition/editionDateGuard";
import {
  getDevActivePreviewEntry,
  isDevEditionOverrideActive,
} from "../edition/resolveEditionContext";
import { hydrateDevEditionOverrideState } from "./editionOverrideStore";
import { recordDevEditionSnapshot } from "./recordDevEditionSnapshot";
import type { KindredPlace } from "../location/types";

export async function tryApplyDevEditionPreview(
  applyBundle: (bundle: CachedEditionBundle) => void
): Promise<boolean> {
  if (!isDeveloperMode()) return false;
  await hydrateDevEditionOverrideState();
  const preview = getDevActivePreviewEntry();
  if (!preview?.bundle) return false;
  const calendarToday = calendarEditionDate();
  if (
    isPastEditionDate(preview.bundle.editionDate, calendarToday) ||
    preview.bundle.editionDate !== calendarToday
  ) {
    return false;
  }
  applyBundle(preview.bundle);
  return true;
}

export async function maybeRecordDevEditionSnapshot(input: {
  place: KindredPlace | null;
  editionDate: string;
  bundle: CachedEditionBundle;
  generationTimeMs?: number | null;
  apiErrors?: string[];
  discovery?: unknown;
}): Promise<void> {
  if (!isDeveloperMode() || !input.place) return;
  await hydrateDevEditionOverrideState();
  if (!isDevEditionOverrideActive()) return;
  await recordDevEditionSnapshot({
    place: input.place,
    editionDate: input.editionDate,
    bundle: input.bundle,
    generationTimeMs: input.generationTimeMs,
    apiErrors: input.apiErrors,
    discovery: input.discovery,
    cacheStatus: "network",
  });
}
