/**
 * Source image-rights policy — conservative defaults for every event provider.
 * Kindred never assumes listing photography is licensed for display.
 */

import type { LocalEvent } from "./provider.ts";
import {
  DEFAULT_SOURCE_RIGHTS,
  type EventImageReusePolicy,
  type EventSourceRightsPolicy,
  TRUSTED_EVENT_SOURCE_NETWORK,
} from "./sources/types.ts";

export type EventImageRights = {
  /** Whether Kindred may display the listing photograph in the app. */
  authorized: boolean;
  policy: EventImageReusePolicy;
  sourceId: string;
};

export function isImageReuseAuthorized(
  policy: EventImageReusePolicy
): boolean {
  return policy === "api_granted" || policy === "partner_granted";
}

/** Rights policy for a connector — unknown sources default to unverified. */
export function rightsPolicyForSource(
  sourceId: string | undefined
): EventSourceRightsPolicy {
  const hit = TRUSTED_EVENT_SOURCE_NETWORK.find((s) => s.id === sourceId);
  return hit?.rights ?? DEFAULT_SOURCE_RIGHTS;
}

export function resolveEventImageRights(
  sourceId: string | undefined
): EventImageRights {
  const rights = rightsPolicyForSource(sourceId);
  return {
    authorized: isImageReuseAuthorized(rights.imageReuse),
    policy: rights.imageReuse,
    sourceId: sourceId ?? "unknown",
  };
}

/**
 * Apply per-source image policy — strip unauthorized URLs before persist/display.
 * Provider URLs remain available in logs upstream; only authorized images ship.
 */
export function applyEventImageRights(event: LocalEvent): LocalEvent {
  const imageRights = resolveEventImageRights(event.sourceId);
  const hasAuthorizedUrl =
    imageRights.authorized && Boolean(event.imageUrl?.trim());

  if (hasAuthorizedUrl) {
    return {
      ...event,
      imageRights,
      imageUrl: event.imageUrl!.trim(),
      imageSource: event.imageSource ?? "provider_thumbnail",
    };
  }

  return {
    ...event,
    imageRights,
    imageUrl: null,
    imageSource: null,
  };
}

export function applyEventImageRightsBatch(
  events: LocalEvent[]
): LocalEvent[] {
  return events.map(applyEventImageRights);
}
