/** PartnerStack connector. Stub until credentials land. */
import { createAffiliateNetworkConnector } from "./affiliateNetworkStub.ts";
import type { DealsSourceConnector } from "../types.ts";

export function createPartnerStackConnector(): DealsSourceConnector {
  return createAffiliateNetworkConnector({
    id: "partnerstack",
    label: "PartnerStack",
    trustScore: 0.75,
    requiredEnv: ["PARTNERSTACK_API_KEY", "PARTNERSTACK_API_SECRET"],
    // fetchLive: async (options) => { /* page PartnerStack offers feed → NormalizedDeal[] */ },
  });
}
