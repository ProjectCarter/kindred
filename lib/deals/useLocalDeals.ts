/**
 * Deals hooks — read the published catalog through the repository.
 *
 * `useLocalDeals` powers the See All screen: it loads the first page (20–30
 * deals) and appends more only as the reader scrolls. `useFeaturedDeals` powers
 * the homepage desk (up to 8). Both fail soft — an unconfigured backend or a read
 * error resolves to an empty catalog so the section simply hides.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalDeal } from "./localDeals";
import {
  DEALS_FEATURED_LIMIT,
  DEALS_PAGE_SIZE,
  fetchDealsCount,
  fetchDealsPage,
  fetchFeaturedDeals,
  type DealsQuery,
} from "./dealsRepository";

export type LocalDealsStatus = "loading" | "ready" | "empty" | "error";

export type LocalDealsState = {
  status: LocalDealsStatus;
  deals: LocalDeal[];
  hasMore: boolean;
  loadingMore: boolean;
  /** Live deal count for the header label (0 / n / 100+ bucketed by caller). */
  totalCount: number;
  loadMore: () => void;
};

const EMPTY_QUERY: DealsQuery = {};

/** See All Deals — paginated, load-more-on-scroll. */
export function useLocalDeals(query: DealsQuery = EMPTY_QUERY): LocalDealsState {
  const regionKey = query.regionKey ?? null;
  const category = query.category ?? null;

  const [status, setStatus] = useState<LocalDealsStatus>("loading");
  const [deals, setDeals] = useState<LocalDeal[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const q: DealsQuery = { regionKey, category };
    setStatus("loading");
    setDeals([]);
    setHasMore(false);
    offsetRef.current = 0;

    (async () => {
      const [page, count] = await Promise.all([
        fetchDealsPage(q, 0, DEALS_PAGE_SIZE),
        fetchDealsCount(q),
      ]);
      if (cancelled) return;
      setTotalCount(count);
      if (page.error) {
        setStatus("error");
        return;
      }
      setDeals(page.deals);
      setHasMore(page.hasMore);
      offsetRef.current = page.deals.length;
      setStatus(page.deals.length > 0 ? "ready" : "empty");
    })();

    return () => {
      cancelled = true;
    };
  }, [regionKey, category]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const q: DealsQuery = { regionKey, category };
    const offset = offsetRef.current;

    (async () => {
      const page = await fetchDealsPage(q, offset, DEALS_PAGE_SIZE);
      if (!page.error) {
        setDeals((prev) => {
          const seen = new Set(prev.map((d) => d.id));
          const next = page.deals.filter((d) => !seen.has(d.id));
          offsetRef.current = offset + page.deals.length;
          return [...prev, ...next];
        });
        setHasMore(page.hasMore);
      }
      loadingRef.current = false;
      setLoadingMore(false);
    })();
  }, [hasMore, regionKey, category]);

  return { status, deals, hasMore, loadingMore, totalCount, loadMore };
}

export type FeaturedDealsState = {
  loading: boolean;
  deals: LocalDeal[];
  totalCount: number;
};

/** Homepage Deals desk — up to 8 featured deals plus the total live count. */
export function useFeaturedDeals(
  query: DealsQuery = EMPTY_QUERY
): FeaturedDealsState {
  const regionKey = query.regionKey ?? null;
  const category = query.category ?? null;

  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<LocalDeal[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const q: DealsQuery = { regionKey, category };
    setLoading(true);

    (async () => {
      const [featured, count] = await Promise.all([
        fetchFeaturedDeals(q, DEALS_FEATURED_LIMIT),
        fetchDealsCount(q),
      ]);
      if (cancelled) return;
      setDeals(featured);
      setTotalCount(count);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [regionKey, category]);

  return { loading, deals, totalCount };
}
