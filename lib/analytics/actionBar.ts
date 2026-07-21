import type { ActionBarAction } from "../edition/actionBar";
import { isThirdPartyTicketUrl } from "../edition/officialWebsite";
import { extractDestinationDomain } from "./sanitize";
import { trackEvent } from "./trackEvent";

const TICKET_ACTION_IDS = new Set([
  "buy_tickets",
  "reserve_spot",
  "official_event_page",
]);

export function trackActionBarExternalAction(action: ActionBarAction): void {
  if (action.kind === "maps") {
    trackEvent("maps_opened", {
      section_type: null,
      metadata: { action_id: action.id },
    });
    return;
  }

  if (action.kind !== "url" || !action.url?.trim()) return;

  const domain = extractDestinationDomain(action.url);
  const isTicket =
    TICKET_ACTION_IDS.has(action.id) || isThirdPartyTicketUrl(action.url);

  trackEvent(isTicket ? "ticket_link_opened" : "external_link_opened", {
    destination_domain: domain,
    metadata: { action_id: action.id },
  });
}

export function trackExternalUrlOpened(
  url: string,
  metadata?: Record<string, unknown>
): void {
  const domain = extractDestinationDomain(url);
  const isTicket = isThirdPartyTicketUrl(url);
  trackEvent(isTicket ? "ticket_link_opened" : "external_link_opened", {
    destination_domain: domain,
    metadata: metadata ?? {},
  });
}
