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
  /** Homepage only — floating #95DFF2 tiles on cream (See All keeps classic grid). */
  floatingCardTint?: "sky";
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
  floatingCardTint,
}: Props) {
  /** Phase 5 — edition curation already balanced the homepage slice. */
  const useCuratedHomepageOrder = Boolean(homepageOrder?.length);
  /** TEMPORARY — Eventbrite-only test: skip client re-scoring, use persisted order. */
  const eventbriteOnlyTest =
    events.length > 0 && events.every((e) => e.sourceId === "eventbrite");

  const visibleEvents = useMemo(() => {
    let slice: LocalEventCard[];
    if (useCuratedHomepageOrder) {
      const curated = homepageOrder!.slice(0, initialRenderCount);
      const target = Math.min(
        events.filter((event) => Boolean(event.name?.trim())).length,
        initialRenderCount
      );
      if (curated.length >= target) {
        slice = curated;
      } else {
        const seen = new Set(curated.map((event) => eventCardId(event)));
        const fill = events
          .filter(
            (event) =>
              Boolean(event.name?.trim()) && !seen.has(eventCardId(event))
          )
          .slice(0, target - curated.length);
        slice = [...curated, ...fill];
      }
    } else if (
      (events.length > 0 && initialRenderCount >= events.length) ||
      eventbriteOnlyTest
    ) {
      slice = events.slice(0, initialRenderCount);
    } else {
      slice = orderEventsForGrid(events, initialRenderCount);
    }
    // Horizon/threshold filters can zero the grid while the edition still
    // carries events — always surface the persisted pool on the homepage.
    if (slice.length === 0 && events.length > 0) {
      slice = events
        .filter((event) => Boolean(event.name?.trim()))
        .slice(0, initialRenderCount);
    }
    return slice;
  }, [
    events,
    homepageOrder,
    useCuratedHomepageOrder,
    eventbriteOnlyTest,
    initialRenderCount,
  ]);

  const published =
    useCuratedHomepageOrder
      ? homepageOrder!
      : (events.length > 0 && initialRenderCount >= events.length) ||
          eventbriteOnlyTest
        ? events
        : orderEventsForEdition(events);
  const seeAllTotal = useCuratedHomepageOrder ? events.length : published.length;

  const eventsById = useMemo(() => {
    const map = new Map<string, LocalEventCard>();
    for (const event of [...published, ...visibleEvents]) {
      map.set(eventCardId(event), event);
    }
    return map;
  }, [published, visibleEvents]);

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
      : loadStatus === "recovering" || loadStatus === "loading"
        ? "Checking for events nearby…"
        : "A quiet day nearby — the perfect excuse for a slow walk.";

  return (
    <EditorialCardGrid
      kicker="Local Events"
      floatingCardTint={floatingCardTint}
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
