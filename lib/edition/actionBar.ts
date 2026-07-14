/**
 * Universal Action Bar — resolves actionable next steps from provider data.
 * Never fabricates URLs; only surfaces links Kindred already has.
 */

import type { KindredArticle } from "./article";
import type { DiscoveryCategory, DiscoveryItem } from "./discovery";
import { eventInfoBadgesFor } from "./eventBadges";
import {
  GOOGLE_MAPS_ACTION_LABEL,
  buildGoogleMapsSearchUrl,
  resolveMapsSearchQuery,
} from "./googleMaps";
import type { MapsDestination } from "./googleMaps";
import type { LocalEventCard } from "./localEvents";

export type { MapsDestination } from "./googleMaps";
export { GOOGLE_MAPS_ACTION_LABEL, buildGoogleMapsSearchUrl, resolveMapsSearchQuery } from "./googleMaps";

export type ActionBarActionKind = "url" | "maps" | "phone" | "share" | "save";

export type ActionBarActionId =
  | "buy_tickets"
  | "reserve_spot"
  | "official_event_page"
  | "maps"
  | "website"
  | "menu"
  | "call"
  | "admission"
  | "nps_page"
  | "trail_info"
  | "park_info"
  | "learn_more"
  | "save"
  | "share";

export type ActionBarAction = {
  id: ActionBarActionId;
  label: string;
  icon: string;
  kind: ActionBarActionKind;
  url?: string | null;
  phone?: string | null;
  /** Resolved search text — used for share/dedupe only. */
  mapsQuery?: string | null;
  mapsDestination?: MapsDestination | null;
};

/** Structured context attached to KindredArticle at adapter time. */
export type ActionBarContext = {
  mapsDestination?: MapsDestination | null;
  websiteUrl?: string | null;
  ticketUrl?: string | null;
  phone?: string | null;
  menuUrl?: string | null;
  isFreeEvent?: boolean;
  ticketsRequired?: boolean;
  discoveryCategory?: DiscoveryCategory | string | null;
  tags?: string[];
  surface?: "event" | "activity" | "recommendation" | "bandits_pick";
};

/** @deprecated Use buildGoogleMapsSearchUrl(MapsDestination) from ./googleMaps */
export function buildMapsUrl(query: string): string {
  return buildGoogleMapsSearchUrl({ address: query }) ?? "";
}

export function isThirdPartyListingUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /foursquare\.com/i.test(url);
}

const TICKET_PROVIDER_PATTERN =
  /\b(ticketmaster|eventbrite|axs|dice\.fm|seatgeek|stubhub|universe\.com|tickets\.com|showclix)\b/i;

export function isThirdPartyTicketUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return TICKET_PROVIDER_PATTERN.test(url);
}

export function isOfficialProviderUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  if (isThirdPartyListingUrl(url)) return false;
  if (isThirdPartyTicketUrl(url)) return false;
  return true;
}

/** Split listing URL into ticket vs official website — never duplicate the same third-party link twice. */
export function resolveEventSourceUrls(event: LocalEventCard): {
  ticketUrl: string | null;
  websiteUrl: string | null;
} {
  const listingUrl = event.sourceUrl?.trim() || null;
  if (!listingUrl) return { ticketUrl: null, websiteUrl: null };

  const badges = eventInfoBadgesFor(event);
  const isFree = badges.includes("free");
  const ticketsRequired = badges.includes("tickets_required");
  const ticketProvider = isThirdPartyTicketUrl(listingUrl);
  const official = isOfficialProviderUrl(listingUrl);

  if (ticketsRequired && !isFree) {
    return {
      ticketUrl: listingUrl,
      websiteUrl: ticketProvider ? null : official ? null : null,
    };
  }

  if (official) {
    return { ticketUrl: null, websiteUrl: listingUrl };
  }

  return { ticketUrl: null, websiteUrl: null };
}

function hasVerifiedEventLocation(event: LocalEventCard): boolean {
  const venue = event.venue?.trim();
  if (venue && venue !== "Venue TBA") return true;
  if (event.city?.trim()) return true;
  if (
    typeof event.lat === "number" &&
    Number.isFinite(event.lat) &&
    typeof event.lon === "number" &&
    Number.isFinite(event.lon)
  ) {
    return true;
  }
  return false;
}

/** Event article — discovery stays on cards; decision-making lives in the reader. */
export function resolveEventArticleActions(
  event: LocalEventCard
): ActionBarAction[] {
  const out: ActionBarAction[] = [];
  const seen = new Set<string>();
  const badges = eventInfoBadgesFor(event);
  const isFree = badges.includes("free");
  const ticketsRequired = badges.includes("tickets_required");
  const { ticketUrl, websiteUrl } = resolveEventSourceUrls(event);

  if (ticketsRequired && !isFree && ticketUrl) {
    pushUniqueUrl(
      out,
      {
        id: "buy_tickets",
        label: "Buy Tickets",
        icon: "🎟",
        kind: "url",
        url: ticketUrl,
      },
      seen
    );
  }

  if (hasVerifiedEventLocation(event)) {
    const maps = mapsAction(localEventMapsDestination(event));
    if (maps) {
      pushUniqueUrl(
        out,
        { ...maps, label: "Open in Maps" },
        seen
      );
    }
  }

  const site = websiteAction(websiteUrl, "Official Website");
  if (site) pushUniqueUrl(out, site, seen);

  return out;
}

export function resolveEventArticleActionsFromArticle(
  article: KindredArticle
): ActionBarAction[] {
  const ctx = article.actionContext;
  if (ctx?.surface !== "event") return [];

  const savedPlace = article.savedLocation?.trim() ?? "";
  const placeParts = savedPlace.split(",").map((p) => p.trim()).filter(Boolean);
  const venue = placeParts.length > 1 ? placeParts.slice(0, -1).join(", ") : placeParts[0] ?? "";
  const city = placeParts.length > 1 ? placeParts[placeParts.length - 1] ?? "" : "";

  return resolveEventArticleActions({
    name: article.headline,
    date: "",
    time: "",
    venue,
    city,
    sourceUrl: ctx.ticketUrl ?? ctx.websiteUrl ?? article.sourceUrl ?? "",
    sourceName: article.source,
    lat: ctx.mapsDestination?.lat,
    lon: ctx.mapsDestination?.lon,
    badges: ctx.isFreeEvent
      ? ["free"]
      : ctx.ticketsRequired
        ? ["tickets_required"]
        : undefined,
  });
}

/** @deprecated Homepage cards no longer show actions — use resolveEventArticleActions in the reader. */
export function resolveActionsForLocalEvent(
  event: LocalEventCard,
  options?: { includeSave?: boolean }
): ActionBarAction[] {
  if (options?.includeSave === false) {
    return resolveEventArticleActions(event);
  }
  const out = resolveEventArticleActions(event);
  const seen = new Set(out.map((a) => a.id));
  pushUniqueUrl(out, saveAction(), seen);
  pushUniqueUrl(out, shareAction(), seen);
  return out;
}

function pushUniqueUrl(
  out: ActionBarAction[],
  action: ActionBarAction,
  seen: Set<string>
): void {
  const key =
    action.kind === "url" && action.url
      ? action.url.trim()
      : action.kind === "maps" && action.mapsQuery
        ? `maps:${action.mapsQuery.trim()}`
        : action.kind === "phone" && action.phone
          ? `tel:${action.phone.trim()}`
          : action.id;
  if (action.kind === "url" && action.url && seen.has(action.url.trim())) return;
  if (key) seen.add(key);
  out.push(action);
}

function mapsAction(dest: MapsDestination): ActionBarAction | null {
  const query = resolveMapsSearchQuery(dest);
  const url = buildGoogleMapsSearchUrl(dest);
  if (!query || !url) return null;
  return {
    id: "maps",
    label: GOOGLE_MAPS_ACTION_LABEL,
    icon: "📍",
    kind: "maps",
    mapsQuery: query,
    mapsDestination: dest,
    url,
  };
}

function websiteAction(
  url: string | null | undefined,
  label: string,
  id: ActionBarActionId = "website"
): ActionBarAction | null {
  const href = url?.trim();
  if (!href || !isOfficialProviderUrl(href)) return null;
  return { id, label, icon: "🌐", kind: "url", url: href };
}

function saveAction(): ActionBarAction {
  return {
    id: "save",
    label: "Save to Today's Board",
    icon: "📌",
    kind: "save",
  };
}

function shareAction(): ActionBarAction {
  return {
    id: "share",
    label: "Share",
    icon: "📤",
    kind: "share",
  };
}

function localEventMapsDestination(event: LocalEventCard): MapsDestination {
  return {
    lat: event.lat,
    lon: event.lon,
    name: event.venue?.trim() || event.name?.trim() || null,
    city: event.city?.trim() || null,
  };
}

function discoveryMapsDestination(
  item: DiscoveryItem,
  fallbackCity?: string | null
): MapsDestination {
  return {
    lat: item.lat,
    lon: item.lon,
    address: item.address?.trim() || null,
    name: item.title?.trim() || null,
    city: item.place?.city?.trim() || fallbackCity?.trim() || null,
    region: item.place?.region?.trim() || null,
    state: item.place?.state?.trim() || null,
  };
}

function discoveryWebsiteUrl(item: DiscoveryItem): string | null {
  const url = (item.url ?? item.source?.url)?.trim() || null;
  if (!url || isThirdPartyListingUrl(url)) return null;
  return url;
}

/** Activities desk actions. */
export function resolveActionsForActivity(
  item: DiscoveryItem,
  options?: { fallbackCity?: string | null; includeSave?: boolean }
): ActionBarAction[] {
  const out: ActionBarAction[] = [];
  const seen = new Set<string>();

  const maps = mapsAction(discoveryMapsDestination(item, options?.fallbackCity));
  if (maps) pushUniqueUrl(out, maps, seen);

  const site = websiteAction(discoveryWebsiteUrl(item), "Official Website");
  if (site) pushUniqueUrl(out, site, seen);

  if (options?.includeSave !== false) pushUniqueUrl(out, saveAction(), seen);
  pushUniqueUrl(out, shareAction(), seen);

  return out;
}

/** Recommendations desk — category-aware labels. */
export function resolveActionsForRecommendation(
  item: DiscoveryItem,
  options?: { fallbackCity?: string | null; includeSave?: boolean }
): ActionBarAction[] {
  const out: ActionBarAction[] = [];
  const seen = new Set<string>();
  const category = item.category;
  const isNps = item.tags?.includes("nps_park");
  const websiteUrl = discoveryWebsiteUrl(item);
  const maps = mapsAction(discoveryMapsDestination(item, options?.fallbackCity));

  if (category === "restaurants") {
    if (item.menuUrl?.trim()) {
      pushUniqueUrl(
        out,
        {
          id: "menu",
          label: "View Menu",
          icon: "🍽",
          kind: "url",
          url: item.menuUrl.trim(),
        },
        seen
      );
    }
    if (maps) pushUniqueUrl(out, maps, seen);
    const site = websiteAction(websiteUrl, "Official Website");
    if (site) pushUniqueUrl(out, site, seen);
    if (item.phone?.trim()) {
      pushUniqueUrl(
        out,
        {
          id: "call",
          label: "Call",
          icon: "☎",
          kind: "phone",
          phone: item.phone.trim(),
        },
        seen
      );
    }
  } else if (category === "coffee" || category === "bakeries") {
    if (maps) pushUniqueUrl(out, maps, seen);
    const site = websiteAction(
      websiteUrl,
      category === "coffee" ? "Website" : "Official Website"
    );
    if (site) pushUniqueUrl(out, site, seen);
  } else if (category === "museums") {
    if (websiteUrl && /ticket|admission|visit/i.test(websiteUrl)) {
      pushUniqueUrl(
        out,
        {
          id: "admission",
          label: "Buy Admission",
          icon: "🎟",
          kind: "url",
          url: websiteUrl,
        },
        seen
      );
    }
    if (maps) pushUniqueUrl(out, maps, seen);
    const site = websiteAction(websiteUrl, "Museum Website");
    if (site) pushUniqueUrl(out, site, seen);
  } else if (isNps) {
    if (maps) pushUniqueUrl(out, maps, seen);
    const nps = websiteAction(websiteUrl, "NPS Page", "nps_page");
    if (nps) pushUniqueUrl(out, nps, seen);
    if (websiteUrl && item.category === "hiking") {
      pushUniqueUrl(
        out,
        {
          id: "trail_info",
          label: "Trail Information",
          icon: "🥾",
          kind: "url",
          url: websiteUrl,
        },
        seen
      );
    }
  } else if (category === "parks" || category === "hiking") {
    if (maps) pushUniqueUrl(out, maps, seen);
    const info = websiteAction(
      websiteUrl,
      isNps ? "NPS Page" : "Park Information",
      isNps ? "nps_page" : "park_info"
    );
    if (info) pushUniqueUrl(out, info, seen);
    if (options?.includeSave !== false) pushUniqueUrl(out, saveAction(), seen);
  } else {
    if (maps) pushUniqueUrl(out, maps, seen);
    const site = websiteAction(websiteUrl, "Official Website");
    if (site) pushUniqueUrl(out, site, seen);
  }

  if (category !== "parks" && category !== "hiking" && options?.includeSave !== false) {
    pushUniqueUrl(out, saveAction(), seen);
  }
  pushUniqueUrl(out, shareAction(), seen);

  return out;
}

/** Bandit's Pick — guide toward the one clear next step. */
export function resolveActionsForBanditsPick(input: {
  url?: string | null;
  mapsDestination?: MapsDestination | null;
  includeSave?: boolean;
}): ActionBarAction[] {
  const out: ActionBarAction[] = [];
  const seen = new Set<string>();

  if (input.mapsDestination) {
    const maps = mapsAction(input.mapsDestination);
    if (maps) pushUniqueUrl(out, maps, seen);
  }

  const learn = websiteAction(input.url, "Learn More", "learn_more");
  if (learn) pushUniqueUrl(out, learn, seen);

  if (input.includeSave !== false) pushUniqueUrl(out, saveAction(), seen);
  pushUniqueUrl(out, shareAction(), seen);

  return out;
}

function mapsDestinationFromSavedLocation(
  savedLocation: string | null | undefined
): MapsDestination | null {
  const line = savedLocation?.trim();
  if (!line) return null;
  const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      name: parts.slice(0, -1).join(", "),
      city: parts[parts.length - 1] ?? null,
    };
  }
  return { address: line };
}

/** Practical article actions only — no Pin / Save / Share (those stay in the hero row). */
export function resolveArticleContextActions(
  article: KindredArticle,
  options?: { fallbackCity?: string | null }
): ActionBarAction[] {
  const ctx = article.actionContext;
  let actions: ActionBarAction[];

  if (!ctx) {
    const out: ActionBarAction[] = [];
    const seen = new Set<string>();
    const fallbackDest = mapsDestinationFromSavedLocation(article.savedLocation);
    if (fallbackDest) {
      const maps = mapsAction(fallbackDest);
      if (maps) pushUniqueUrl(out, maps, seen);
    }
    const site = websiteAction(
      article.sourceUrl,
      article.section === "bandits_pick" ? "Learn More" : "Official Website",
      article.section === "bandits_pick" ? "learn_more" : "website"
    );
    if (site) pushUniqueUrl(out, site, seen);
    actions = out;
  } else if (ctx.surface === "event") {
    actions = resolveEventArticleActionsFromArticle(article);
  } else if (ctx.surface === "activity") {
    actions = resolveActionsForActivity(discoveryItemFromContext(article, ctx), {
      fallbackCity: options?.fallbackCity,
      includeSave: false,
    });
  } else if (ctx.surface === "bandits_pick") {
    actions = resolveActionsForBanditsPick({
      url: ctx.websiteUrl ?? article.sourceUrl,
      mapsDestination:
        ctx.mapsDestination ??
        mapsDestinationFromSavedLocation(article.savedLocation),
      includeSave: false,
    });
  } else {
    actions = resolveActionsForRecommendation(
      discoveryItemFromContext(article, ctx),
      { fallbackCity: options?.fallbackCity, includeSave: false }
    );
  }

  return actions
    .filter((a) => a.kind !== "save" && a.kind !== "share")
    .map((a) =>
      a.id === "maps" ? { ...a, label: "Open in Maps" } : a
    );
}

/** Resolve from a KindredArticle + optional stored context. */
export function resolveActionsForArticle(
  article: KindredArticle,
  options?: { fallbackCity?: string | null }
): ActionBarAction[] {
  const ctx = article.actionContext;
  if (!ctx) {
    const out: ActionBarAction[] = [];
    const seen = new Set<string>();
    const fallbackDest = mapsDestinationFromSavedLocation(article.savedLocation);
    if (fallbackDest) {
      const maps = mapsAction(fallbackDest);
      if (maps) pushUniqueUrl(out, maps, seen);
    }
    const site = websiteAction(
      article.sourceUrl,
      article.section === "bandits_pick" ? "Learn More" : "Official Website",
      article.section === "bandits_pick" ? "learn_more" : "website"
    );
    if (site) pushUniqueUrl(out, site, seen);
    pushUniqueUrl(out, saveAction(), seen);
    pushUniqueUrl(out, shareAction(), seen);
    return out;
  }

  if (ctx.surface === "event") {
    return resolveEventArticleActionsFromArticle(article);
  }

  if (ctx.surface === "activity") {
    return resolveActionsForActivity(
      discoveryItemFromContext(article, ctx),
      { fallbackCity: options?.fallbackCity, includeSave: true }
    );
  }

  if (ctx.surface === "bandits_pick") {
    return resolveActionsForBanditsPick({
      url: ctx.websiteUrl ?? article.sourceUrl,
      mapsDestination:
        ctx.mapsDestination ??
        mapsDestinationFromSavedLocation(article.savedLocation),
      includeSave: true,
    });
  }

  return resolveActionsForRecommendation(
    discoveryItemFromContext(article, ctx),
    { fallbackCity: options?.fallbackCity, includeSave: true }
  );
}

function discoveryItemFromContext(
  article: KindredArticle,
  ctx: ActionBarContext
): DiscoveryItem {
  const dest = ctx.mapsDestination;
  return {
    id: article.id,
    title: article.headline,
    dek: article.dek ?? "",
    category: (ctx.discoveryCategory as DiscoveryCategory) ?? "restaurants",
    family: "outdoors",
    source: { name: article.source, tier: "local" },
    url: ctx.websiteUrl ?? article.sourceUrl ?? null,
    address: dest?.address ?? article.savedLocation ?? null,
    lat: dest?.lat ?? null,
    lon: dest?.lon ?? null,
    place: {
      city: dest?.city ?? null,
      region: dest?.region ?? null,
      state: dest?.state ?? null,
    },
    tags: ctx.tags ?? [],
    menuUrl: ctx.menuUrl ?? null,
    phone: ctx.phone ?? null,
  };
}

export function actionContextFromLocalEvent(event: LocalEventCard): ActionBarContext {
  const badges = eventInfoBadgesFor(event);
  const { ticketUrl, websiteUrl } = resolveEventSourceUrls(event);
  return {
    surface: "event",
    mapsDestination: localEventMapsDestination(event),
    websiteUrl,
    ticketUrl,
    isFreeEvent: badges.includes("free"),
    ticketsRequired: badges.includes("tickets_required"),
  };
}

export function actionContextFromDiscoveryItem(
  item: DiscoveryItem,
  surface: "activity" | "recommendation"
): ActionBarContext {
  return {
    surface,
    mapsDestination: discoveryMapsDestination(item),
    websiteUrl: discoveryWebsiteUrl(item) ?? item.url ?? item.source?.url ?? null,
    discoveryCategory: item.category,
    tags: item.tags,
    phone: item.phone ?? null,
    menuUrl: item.menuUrl ?? null,
  };
}

export function actionContextFromBanditsPick(input: {
  url?: string | null;
  mapsDestination?: MapsDestination | null;
  discoveryItem?: DiscoveryItem | null;
}): ActionBarContext {
  const item = input.discoveryItem;
  return {
    surface: "bandits_pick",
    mapsDestination:
      input.mapsDestination ??
      (item ? discoveryMapsDestination(item) : null),
    websiteUrl:
      input.url ??
      (item ? discoveryWebsiteUrl(item) ?? item.url ?? null : null),
    discoveryCategory: item?.category ?? null,
    tags: item?.tags,
  };
}
