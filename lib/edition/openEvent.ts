import type { Router } from "expo-router";
import type { LocalEventCard } from "./localEvents";
import { articleFromLocalEvent } from "./article";
import { openKindredArticle } from "./openArticle";

/**
 * Open a Local Event as a Kindred magazine feature
 * (Universal Content System — local_event or festival desk).
 */
export function openKindredEvent(
  router: Pick<Router, "push">,
  event: LocalEventCard,
  options: { backLabel?: string; editionId?: string | null } = {}
): void {
  const article = articleFromLocalEvent(event);
  openKindredArticle(router, article, {
    backLabel: options.backLabel,
    editionId: options.editionId ?? null,
  });
}
