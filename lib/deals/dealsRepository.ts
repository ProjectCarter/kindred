/**
 * Deals repository — the client read path.
 *
 * Reads the anon-readable `deals_published` projection via PostgREST. The DB
 * (RLS + publish window) guarantees only live, published rows are returned;
 * this layer adds three hygiene passes before any offer reaches the UI:
 *
 *   1. Family-Friendly / restricted-business safety (belt-and-suspenders).
 *   2. Redeemability — an offer with no valid http(s) redeem URL is dropped.
 *   3. De-duplication by public `deal_key`.
 *
 * The catalog is small (national + a handful of local offers per metro), so the
 * client fetches the full published set ONCE per session (short TTL cache) and
 * all scope classification + metro filtering happen locally in
 * `offerClassification.ts`. This keeps the three-layer decision (Local / Travel
 * / Online) entirely in the engine rather than pre-filtered by the query, so a
 * merchant override can move an offer nationwide without any query change.
 *
 * Every call fails soft: if Supabase is unconfigured or a query errors, reads
 * resolve to empty results so the Offers section simply hides.
 */
import { supabase, isSupabaseConfigured } from "../supabase";
import { isRestrictedBusinessListing } from "../edition/restrictedBusinessFilter";
import { isRedeemableUrl } from "./redeemUrl";
import {
  mapPublishedDeal,
  PUBLISHED_DEAL_COLUMNS,
  type LocalDeal,
  type PublishedDealRow,
} from "./localDeals";

const DEALS_TABLE = "deals_published";

/**
 * Upper bound on the published catalog fetched in one read. Far above the V1
 * catalog size; a guard rail, not a page size. Grouping/preview happens locally.
 */
export const OFFERS_CATALOG_LIMIT = 200;

export type OffersResult = {
  deals: LocalDeal[];
  /** True when the read failed (vs. a genuinely empty catalog). */
  error: boolean;
};

// --- Lightweight in-memory cache (tier 2) -------------------------------------
// The published catalog is hot and changes slowly; a short TTL makes re-opening
// the homepage / Offers instant without ever serving expired offers (the DB
// policy already excludes those, and the TTL is far shorter than any window).
const CACHE_TTL_MS = 10 * 60 * 1000;
type CacheEntry = { value: LocalDeal[]; at: number };
let catalogCache: CacheEntry | null = null;

function fresh(entry: CacheEntry | null): entry is CacheEntry {
  return Boolean(entry) && Date.now() - entry!.at < CACHE_TTL_MS;
}

/** Clears the memoized catalog read (e.g. on pull-to-refresh). */
export function clearDealsCache(): void {
  catalogCache = null;
}

// --- Hygiene ------------------------------------------------------------------

/**
 * Defensive read-time safety gate (Family-Friendly Content Safety Standard).
 * The publish pipeline should never surface a restricted/weapons offer, but this
 * belt-and-suspenders pass drops any prohibited row before it can reach a card —
 * even from an already-cached or legacy projection.
 */
function isSafeDeal(deal: LocalDeal): boolean {
  return !isRestrictedBusinessListing({
    name: deal.merchant,
    venue: deal.merchant,
    category: deal.category,
    dek: deal.title,
    description: deal.description,
  });
}

/**
 * Map raw rows → `LocalDeal`, dropping anything unsafe, non-redeemable, or a
 * duplicate `deal_key`. Order is preserved (featured rank, then quality).
 */
function mapRows(rows: PublishedDealRow[] | null): LocalDeal[] {
  if (!rows?.length) return [];
  const seen = new Set<string>();
  const out: LocalDeal[] = [];
  for (const row of rows) {
    const deal = mapPublishedDeal(row);
    if (!deal.id || seen.has(deal.id)) continue;
    if (!isSafeDeal(deal)) continue;
    if (!isRedeemableUrl(deal.redeemUrl)) continue;
    seen.add(deal.id);
    out.push(deal);
  }
  return out;
}

// --- Reads --------------------------------------------------------------------

/**
 * The full published offers catalog, ordered by featured rank then quality.
 * Cached briefly. Scope classification + metro eligibility are applied later by
 * the classification engine — this read intentionally does NOT filter by region.
 */
export async function fetchPublishedOffers(
  limit = OFFERS_CATALOG_LIMIT
): Promise<OffersResult> {
  if (!isSupabaseConfigured) return { deals: [], error: false };

  if (fresh(catalogCache)) return { deals: catalogCache.value, error: false };

  try {
    const { data, error } = await supabase
      .from(DEALS_TABLE)
      .select(PUBLISHED_DEAL_COLUMNS)
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .order("quality_score", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) return { deals: [], error: true };

    const deals = mapRows(data as PublishedDealRow[] | null);
    catalogCache = { value: deals, at: Date.now() };
    return { deals, error: false };
  } catch {
    return { deals: [], error: true };
  }
}

/** A single offer by its public `deal_key`. Null when missing or unavailable. */
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
    const deal = mapPublishedDeal(data as PublishedDealRow);
    if (!isSafeDeal(deal)) return null;
    if (!isRedeemableUrl(deal.redeemUrl)) return null;
    return deal;
  } catch {
    return null;
  }
}
