/**
 * Official website resolution — client mirror of server editorial policy.
 */

import type { DiscoveryItem } from "./discovery";

const TICKET_PROVIDER_PATTERN =
  /\b(ticketmaster|eventbrite|axs|dice\.fm|seatgeek|stubhub|universe\.com|tickets\.com|showclix|meetup\.com\/events)\b/i;

const THIRD_PARTY_LISTING_PATTERN =
  /\b(foursquare\.com|yelp\.com|tripadvisor\.com|google\.com\/maps)\b/i;

export function isThirdPartyTicketUrl(url: string): boolean {
  const href = url.trim();
  if (!href) return false;
  return TICKET_PROVIDER_PATTERN.test(href);
}

export function isThirdPartyListingUrl(url: string): boolean {
  const href = url.trim();
  if (!href) return false;
  return THIRD_PARTY_LISTING_PATTERN.test(href);
}

export function isOfficialProviderUrl(url: string | null | undefined): boolean {
  const href = url?.trim();
  if (!href || !/^https?:\/\//i.test(href)) return false;
  if (isThirdPartyListingUrl(href)) return false;
  if (isThirdPartyTicketUrl(href)) return false;
  return true;
}

export function pickOfficialWebsiteFromUrls(
  urls: Array<string | null | undefined>
): string | null {
  for (const raw of urls) {
    const href = raw?.trim();
    if (href && isOfficialProviderUrl(href)) return href;
  }
  return null;
}

export function normalizeOfficialWebsite(
  url: string | null | undefined
): string | null {
  const href = url?.trim();
  if (!href || !isOfficialProviderUrl(href)) return null;
  return href;
}

/** Display-safe official website for any discovery desk item. */
export function resolveDiscoveryOfficialWebsite(
  item: Pick<DiscoveryItem, "officialWebsite" | "url" | "source">
): string | null {
  return (
    normalizeOfficialWebsite(item.officialWebsite) ??
    pickOfficialWebsiteFromUrls([item.url, item.source?.url])
  );
}
