/**
 * Server mirror — parse persisted discovery JSON for completeness checks.
 */

import type { DiscoveryPayload, DiscoverySurface, RankedDiscoveryItem } from "./types.ts";

export function parseDiscoveryPayload(value: unknown): DiscoveryPayload | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DiscoveryPayload>;
  if (raw.version !== 1 || !raw.surfaces || typeof raw.surfaces !== "object") {
    return null;
  }
  return {
    ...(raw as DiscoveryPayload),
    picks: Array.isArray(raw.picks) ? raw.picks : [],
  };
}

export function discoveryItemsForSurface(
  payload: DiscoveryPayload | null | undefined,
  surface: DiscoverySurface
): RankedDiscoveryItem[] {
  const items = payload?.surfaces?.[surface]?.items ?? [];
  return items.filter((ranked) => {
    if (!ranked?.item || typeof ranked.item.title !== "string") return false;
    const title = ranked.item.title.trim();
    if (!title) return false;
    if (
      /third-wave|editorial quality|magazine desk|hand-selected for today/i.test(
        `${title} ${ranked.item.dek ?? ""}`
      )
    ) {
      return false;
    }
    if (
      ranked.item.source?.name === "Kindred Desk" &&
      /coffee|restaurants|hiking|beaches|parks|museums|experiences/.test(
        ranked.item.category
      )
    ) {
      return false;
    }
    return true;
  });
}
