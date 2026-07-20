import type { ActiveLocation, KindredPlace } from "../location/types";
import {
  isDevEditionOverrideActive,
  resolveEffectiveEditionDate,
  resolveEffectivePlace,
  getDevOverridePlace,
} from "../edition/resolveEditionContext";
import { editionMetroKeyFromPlace } from "../markets/editionIdentity";
import {
  developerPreviewPlace,
  displayCityForEdition,
  getDeveloperPreviewContextSync,
  hydrateDeveloperPreviewContext,
  type DeveloperPreviewContext,
} from "./developerPreviewContext";
import { hydrateDevEditionOverrideState } from "./editionOverrideStore";
import {
  calendarEditionDate,
  isPastEditionDate,
  liveHomeEditionDate,
} from "../edition/editionDateGuard";
import { clearDeveloperPreviewContext } from "./developerPreviewContext";

export type EditionIdentitySource =
  | "generate-response"
  | "developer-preview"
  | "pending-dev-state"
  | "dev-override"
  | "profile-location"
  | "cache"
  | "database"
  | "background-sync"
  | "recovery-path";

export function traceEditionIdentity(
  handoff: string,
  input: {
    traceId?: string | null;
    editionId?: string | null;
    metroKey?: string | null;
    city?: string | null;
    source: EditionIdentitySource;
  }
): void {
  if (!__DEV__) return;
  console.log(`[edition-identity] ${handoff}`, input);
}

export type EditionLoadIdentity = {
  editionId: string | null;
  metroKey: string | null;
  place: KindredPlace | null;
  editionDate: string;
  isDeveloperPreview: boolean;
  source: EditionIdentitySource;
  activeLocation: ActiveLocation | null;
  preview: DeveloperPreviewContext | null;
};

function devPreviewActiveLocation(place: KindredPlace): ActiveLocation {
  return {
    place,
    mode: "home",
    modeLabel: "Dev Preview",
    isTravel: false,
    needsSetup: false,
  };
}

/**
 * Single authoritative reader identity for edition load, cache, recovery, and sync.
 * During Developer Preview, never derives metro from the home profile or GPS.
 */
export async function resolveEditionLoadIdentity(input: {
  handoff: string;
  traceId?: string | null;
  loadEditionId?: string | null;
  loadMetroKey?: string | null;
  /** When true, prefer generate-response / preview over stale in-memory location. */
  preferPreview?: boolean;
}): Promise<EditionLoadIdentity> {
  await hydrateDevEditionOverrideState();
  await hydrateDeveloperPreviewContext();
  let preview = getDeveloperPreviewContextSync();
  const calendarToday = calendarEditionDate();
  const editionDate = await resolveEffectiveEditionDate();
  if (preview && isPastEditionDate(preview.editionDate, calendarToday)) {
    await clearDeveloperPreviewContext();
    preview = null;
  }

  const generatedEditionId = input.loadEditionId?.trim() || null;
  const generatedMetroKey = input.loadMetroKey?.trim() || null;

  if (preview && (input.preferPreview !== false || isDevEditionOverrideActive())) {
    const overridePlace = isDevEditionOverrideActive() ? getDevOverridePlace() : null;
    const overrideMetroKey = overridePlace
      ? editionMetroKeyFromPlace(overridePlace)
      : null;
    const previewStale =
      Boolean(
        overrideMetroKey &&
          preview.metroKey &&
          overrideMetroKey !== preview.metroKey.trim()
      );
    if (previewStale && overridePlace) {
      const identity: EditionLoadIdentity = {
        editionId: generatedEditionId,
        metroKey: generatedMetroKey ?? overrideMetroKey,
        place: overridePlace,
        editionDate,
        isDeveloperPreview: true,
        source: generatedMetroKey ? "generate-response" : "dev-override",
        activeLocation: devPreviewActiveLocation(overridePlace),
        preview: null,
      };
      traceEditionIdentity(input.handoff, {
        traceId: input.traceId,
        editionId: identity.editionId,
        metroKey: identity.metroKey,
        city: overridePlace.city,
        source: identity.source,
      });
      return identity;
    }
    const place = developerPreviewPlace(preview);
    const metroKey = generatedMetroKey ?? preview.metroKey;
    const editionId = generatedEditionId ?? preview.editionId;
    const source: EditionIdentitySource = generatedMetroKey
      ? "generate-response"
      : "developer-preview";
    const identity: EditionLoadIdentity = {
      editionId,
      metroKey,
      place,
      editionDate: liveHomeEditionDate(preview.editionDate || editionDate, calendarToday),
      isDeveloperPreview: true,
      source,
      activeLocation: devPreviewActiveLocation(place),
      preview,
    };
    traceEditionIdentity(input.handoff, {
      traceId: input.traceId ?? preview.traceId ?? null,
      editionId,
      metroKey,
      city: place.city,
      source,
    });
    return identity;
  }

  if (isDevEditionOverrideActive()) {
    const place = getDevOverridePlace();
    if (place) {
      const metroKey = generatedMetroKey ?? editionMetroKeyFromPlace(place);
      const identity: EditionLoadIdentity = {
        editionId: generatedEditionId,
        metroKey,
        place,
        editionDate,
        isDeveloperPreview: false,
        source: generatedMetroKey ? "generate-response" : "dev-override",
        activeLocation: devPreviewActiveLocation(place),
        preview: null,
      };
      traceEditionIdentity(input.handoff, {
        traceId: input.traceId,
        editionId: identity.editionId,
        metroKey,
        city: place.city,
        source: identity.source,
      });
      return identity;
    }
  }

  const active = await resolveEffectivePlace({ refreshIfStale: false });
  const metroKey =
    generatedMetroKey ??
    (active.place ? editionMetroKeyFromPlace(active.place) : null);
  const identity: EditionLoadIdentity = {
    editionId: generatedEditionId,
    metroKey,
    place: active.place,
    editionDate,
    isDeveloperPreview: false,
    source: generatedMetroKey ? "generate-response" : "profile-location",
    activeLocation: active,
    preview: null,
  };
  traceEditionIdentity(input.handoff, {
    traceId: input.traceId,
    editionId: identity.editionId,
    metroKey,
    city: active.place?.city ?? null,
    source: identity.source,
  });
  return identity;
}

export { displayCityForEdition } from "./developerPreviewContext";
