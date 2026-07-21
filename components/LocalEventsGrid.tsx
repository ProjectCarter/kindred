import { useMemo } from "react";
import {
  orderEventsForGrid,
  orderEventsForEdition,
  HOMEPAGE_INITIAL_RENDER_COUNT,
  type LocalEventCard,
} from "../lib/edition/localEvents";
import { localEventListingCard } from "../lib/edition/homepageListingCards";
import type { LocalEventsLoadStatus } from "../lib/edition/localEventsPipeline";
import { EditorialCardGrid } from "./EditorialCardGrid";

type Props = {
  events: LocalEventCard[];
  /** Edition-curated homepage order — skips client re-scoring when provided. */
  homepageOrder?: LocalEventCard[] | null;
  /** Sports market for hometown team icons and homepage boosts. */
  sportsMarketId?: string | null;
  onOpenEvent?: (event: LocalEventCard) => void;
  /** Homepage first paint count — rendering only; full edition may contain more. */
  initialRenderCount?: number;
  /** Present only on the front page — shown below the grid once there are more events than fit. */
  onSeeAll?: () => void;
  /**
   * Shows Bandit (resting, no newspaper — "nothing more to deliver") beside
   * the empty message. Reserved for the dedicated "See all" list screen so
   * the busy front page never carries more than one Bandit at a time.
   */
  showBanditWhenEmpty?: boolean;
  /** Distinguishes a confirmed quiet day from a failed/recovering fetch. */
  loadStatus?: LocalEventsLoadStatus;
};

function eventCardId(event: LocalEventCard): string {
  return `${event.name}::${event.date}::${event.venue}`;
}

/**
 * Local Events — typography-first editorial grid matching Activities and
 * Food & Drinks. No listing photography on the homepage.
 */
export function LocalEventsGrid({
  events,
  homepageOrder,
  sportsMarketId,
  onOpenEvent,
  initialRenderCount = HOMEPAGE_INITIAL_RENDER_COUNT,
  onSeeAll,
  showBanditWhenEmpty = false,
  loadStatus = "ready",
}: Props) {
  /** See All passes the full persisted list — keep server editorial order. */
  const usePersistedOrder =
    events.length > 0 && initialRenderCount >= events.length;
  /** Phase 5 — edition curation already balanced the homepage slice. */
  const useCuratedHomepageOrder = Boolean(homepageOrder?.length);
  /** TEMPORARY — Eventbrite-only test: skip client re-scoring, use persisted order. */
  const eventbriteOnlyTest =
    events.length > 0 && events.every((e) => e.sourceId === "eventbrite");
  const published =
    useCuratedHomepageOrder
      ? homepageOrder!
      : usePersistedOrder || eventbriteOnlyTest
        ? events
        : orderEventsForEdition(events);
  const visibleEvents =
    useCuratedHomepageOrder
      ? homepageOrder!.slice(0, initialRenderCount)
      : usePersistedOrder || eventbriteOnlyTest
        ? events.slice(0, initialRenderCount)
        : orderEventsForGrid(events, initialRenderCount);
  const seeAllTotal = useCuratedHomepageOrder ? events.length : published.length;

  const eventsById = useMemo(() => {
    const map = new Map<string, LocalEventCard>();
    for (const event of published) {
      map.set(eventCardId(event), event);
    }
    return map;
  }, [published]);

  const cards = useMemo(
    () =>
      visibleEvents.map((event) =>
        localEventListingCard(event, sportsMarketId)
      ),
    [visibleEvents, sportsMarketId]
  );

  const emptyCopy =
    loadStatus === "failed"
      ? "Local events are having trouble loading right now. Pull to refresh in a moment."
      : loadStatus === "recovering"
        ? "Checking for events nearby…"
        : "A quiet day nearby — the perfect excuse for a slow walk.";

  return (
    <EditorialCardGrid
      kicker="Local Events"
      cards={cards}
      initialRenderCount={initialRenderCount}
      seeAllTotal={seeAllTotal}
      onSeeAll={onSeeAll}
      seeAllLabel={(n) => `See all ${n} events`}
      analyticsSectionType="local_events"
      emptyCopy={emptyCopy}
      showBanditWhenEmpty={showBanditWhenEmpty}
      onOpenCard={
        onOpenEvent
          ? (card) => {
              const event = eventsById.get(card.id);
              if (event) onOpenEvent(event);
            }
          : undefined
      }
    />
  );
}
