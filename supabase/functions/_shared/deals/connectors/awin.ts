/** Awin connector. Stub until credentials land. */
import { createAffiliateNetworkConnector } from "./affiliateNetworkStub.ts";
import type { DealsSourceConnector } from "../types.ts";

export function createAwinConnector(): DealsSourceConnector {
  return createAffiliateNetworkConnector({
    id: "awin",
    label: "Awin",
    trustScore: 0.8,
    requiredEnv: ["AWIN_API_TOKEN", "AWIN_PUBLISHER_ID"],
    // fetchLive: async (options) => { /* page Awin promotions feed → NormalizedDeal[] */ },
  });
}
