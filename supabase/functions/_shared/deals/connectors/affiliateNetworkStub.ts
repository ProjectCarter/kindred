/**
 * Affiliate-network connector scaffold.
 *
 * CJ, Awin, Impact, and PartnerStack all follow the same shape: read credentials
 * from edge-function secrets, page a feed, normalize to `NormalizedDeal[]`. Until
 * credentials are provisioned, `isConfigured` is false and the sync job skips the
 * network entirely — a missing network is never an error.
 *
 * When credentials land, implement `fetchLive` for the network (feed pagination +
 * mapping to NormalizedDeal) and pass it here; nothing else in the pipeline
 * changes.
 */
import type {
  DealSourceId,
  DealsFetchOptions,
  DealsSourceConnector,
  NormalizedDeal,
} from "../types.ts";

type NetworkConfig = {
  id: DealSourceId;
  label: string;
  trustScore: number;
  /** Secret names (in edge-function env) that must all be present to enable it. */
  requiredEnv: string[];
  /** Implemented once real credentials + feed format are available. */
  fetchLive?: (options?: DealsFetchOptions) => Promise<NormalizedDeal[]>;
};

function hasAllEnv(names: string[]): boolean {
  const env = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env;
  if (!env) return false;
  return names.every((name) => Boolean(env.get(name)?.trim()));
}

export function createAffiliateNetworkConnector(
  config: NetworkConfig
): DealsSourceConnector {
  const configured = Boolean(config.fetchLive) && hasAllEnv(config.requiredEnv);
  return {
    id: config.id,
    label: config.label,
    trustScore: config.trustScore,
    isConfigured: configured,
    async fetch(options?: DealsFetchOptions): Promise<NormalizedDeal[]> {
      if (!configured || !config.fetchLive) return [];
      return config.fetchLive(options);
    },
  };
}
