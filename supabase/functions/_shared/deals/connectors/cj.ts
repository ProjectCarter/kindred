/** CJ Affiliate (Commission Junction) connector. Stub until credentials land. */
import { createAffiliateNetworkConnector } from "./affiliateNetworkStub.ts";
import type { DealsSourceConnector } from "../types.ts";

export function createCjConnector(): DealsSourceConnector {
  return createAffiliateNetworkConnector({
    id: "cj",
    label: "CJ Affiliate",
    trustScore: 0.8,
    requiredEnv: ["CJ_API_KEY", "CJ_WEBSITE_ID"],
    // fetchLive: async (options) => { /* page CJ product/offer feed → NormalizedDeal[] */ },
  });
}
