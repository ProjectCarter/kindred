/**
 * Official website resolution — prefer organizer domains over aggregators.
 * Shared across Local Events, Discovery, Activities, Recommendations, and Bandit's Pick.
 */

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

/** True when URL points at an organizer/venue site — not a ticket marketplace or listing aggregator. */
export function isOfficialProviderUrl(url: string | null | undefined): boolean {
  const href = url?.trim();
  if (!href || !/^https?:\/\//i.test(href)) return false;
  if (isThirdPartyListingUrl(href)) return false;
  if (isThirdPartyTicketUrl(href)) return false;
  return true;
}

/** Pick the first official URL from a list of candidate links. */
export function pickOfficialWebsiteFromUrls(
  urls: Array<string | null | undefined>
): string | null {
  for (const raw of urls) {
    const href = raw?.trim();
    if (href && isOfficialProviderUrl(href)) return href;
  }
  return null;
}

/** Normalize stored official website — omit invalid or third-party URLs. */
export function normalizeOfficialWebsite(
  url: string | null | undefined
): string | null {
  const href = url?.trim();
  if (!href || !isOfficialProviderUrl(href)) return null;
  return href;
}
