/** Impact.com connector. Stub until credentials land. */
import { createAffiliateNetworkConnector } from "./affiliateNetworkStub.ts";
import type { DealsSourceConnector } from "../types.ts";

export function createImpactConnector(): DealsSourceConnector {
  return createAffiliateNetworkConnector({
    id: "impact",
    label: "Impact",
    trustScore: 0.8,
    requiredEnv: ["IMPACT_ACCOUNT_SID", "IMPACT_AUTH_TOKEN"],
    // fetchLive: async (options) => { /* page Impact campaigns/ads feed → NormalizedDeal[] */ },
  });
}
