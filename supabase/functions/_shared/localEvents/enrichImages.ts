/**
 * Event image enrichment — DISABLED pending explicit source authorization.
 *
 * Wikipedia venue thumbnails and third-party fallbacks are not licensed for
 * Kindred display. Use `sourceRights.ts` instead; re-enable enrichment only
 * when a source policy is `api_granted` or `partner_granted`.
 */

import type { LocalEvent } from "./provider.ts";

/** @deprecated Use applyEventImageRightsBatch — enrichment disabled for rights compliance. */
export async function enrichEventImages(
  events: LocalEvent[]
): Promise<LocalEvent[]> {
  return events;
}
