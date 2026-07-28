/**
 * Direct-merchant connector — the seed path.
 *
 * Merchants Kindred partners with directly (no affiliate network) are curated as
 * verified `NormalizedDeal` records. Until a live editorial source is wired, this
 * returns an empty list, so the desk ships zero deals rather than fabricated ones
 * (Kindred editorial law: when in doubt, leave it out).
 *
 * To bring real direct deals online, populate `DIRECT_MERCHANT_SEED` (or swap in
 * a query against a curated table) — no other code changes are required.
 */
import type {
  DealsFetchOptions,
  DealsSourceConnector,
  NormalizedDeal,
} from "../types.ts";

const DIRECT_MERCHANT_SEED: readonly NormalizedDeal[] = [] as const;

export function createDirectMerchantConnector(): DealsSourceConnector {
  return {
    id: "direct",
    label: "Direct Merchant",
    // Highest trust — hand-curated partnerships outrank network feeds on merge.
    trustScore: 1,
    isConfigured: true,
    async fetch(options?: DealsFetchOptions): Promise<NormalizedDeal[]> {
      const metroKey = options?.metroKey?.trim() || null;
      if (!metroKey) return [...DIRECT_MERCHANT_SEED];
      return DIRECT_MERCHANT_SEED.filter(
        (deal) => deal.scope !== "local" || deal.metroKey === metroKey
      );
    },
  };
}
