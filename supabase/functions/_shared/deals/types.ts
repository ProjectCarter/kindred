/**
 * Deals — provider-agnostic source model.
 *
 * Every affiliate network (CJ, Awin, Impact, PartnerStack) and direct-merchant
 * program implements the same {@link DealsSourceConnector}. Nothing about a
 * specific network leaks past this boundary: the sync job merges `NormalizedDeal`
 * records from every configured connector, writes them to `deals_catalog`, and a
 * later publish pass promotes curated, verified, non-expired deals to
 * `deals_published`. Adding a new network is one new connector + one registry row.
 *
 * This mirrors the Local Events source-connector registry
 * (`localEvents/sources/*`) — the proven multi-provider pattern in this codebase.
 */

export type DealScope = "local" | "online" | "nationwide";

export type DealSourceId =
  | "direct"
  | "cj"
  | "awin"
  | "impact"
  | "partnerstack";

/** Broad offer type — indexed metadata used for filtering, never invented. */
export type DealTypeId =
  | "restaurant"
  | "experience"
  | "travel"
  | "event_ticket"
  | "retail_online"
  | "local_business"
  | "other";

/** Discount mechanic — indexed metadata used for filtering. */
export type DiscountTypeId =
  | "percent"
  | "dollar_off"
  | "bogo"
  | "voucher"
  | "seasonal"
  | "free_shipping"
  | "other";

/**
 * A single offer normalized from any provider. Column names align with
 * `deals_catalog`; the publish pass projects the curated subset into
 * `deals_published`.
 */
export type NormalizedDeal = {
  provider: DealSourceId;
  /** Stable id from the provider — deduped as (provider, providerId). */
  providerId: string;
  providerCategory?: string | null;

  scope: DealScope;
  /** Kindred metro key for local deals; null for online / nationwide. */
  metroKey?: string | null;

  /** Kindred category id (see lib/deals category dictionary). */
  category: string;
  dealType?: DealTypeId | null;
  discountType?: DiscountTypeId | null;

  merchant: string;
  title: string;
  savingsLabel?: string | null;
  description?: string | null;
  savingsDetail?: string | null;
  knownFor?: string | null;
  highlights?: string[];
  terms?: string | null;
  voucherCode?: string | null;

  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lon?: number | null;

  website?: string | null;
  /** Affiliate / tracking URL followed only after "Redeem Deal". */
  redeemUrl?: string | null;
  /** V1 ships no deal photography — reserved for a future authorized image. */
  imageUrl?: string | null;

  startsAt?: string | null;
  endsAt?: string | null;
};

export type DealsFetchOptions = {
  /** Restrict to one metro when a connector supports local targeting. */
  metroKey?: string | null;
  /** Incremental syncs may pass the ids already stored to short-circuit. */
  knownProviderIds?: Set<string>;
  mode?: "incremental" | "full";
};

/**
 * One affiliate network / program. `isConfigured` gates whether the sync job
 * calls it, so an un-provisioned network is simply skipped — never an error.
 */
export type DealsSourceConnector = {
  readonly id: DealSourceId;
  readonly label: string;
  /** 0–1 editorial trust weight used when merging overlapping offers. */
  readonly trustScore: number;
  readonly isConfigured: boolean;
  fetch(options?: DealsFetchOptions): Promise<NormalizedDeal[]>;
};

export type DealsSourceResult = {
  source: DealSourceId;
  ok: boolean;
  deals: NormalizedDeal[];
  error?: string;
};
