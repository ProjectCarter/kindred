/**
 * Surface publishable Local Events for edition persistence.
 *
 * Fills the edition pool from allocated + reserve candidates using catalog
 * editorial when present, verified-facts composer when not, and optional AI
 * enrichment last — never lowering publication gates to hit homepage caps.
 */

import {
  HOMEPAGE_INITIAL_RENDER_COUNT,
  LOCAL_EVENTS_EDITION_SURFACED_MAX,
} from "../editorial/publishing.ts";
import {
  enrichEventsWithBanditNotes,
  eventHasPublishableEditorial,
} from "./banditNotes.ts";
import { composeVerifiedEventEditorialIfPublishable } from "./verifiedEventEditorialComposer.ts";
import type { LocalEvent } from "./provider.ts";

export type SurfaceLocalEventsOptions = {
  editionDate?: string | null;
  editorialTarget?: number;
  homepageMinimum?: number;
  /** When false, verified composer + existing catalog editorial only. */
  allowAiEnrichment?: boolean;
  now?: Date;
  readerCity?: string | null;
  readerLat?: number | null;
  readerLon?: number | null;
};

function eventDedupeKey(event: LocalEvent): string {
  return `${event.name}|${event.startDateTime}`.toLowerCase();
}

function attachVerifiedEditorialIfPublishable(
  event: LocalEvent,
  editionDate?: string | null
): LocalEvent {
  if (eventHasPublishableEditorial(event)) return event;
  const copy = composeVerifiedEventEditorialIfPublishable(event, { editionDate });
  if (!copy) return event;
  return {
    ...event,
    editorialHeadline: copy.editorialHeadline,
    banditNote: copy.banditNote,
    editorialBody: copy.editorialBody,
  };
}

function mergePublishable(
  target: LocalEvent[],
  seen: Set<string>,
  incoming: LocalEvent[],
  limit: number
): void {
  for (const event of incoming) {
    if (target.length >= limit) break;
    const key = eventDedupeKey(event);
    if (seen.has(key) || !eventHasPublishableEditorial(event)) continue;
    seen.add(key);
    target.push(event);
  }
}

function buildDedupedQueue(primary: LocalEvent[], reserve: LocalEvent[]): LocalEvent[] {
  const seen = new Set<string>();
  const queue: LocalEvent[] = [];
  for (const event of [...primary, ...reserve]) {
    const key = eventDedupeKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(event);
  }
  return queue;
}

/**
 * Build the publishable Local Events list for edition persistence.
 * Targets up to `editorialTarget` (default See All max) while preferring
 * at least `homepageMinimum` (default 8) when the verified pool supports it.
 */
export async function surfaceLocalEventsForEdition(
  allocated: LocalEvent[],
  reservePool: LocalEvent[],
  options?: SurfaceLocalEventsOptions
): Promise<LocalEvent[]> {
  const editorialTarget =
    options?.editorialTarget ?? LOCAL_EVENTS_EDITION_SURFACED_MAX;
  const homepageMinimum =
    options?.homepageMinimum ?? HOMEPAGE_INITIAL_RENDER_COUNT;
  const editionDate = options?.editionDate ?? null;
  const allowAi = options?.allowAiEnrichment !== false;

  const queue = buildDedupedQueue(allocated, reservePool);
  const verifiedReady = queue.map((event) =>
    attachVerifiedEditorialIfPublishable(event, editionDate)
  );

  const publishable: LocalEvent[] = [];
  const seen = new Set<string>();
  mergePublishable(publishable, seen, verifiedReady, editorialTarget);

  if (allowAi && publishable.length < editorialTarget) {
    const pending = verifiedReady.filter(
      (event) => !seen.has(eventDedupeKey(event))
    );
    let cursor = 0;
    while (publishable.length < editorialTarget && cursor < pending.length) {
      const batchSize = Math.min(
        4,
        editorialTarget - publishable.length + 2,
        pending.length - cursor
      );
      const batch = pending.slice(cursor, cursor + batchSize);
      cursor += batchSize;
      const enriched = await enrichEventsWithBanditNotes(batch, {
        editionDate,
        maxGenerate: batch.length,
      });
      const normalized = enriched.map((event) =>
        attachVerifiedEditorialIfPublishable(event, editionDate)
      );
      mergePublishable(publishable, seen, normalized, editorialTarget);
    }
  }

  if (publishable.length < homepageMinimum) {
    mergePublishable(
      publishable,
      seen,
      verifiedReady,
      Math.min(editorialTarget, homepageMinimum)
    );
  }

  return publishable.slice(0, editorialTarget);
}
