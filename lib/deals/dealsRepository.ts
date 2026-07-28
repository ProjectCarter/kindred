/**
 * Deals repository — the client read path.
 *
 * Reads the anon-readable `deals_published` projection via PostgREST so that
 * filtering, sorting, pagination, and geo all run in the database. The app never
 * downloads the full catalog and never contacts an affiliate network at page
 * load. Every call fails soft: if Supabase is unconfigured or a query errors,
 * reads resolve to empty results so the Deals section simply hides.
 *
 * The website will consume this same `deals_published` table through its own
 * Supabase client, keeping one backend behind both products.
 */
import { supabase, isSupabaseConfigured } from "../supabase";
import {
  mapPublishedDeal,
  PUBLISHED_DEAL_COLUMNS,
  type LocalDeal,
  type PublishedDealRow,
} from "./localDeals";

const DEALS_TABLE = "deals_published";

/** See All initial page size (20–30 deals, load more on scroll). */
export const DEALS_PAGE_SIZE = 24;
/** Homepage featured cap. */
export const DEALS_FEATURED_LIMIT = 8;

export type DealsQuery = {
  /** Metro key for local deals; when set, nationwide/online deals are included too. */
  regionKey?: string | null;
  category?: string | null;
};

export type DealsPage = {
  deals: LocalDeal[];
  hasMore: boolean;
  /** True when the read failed (vs. a genuinely empty catalog). */
  error: boolean;
};

// --- Lightweight in-memory cache (tier 2) -------------------------------------
// Featured deals + counts are hot and change slowly; a short TTL makes re-opening
// the homepage / Deals instant without ever serving expired deals (the DB policy
// already excludes those, and the TTL is far shorter than any offer window).
const CACHE_TTL_MS = 10 * 60 * 1000;
type CacheEntry<T> = { value: T; at: number };
const featuredCache = new Map<string, CacheEntry<LocalDeal[]>>();
const countCache = new Map<string, CacheEntry<number>>();

function cacheKey(query: DealsQuery): string {
  return `${query.regionKey ?? "*"}::${query.category ?? "*"}`;
}

function fresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return Boolean(entry) && Date.now() - entry!.at < CACHE_TTL_MS;
}

/** Clears memoized featured/count reads (e.g. on pull-to-refresh). */
export function clearDealsCache(): void {
  featuredCache.clear();
  countCache.clear();
}

// --- Query helpers ------------------------------------------------------------

function scopeFilter(regionKey?: string | null): string | null {
  const region = regionKey?.trim();
  if (!region) return null;
  // Local deals for this metro, plus everything nationwide / online.
  return `region_key.eq.${region},scope.in.(online,nationwide)`;
}

function mapRows(rows: PublishedDealRow[] | null): LocalDeal[] {
  if (!rows?.length) return [];
  return rows.map(mapPublishedDeal);
}

// --- Reads --------------------------------------------------------------------

/** Homepage featured deals — capped, ordered by featured rank then quality. */
export async function fetchFeaturedDeals(
  query: DealsQuery = {},
  limit = DEALS_FEATURED_LIMIT
): Promise<LocalDeal[]> {
  if (!isSupabaseConfigured) return [];

  const key = `${cacheKey(query)}::${limit}`;
  const cached = featuredCache.get(key);
  if (fresh(cached)) return cached.value;

  try {
    let request = supabase
      .from(DEALS_TABLE)
      .select(PUBLISHED_DEAL_COLUMNS)
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("quality_score", { ascending: false, nullsFirst: false })
      .limit(limit);

    const scope = scopeFilter(query.regionKey);
    if (scope) request = request.or(scope);
    if (query.category) request = request.eq("category", query.category);

    const { data, error } = await request;
    if (error) return [];

    const deals = mapRows(data as PublishedDealRow[] | null);
    featuredCache.set(key, { value: deals, at: Date.now() });
    return deals;
  } catch {
    return [];
  }
}

/** A See All page of deals, ordered like the homepage. */
export async function fetchDealsPage(
  query: DealsQuery = {},
  offset = 0,
  limit = DEALS_PAGE_SIZE
): Promise<DealsPage> {
  if (!isSupabaseConfigured) return { deals: [], hasMore: false, error: false };

  try {
    let request = supabase
      .from(DEALS_TABLE)
      .select(PUBLISHED_DEAL_COLUMNS)
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("quality_score", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const scope = scopeFilter(query.regionKey);
    if (scope) request = request.or(scope);
    if (query.category) request = request.eq("category", query.category);

    const { data, error } = await request;
    if (error) return { deals: [], hasMore: false, error: true };

    const deals = mapRows(data as PublishedDealRow[] | null);
    return { deals, hasMore: deals.length === limit, error: false };
  } catch {
    return { deals: [], hasMore: false, error: true };
  }
}

/** Total live deal count for a query — used for count bucketing (0 / n / 100+). */
export async function fetchDealsCount(query: DealsQuery = {}): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const key = cacheKey(query);
  const cached = countCache.get(key);
  if (fresh(cached)) return cached.value;

  try {
    // Bounded server-side count (capped at 101 rows in SQL) — never a full-table
    // scan, so the "100+" badge stays O(1) as the catalog grows.
    const { data, error } = await supabase.rpc("count_published_deals", {
      p_region_key: query.regionKey ?? null,
      p_category: query.category ?? null,
    });
    if (error) return 0;

    const total = typeof data === "number" ? data : 0;
    countCache.set(key, { value: total, at: Date.now() });
    return total;
  } catch {
    return 0;
  }
}

/** A single deal by its public `deal_key`. Null when missing or unavailable. */
export async function fetchDealById(dealKey: string): Promise<LocalDeal | null> {
  if (!isSupabaseConfigured) return null;
  const key = dealKey?.trim();
  if (!key) return null;

  try {
    const { data, error } = await supabase
      .from(DEALS_TABLE)
      .select(PUBLISHED_DEAL_COLUMNS)
      .eq("deal_key", key)
      .maybeSingle();

    if (error || !data) return null;
    return mapPublishedDeal(data as PublishedDealRow);
  } catch {
    return null;
  }
}
