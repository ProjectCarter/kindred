/**
 * Redeem an offer — the single, reusable affiliate hand-off for the whole app.
 *
 * This is the one code path every offer flows through, today and forever. An
 * offer is entirely data: it carries its own `redeemUrl` (any affiliate network
 * — AWIN, CJ, Impact, Rakuten, Ticketmaster, Viator, Eventbrite, etc.). The UI
 * calls {@link redeemOffer}; nothing here is specific to any merchant or
 * network. Adding thousands more offers is a data task — store another
 * `redeemUrl` — never a code change.
 *
 * Guarantees:
 * - Opens the EXACT stored URL in the user's default browser. Tracking
 *   parameters are preserved byte-for-byte — never rebuilt, appended, or
 *   stripped (see `normalizeRedeemUrl`).
 * - Fails soft: a missing/malformed URL or a launch failure returns `false`
 *   so callers can hide/disable the button rather than crash.
 * - Fires one fire-and-forget analytics event (hostname only — affiliate IDs
 *   in the path/query are never logged).
 */
import { Linking } from "react-native";
import { trackOfferRedeemed } from "../analytics";
import type { LocalDeal } from "./localDeals";
import { normalizeRedeemUrl } from "./redeemUrl";

/** True when this offer can be redeemed (has a safe, openable http(s) URL). */
export function canRedeemOffer(
  deal: Pick<LocalDeal, "redeemUrl"> | null | undefined
): boolean {
  return normalizeRedeemUrl(deal?.redeemUrl) !== null;
}

/**
 * Open the offer's affiliate URL in the browser. Returns `true` when the link
 * was handed off to the OS, `false` when there is nothing safe to open or the
 * launch failed. Never throws.
 */
export async function redeemOffer(deal: LocalDeal): Promise<boolean> {
  const target = normalizeRedeemUrl(deal.redeemUrl);
  if (!target) return false;
  try {
    await Linking.openURL(target);
    // Analytics seam — one line, non-blocking. Logs the destination hostname
    // only (never the affiliate id / path / query). Future "offer_opened",
    // "affiliate_clicked", "successful_redirect" events can hang off this
    // same call site without touching any screen.
    trackOfferRedeemed({
      contentId: deal.id,
      contentTitle: deal.title,
      url: target,
      source: deal.source ?? null,
    });
    return true;
  } catch {
    return false;
  }
}
