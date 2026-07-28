/**
 * Deals source registry.
 *
 * The single place every affiliate program is registered. The sync job asks the
 * registry for all configured connectors and gathers offers from each in
 * parallel, isolating failures so one slow or broken network never blocks the
 * others (same resilience contract as the Local Events source registry).
 *
 * Add a network: create its connector, then add one line to `ALL_CONNECTORS`.
 */
import type {
  DealsFetchOptions,
  DealsSourceConnector,
  DealsSourceResult,
} from "./types.ts";
import { createDirectMerchantConnector } from "./connectors/directMerchant.ts";
import { createCjConnector } from "./connectors/cj.ts";
import { createAwinConnector } from "./connectors/awin.ts";
import { createImpactConnector } from "./connectors/impact.ts";
import { createPartnerStackConnector } from "./connectors/partnerstack.ts";

export function allDealConnectors(): DealsSourceConnector[] {
  return [
    createDirectMerchantConnector(),
    createCjConnector(),
    createAwinConnector(),
    createImpactConnector(),
    createPartnerStackConnector(),
  ];
}

export function configuredDealConnectors(): DealsSourceConnector[] {
  return allDealConnectors().filter((connector) => connector.isConfigured);
}

/**
 * Fetch from every configured connector in parallel. A rejected connector is
 * captured as `{ ok: false }` and never throws — the caller still receives every
 * successful source's deals.
 */
export async function gatherFromAllDealSources(
  options?: DealsFetchOptions
): Promise<DealsSourceResult[]> {
  const connectors = configuredDealConnectors();
  const settled = await Promise.allSettled(
    connectors.map(async (connector) => {
      const deals = await connector.fetch(options);
      return { source: connector.id, ok: true as const, deals };
    })
  );

  return settled.map((result, index): DealsSourceResult => {
    if (result.status === "fulfilled") return result.value;
    return {
      source: connectors[index].id,
      ok: false,
      deals: [],
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });
}
