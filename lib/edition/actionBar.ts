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
import {
  isOfficialProviderUrl,
  isThirdPartyTicketUrl,
  pickOfficialWebsiteFromUrls,
  resolveDiscoveryOfficialWebsite,
} from "./officialWebsite";
import {
  mapsDestinationFromPlace,
  sanitizeAddressForDisplay,
  verifiedMapsDestination,
} from "./verifiedLocation";

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
  /** Custom maps CTA label for Bandit's Pick features. */
  mapsActionLabel?: string | null;
  discoveryCategory?: DiscoveryCategory | string | null;
  tags?: string[];
  surface?: "event" | "activity" | "recommendation" | "bandits_pick" | "history_around_town";
};

/** @deprecated Use buildGoogleMapsSearchUrl(MapsDestination) from ./googleMaps */
export function buildMapsUrl(query: string): string {
  return buildGoogleMapsSearchUrl({ address: query }) ?? "";
}

export {
  isOfficialProviderUrl,
  isThirdPartyListingUrl,
  isThirdPartyTicketUrl,
} from "./officialWebsite";

/** Split listing URL into ticket vs official website — never duplicate the same third-party link twice. */
export function resolveEventSourceUrls(event: LocalEventCard): {
  ticketUrl: string | null;
  websiteUrl: string | null;
} {
  const listingUrl = event.sourceUrl?.trim() || null;
  const explicitOfficial = event.officialWebsite?.trim() || null;
  if (!listingUrl && !explicitOfficial) {
    return { ticketUrl: null, websiteUrl: null };
  }

  const badges = eventInfoBadgesFor(event);
  const isFree = badges.includes("free");
  const ticketsRequired = badges.includes("tickets_required");
  const ticketProvider = listingUrl ? isThirdPartyTicketUrl(listingUrl) : false;
  const officialFromField =
    explicitOfficial && isOfficialProviderUrl(explicitOfficial)
      ? explicitOfficial
      : null;
  const officialFromListing =
    listingUrl && isOfficialProviderUrl(listingUrl) ? listingUrl : null;

  if (ticketsRequired && !isFree && listingUrl) {
    return {
      ticketUrl: listingUrl,
      websiteUrl: officialFromField ?? (ticketProvider ? null : officialFromListing),
    };
  }

  if (officialFromField) {
    return { ticketUrl: ticketProvider ? listingUrl : null, websiteUrl: officialFromField };
  }

  if (officialFromListing) {
    return { ticketUrl: null, websiteUrl: officialFromListing };
  }

  return { ticketUrl: ticketProvider ? listingUrl : null, websiteUrl: null };
}

function hasVerifiedEventLocation(event: LocalEventCard): boolean {
  return Boolean(localEventMapsDestination(event));
}

/** Event article — Maps, Official Website, then tickets when applicable. */
export function resolveEventArticleActions(
  event: LocalEventCard
): ActionBarAction[] {
  const out: ActionBarAction[] = [];
  const seen = new Set<string>();
  const badges = eventInfoBadgesFor(event);
  const isFree = badges.includes("free");
  const { ticketUrl, websiteUrl } = resolveEventSourceUrls(event);

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

  if (ticketUrl) {
    pushUniqueUrl(
      out,
      {
        id: isFree ? "learn_more" : "buy_tickets",
        label: isFree ? "Learn More" : "Buy Tickets",
        icon: "🎟",
        kind: "url",
        url: ticketUrl,
      },
      seen
    );
  }

  return out;
}

export function resolveEventArticleActionsFromArticle(
  article: KindredArticle
): ActionBarAction[] {
  const ctx = article.actionContext;
  if (ctx?.surface !== "event") return [];

  const dest = ctx.mapsDestination ?? mapsDestinationFromSavedLocation(article.savedLocation);
  const venue = dest?.name?.trim() ?? "";
  const city = dest?.city?.trim() ?? "";

  return resolveEventArticleActions({
    name: article.headline,
    date: "",
    time: "",
    venue,
    city,
    sourceUrl: ctx.ticketUrl ?? article.sourceUrl ?? ctx.websiteUrl ?? "",
    sourceName: article.source,
    officialWebsite: ctx.websiteUrl ?? null,
    lat: dest?.lat,
    lon: dest?.lon,
    badges: ctx.isFreeEvent
      ? ["free"]
      : ctx.ticketsRequired
        ? ["tickets_required"]
        : undefined,
  });
}

const PRACTICAL_LISTING_ACTION_IDS = new Set<ActionBarActionId>([
  "maps",
  "website",
  "buy_tickets",
  "reserve_spot",
  "learn_more",
  "admission",
  "official_event_page",
]);

/** Maps, Official Website, and ticket-style links — no Pin / Save / Share. */
export function filterPracticalListingActions(
  actions: ActionBarAction[]
): ActionBarAction[] {
  return actions.filter(
    (a) =>
      (a.kind === "maps" || a.kind === "url") &&
      PRACTICAL_LISTING_ACTION_IDS.has(a.id)
  );
}

/** Local Events listing — Maps, Official Website, Buy Tickets when applicable. */
export function resolveListingActionsForEvent(
  event: LocalEventCard
): ActionBarAction[] {
  return resolveEventArticleActions(event);
}

/** Activities / Recommendations listing actions from a discovery item. */
export function resolveListingActionsForDiscoveryItem(
  item: DiscoveryItem,
  options?: { fallbackCity?: string | null; surface?: "activity" | "recommendation" }
): ActionBarAction[] {
  const surface =
    options?.surface ??
    (item.category === "activities" ? "activity" : "recommendation");
  const raw =
    surface === "activity"
      ? resolveActionsForActivity(item, {
          fallbackCity: options?.fallbackCity,
          includeSave: false,
        })
      : resolveActionsForRecommendation(item, {
          fallbackCity: options?.fallbackCity,
          includeSave: false,
        });
  return filterPracticalListingActions(raw);
}

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

function mapsAction(dest: MapsDestination | null): ActionBarAction | null {
  const verified = verifiedMapsDestination(dest);
  if (!verified) return null;
  const query = resolveMapsSearchQuery(verified);
  const url = buildGoogleMapsSearchUrl(verified);
  if (!query || !url) return null;
  return {
    id: "maps",
    label: GOOGLE_MAPS_ACTION_LABEL,
    icon: "📍",
    kind: "maps",
    mapsQuery: query,
    mapsDestination: verified,
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
    label: "Save",
    icon: "❤️",
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

function localEventMapsDestination(event: LocalEventCard): MapsDestination | null {
  return mapsDestinationFromPlace({
    lat: event.lat,
    lon: event.lon,
    name: event.venue?.trim() || event.name?.trim() || null,
    city: event.city?.trim() || null,
  });
}

function discoveryMapsDestination(
  item: DiscoveryItem,
  fallbackCity?: string | null
): MapsDestination | null {
  return mapsDestinationFromPlace({
    lat: item.lat,
    lon: item.lon,
    address: item.address,
    name: item.title?.trim() || null,
    city: item.place?.city?.trim() || fallbackCity?.trim() || null,
    region: item.place?.region?.trim() || null,
    state: item.place?.state?.trim() || null,
  });
}

function discoveryWebsiteUrl(item: DiscoveryItem): string | null {
  return resolveDiscoveryOfficialWebsite(item);
}

/** Activities desk actions — Maps, Official Website. */
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

/** Recommendations desk — Maps and Official Website first, then category extras. */
export function resolveActionsForRecommendation(
  item: DiscoveryItem,
  options?: { fallbackCity?: string | null; includeSave?: boolean }
): ActionBarAction[] {
  const out: ActionBarAction[] = [];
  const seen = new Set<string>();
  const category = item.category;
  const websiteUrl = discoveryWebsiteUrl(item);
  const maps = mapsAction(discoveryMapsDestination(item, options?.fallbackCity));

  if (maps) pushUniqueUrl(out, maps, seen);

  const site = websiteAction(websiteUrl, "Official Website");
  if (site) pushUniqueUrl(out, site, seen);

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
  } else if (
    category === "museums" &&
    websiteUrl &&
    /ticket|admission|visit/i.test(websiteUrl) &&
    !seen.has(websiteUrl)
  ) {
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

  if (category !== "parks" && category !== "hiking" && options?.includeSave !== false) {
    pushUniqueUrl(out, saveAction(), seen);
  }
  pushUniqueUrl(out, shareAction(), seen);

  return out;
}

/** Bandit's Pick — Maps, Official Website, and tickets when applicable. */
export function resolveActionsForBanditsPick(input: {
  url?: string | null;
  officialWebsite?: string | null;
  ticketUrl?: string | null;
  mapsDestination?: MapsDestination | null;
  mapsActionLabel?: string | null;
  ticketsRequired?: boolean;
  isFreeEvent?: boolean;
  includeSave?: boolean;
}): ActionBarAction[] {
  const out: ActionBarAction[] = [];
  const seen = new Set<string>();
  const listingUrl = input.url?.trim() || null;
  const ticketUrl =
    input.ticketUrl?.trim() ||
    (listingUrl && isThirdPartyTicketUrl(listingUrl) ? listingUrl : null);

  if (input.mapsDestination) {
    const maps = mapsAction(input.mapsDestination);
    if (maps) {
      pushUniqueUrl(
        out,
        {
          ...maps,
          label: input.mapsActionLabel?.trim() || "Open in Maps",
        },
        seen
      );
    }
  }

  const website = pickOfficialWebsiteFromUrls([
    input.officialWebsite,
    listingUrl && !isThirdPartyTicketUrl(listingUrl) ? listingUrl : null,
  ]);
  const site = websiteAction(website, "Official Website");
  if (site) pushUniqueUrl(out, site, seen);

  if (input.ticketsRequired && !input.isFreeEvent && ticketUrl) {
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
  } else if (ticketUrl && !website && !seen.has(ticketUrl)) {
    pushUniqueUrl(
      out,
      {
        id: "learn_more",
        label: "Learn More",
        icon: "🎟",
        kind: "url",
        url: ticketUrl,
      },
      seen
    );
  }

  return out;
}

function mapsDestinationFromSavedLocation(
  savedLocation: string | null | undefined
): MapsDestination | null {
  const line = savedLocation?.trim();
  if (!line) return null;
  const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return verifiedMapsDestination({
      name: parts.slice(0, -1).join(", "),
      city: parts[parts.length - 1] ?? null,
    });
  }
  const address = sanitizeAddressForDisplay(line);
  if (address) return verifiedMapsDestination({ address });
  return null;
}

/**
 * The standardized detail-page second button — one action directly below Google
 * Maps. Section-specific label, derived only from links Kindred already has
 * (never fabricated). Returns null when no verified link exists (Maps only).
 *
 * - Events: Buy Tickets (filled) when tickets are sold, else Learn More.
 * - Activities: Learn More (official website).
 * - Food & Drinks: View Menu when available, else Visit Website.
 */
export function resolveListingSecondaryButton(
  savedContentType: string | null | undefined,
  actions: ActionBarAction[]
): { label: string; url: string; variant: "primary" | "secondary" } | null {
  const withUrl = (id: ActionBarActionId) =>
    actions.find((a) => a.id === id && a.url?.trim())?.url?.trim() ?? null;

  if (savedContentType === "event") {
    const tickets = withUrl("buy_tickets");
    if (tickets) return { label: "Buy Tickets", url: tickets, variant: "primary" };
    const learn =
      withUrl("learn_more") ?? withUrl("official_event_page") ?? withUrl("website");
    if (learn) return { label: "Learn More", url: learn, variant: "secondary" };
    return null;
  }

  if (savedContentType === "activity") {
    const site = withUrl("website") ?? withUrl("learn_more");
    if (site) return { label: "Learn More", url: site, variant: "secondary" };
    return null;
  }

  // Food & Drinks (recommendation) and any other place listing.
  const menu = withUrl("menu");
  if (menu) return { label: "View Menu", url: menu, variant: "secondary" };
  const site = withUrl("website");
  if (site) return { label: "Visit Website", url: site, variant: "secondary" };
  return null;
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
      pickOfficialWebsiteFromUrls([article.sourceUrl]),
      "Official Website"
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
      url: article.sourceUrl ?? ctx.websiteUrl,
      officialWebsite: ctx.websiteUrl,
      ticketUrl: ctx.ticketUrl,
      mapsDestination:
        ctx.mapsDestination ??
        mapsDestinationFromSavedLocation(article.savedLocation),
      mapsActionLabel: ctx.mapsActionLabel,
      ticketsRequired: ctx.ticketsRequired,
      isFreeEvent: ctx.isFreeEvent,
      includeSave: false,
    });
  } else if (ctx.surface === "history_around_town") {
    actions = resolveActionsForHistoryPlace({
      mapsDestination:
        ctx.mapsDestination ??
        mapsDestinationFromSavedLocation(article.savedLocation),
      websiteUrl: ctx.websiteUrl ?? article.sourceUrl,
      admissionUrl: ctx.ticketUrl,
      googleMapsUrl: article.historyPlaceSnapshot?.googleMapsUrl ?? null,
    });
  } else {
    actions = resolveActionsForRecommendation(
      discoveryItemFromContext(article, ctx),
      { fallbackCity: options?.fallbackCity, includeSave: false }
    );
  }

  return filterPracticalListingActions(
    actions.map((a) =>
      a.id === "maps" && ctx?.mapsActionLabel?.trim()
        ? { ...a, label: ctx.mapsActionLabel.trim() }
        : a.id === "maps"
          ? { ...a, label: "Open in Maps" }
          : a
    )
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
      pickOfficialWebsiteFromUrls([article.sourceUrl]),
      "Official Website"
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
      officialWebsite: ctx.websiteUrl,
      mapsDestination:
        ctx.mapsDestination ??
        mapsDestinationFromSavedLocation(article.savedLocation),
      includeSave: true,
    });
  }

  if (ctx.surface === "history_around_town") {
    const out = resolveActionsForHistoryPlace({
      mapsDestination:
        ctx.mapsDestination ??
        mapsDestinationFromSavedLocation(article.savedLocation),
      websiteUrl: ctx.websiteUrl ?? article.sourceUrl,
      admissionUrl: ctx.ticketUrl,
      googleMapsUrl: article.historyPlaceSnapshot?.googleMapsUrl ?? null,
    });
    const seen = new Set(out.map((a) => a.id));
    pushUniqueUrl(out, saveAction(), seen);
    pushUniqueUrl(out, shareAction(), seen);
    return out;
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
    officialWebsite: ctx.websiteUrl ?? null,
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
    websiteUrl: discoveryWebsiteUrl(item) ?? item.officialWebsite ?? item.url ?? item.source?.url ?? null,
    discoveryCategory: item.category,
    tags: item.tags,
    phone: item.phone ?? null,
    menuUrl: item.menuUrl ?? null,
  };
}

/** History Around Town — Maps, Official Website, admission when verified. */
export function resolveActionsForHistoryPlace(input: {
  mapsDestination?: MapsDestination | null;
  websiteUrl?: string | null;
  admissionUrl?: string | null;
  googleMapsUrl?: string | null;
}): ActionBarAction[] {
  const out: ActionBarAction[] = [];
  const seen = new Set<string>();

  const maps = mapsAction(
    verifiedMapsDestination(input.mapsDestination) ??
      (input.googleMapsUrl?.trim()
        ? null
        : input.mapsDestination ?? null)
  );
  if (maps) pushUniqueUrl(out, maps, seen);

  if (input.googleMapsUrl?.trim() && isOfficialProviderUrl(input.googleMapsUrl.trim())) {
    pushUniqueUrl(
      out,
      {
        id: "maps",
        label: GOOGLE_MAPS_ACTION_LABEL,
        icon: "📍",
        kind: "url",
        url: input.googleMapsUrl.trim(),
      },
      seen
    );
  }

  const site = websiteAction(input.websiteUrl, "Official Website");
  if (site) pushUniqueUrl(out, site, seen);

  const admission = websiteAction(
    input.admissionUrl,
    "Tickets or Admission",
    "admission"
  );
  if (admission && !seen.has(admission.url?.trim() ?? "")) {
    pushUniqueUrl(out, { ...admission, icon: "🎟" }, seen);
  }

  return out;
}

export function actionContextFromHistoryPlace(
  place: import("./historyAroundTown/types").HistoryPlaceSnapshot
): ActionBarContext {
  return {
    surface: "history_around_town",
    mapsDestination:
      place.lat != null && place.lon != null
        ? {
            lat: place.lat,
            lon: place.lon,
            name: place.placeName,
            city: place.city,
            state: place.state,
            address: place.address,
          }
        : place.address
          ? {
              address: place.address,
              name: place.placeName,
              city: place.city,
              state: place.state,
            }
          : null,
    websiteUrl: place.officialWebsite,
    ticketUrl: place.admissionUrl,
    phone: place.phone,
  };
}

export function actionContextFromBanditsPick(input: {
  url?: string | null;
  mapsQuery?: string | null;
  mapsDestination?: MapsDestination | null;
  actionLabel?: string | null;
  fallbackCity?: string | null;
  discoveryItem?: DiscoveryItem | null;
}): ActionBarContext {
  const item = input.discoveryItem;
  const city = input.fallbackCity?.trim();
  const query = input.mapsQuery?.trim();
  const mapsDestination =
    verifiedMapsDestination(
      input.mapsDestination ??
        (item ? discoveryMapsDestination(item, city) : null) ??
        (query
          ? verifiedMapsDestination({
              address: city ? `${query} near ${city}` : query,
            })
          : null)
    ) ?? null;

  const listingUrl = input.url?.trim() || item?.url?.trim() || null;
  const officialWebsite =
    (item ? resolveDiscoveryOfficialWebsite(item) : null) ??
    (listingUrl && isOfficialProviderUrl(listingUrl) ? listingUrl : null);

  return {
    surface: "bandits_pick",
    mapsDestination,
    mapsActionLabel: input.actionLabel?.trim() || null,
    websiteUrl: officialWebsite,
    ticketUrl:
      listingUrl && isThirdPartyTicketUrl(listingUrl) ? listingUrl : null,
    discoveryCategory: item?.category ?? null,
    tags: item?.tags,
  };
}
