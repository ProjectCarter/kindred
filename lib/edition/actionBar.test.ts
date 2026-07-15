import {
  resolveActionsForActivity,
  resolveActionsForBanditsPick,
  resolveActionsForLocalEvent,
  resolveActionsForRecommendation,
  resolveArticleContextActions,
  resolveEventArticleActions,
  resolveEventSourceUrls,
  buildMapsUrl,
  isThirdPartyListingUrl,
  isThirdPartyTicketUrl,
  GOOGLE_MAPS_ACTION_LABEL,
} from "./actionBar";
import { buildGoogleMapsSearchUrl } from "./googleMaps";
import { articleFromLocalEvent } from "./article";
import type { DiscoveryItem } from "./discovery";
import type { LocalEventCard } from "./localEvents";

function paidEvent(): LocalEventCard {
  return {
    name: "Summer Concert Series",
    date: "Sat, Jul 18",
    time: "7 PM",
    venue: "Desert Botanical Garden",
    city: "Phoenix",
    sourceUrl: "https://example.com/tickets/concert",
    sourceName: "Eventbrite",
    badges: ["tickets_required"],
  };
}

function freeEvent(): LocalEventCard {
  return {
    name: "Community Yoga in the Park",
    date: "Sun, Jul 19",
    time: "8 AM",
    venue: "Freestone Park",
    city: "Gilbert",
    sourceUrl: "https://example.com/events/yoga",
    sourceName: "City of Gilbert",
    badges: ["free"],
  };
}

function restaurantItem(): DiscoveryItem {
  return {
    id: "rec_rest_1",
    title: "The Neighbor's Table",
    dek: "A neighborhood dinner worth planning around.",
    category: "restaurants",
    family: "food_drink",
    source: { name: "Foursquare", tier: "local" },
    url: "https://www.neighborstable.example/menu",
    address: "123 Main St, Gilbert, AZ",
    phone: "+14805551234",
    menuUrl: "https://www.neighborstable.example/menu",
    tags: ["local_place", "verified"],
  };
}

function coffeeItem(): DiscoveryItem {
  return {
    id: "rec_coffee_1",
    title: "Joe's Coffee",
    dek: "A quiet corner for a slow morning.",
    category: "coffee",
    family: "food_drink",
    source: { name: "Foursquare", tier: "local" },
    url: "https://foursquare.com/v/joes-coffee/abc",
    address: "45 Oak Ave, Gilbert, AZ",
    tags: ["local_place", "verified"],
  };
}

function museumItem(): DiscoveryItem {
  return {
    id: "rec_museum_1",
    title: "Arizona Museum of Natural History",
    dek: "Dinosaurs, desert history, and a cool afternoon indoors.",
    category: "museums",
    family: "culture_leisure",
    source: { name: "Kindred", tier: "guide" },
    url: "https://www.arizonamuseumofnaturalhistory.org/visit",
    address: "53 N Macdonald, Mesa, AZ",
    tags: ["verified"],
  };
}

function npsParkItem(): DiscoveryItem {
  return {
    id: "nps_yose",
    title: "Yosemite National Park",
    dek: "Granite cliffs and glacier-carved valleys.",
    category: "hiking",
    family: "outdoors",
    source: {
      name: "National Park Service",
      tier: "guide",
      url: "https://www.nps.gov/yose/index.htm",
    },
    url: "https://www.nps.gov/yose/index.htm",
    place: { city: null, state: "CA" },
    tags: ["nps_park", "outdoors", "verified"],
  };
}

describe("Universal Action Bar", () => {
  it("Eventbrite event without tickets_required badge still surfaces Buy Tickets on article", () => {
    const event: LocalEventCard = {
      name: "Live Jazz at The Nash",
      date: "Fri, Jul 17",
      time: "8 PM",
      venue: "The Nash",
      city: "Phoenix",
      sourceUrl: "https://www.eventbrite.com/e/live-jazz-at-the-nash-123456789",
      sourceName: "Eventbrite",
      lat: 33.4484,
      lon: -112.074,
    };
    const actions = resolveEventArticleActions(event);
    expect(actions.map((a) => a.label)).toEqual(["Open in Maps", "Buy Tickets"]);
    expect(actions.some((a) => a.label === "Official Website")).toBe(false);

    const article = articleFromLocalEvent(event);
    const articleActions = resolveArticleContextActions(article);
    expect(articleActions.map((a) => a.label)).toEqual([
      "Open in Maps",
      "Buy Tickets",
    ]);
  });

  it("Eventbrite event with official venue website shows all three article actions", () => {
    const event: LocalEventCard = {
      name: "Live Jazz at The Nash",
      date: "Fri, Jul 17",
      time: "8 PM",
      venue: "The Nash",
      city: "Phoenix",
      sourceUrl: "https://www.eventbrite.com/e/live-jazz-at-the-nash-123456789",
      sourceName: "Eventbrite",
      officialWebsite: "https://www.thenash.org/events",
      lat: 33.4484,
      lon: -112.074,
    };
    const actions = resolveEventArticleActions(event);
    expect(actions.map((a) => a.label)).toEqual([
      "Open in Maps",
      "Official Website",
      "Buy Tickets",
    ]);
    expect(actions.find((a) => a.id === "website")?.url).toBe(
      "https://www.thenash.org/events"
    );
    expect(actions.find((a) => a.id === "buy_tickets")?.url).toContain(
      "eventbrite.com"
    );
  });

  it("free Eventbrite event without tickets_required badge surfaces Learn More", () => {
    const event: LocalEventCard = {
      name: "Community Open Mic",
      date: "Sat, Jul 18",
      time: "6 PM",
      venue: "Gilbert Library",
      city: "Gilbert",
      sourceUrl: "https://www.eventbrite.com/e/community-open-mic-987654321",
      sourceName: "Eventbrite",
      badges: ["free"],
      lat: 33.3528,
      lon: -111.789,
    };
    const actions = resolveEventArticleActions(event);
    expect(actions.map((a) => a.label)).toEqual(["Open in Maps", "Learn More"]);
  });

  it("paid event article surfaces Open in Maps, Official Website, then Buy Tickets", () => {
    const event: LocalEventCard = {
      ...paidEvent(),
      sourceUrl: "https://www.eventbrite.com/e/summer-concert-123",
      sourceName: "Eventbrite",
      officialWebsite: "https://www.desertbotanical.org/events",
      lat: 33.4617,
      lon: -111.9446,
    };
    const actions = resolveEventArticleActions(event);
    expect(actions.map((a) => a.label)).toEqual([
      "Open in Maps",
      "Official Website",
      "Buy Tickets",
    ]);
  });

  it("paid event without official website surfaces Buy Tickets only when location is unverified", () => {
    const actions = resolveEventArticleActions(paidEvent());
    expect(actions.map((a) => a.label)).toEqual(["Buy Tickets"]);
    expect(actions.some((a) => a.label === "Share")).toBe(false);
  });

  it("event with coordinates builds a coordinate Google Maps URL", () => {
    const event: LocalEventCard = {
      ...paidEvent(),
      lat: 33.4617,
      lon: -111.9446,
    };
    const actions = resolveEventArticleActions(event);
    const maps = actions.find((a) => a.id === "maps");
    expect(maps?.label).toBe("Open in Maps");
    expect(maps?.url).toContain("33.4617");
    expect(maps?.url).toContain("-111.9446");
    expect(maps?.url).toContain("google.com/maps/search");
  });

  it("free official event surfaces Official Website instead of Buy Tickets", () => {
    const actions = resolveEventArticleActions(freeEvent());
    expect(actions.some((a) => a.label === "Official Website")).toBe(true);
    expect(actions.some((a) => a.label === "Buy Tickets")).toBe(false);
    expect(actions.some((a) => a.label === "Reserve Spot")).toBe(false);
  });

  it("ticket provider URL is used for tickets, not as official website", () => {
    const urls = resolveEventSourceUrls({
      ...paidEvent(),
      sourceUrl: "https://www.eventbrite.com/e/summer-concert-123",
      sourceName: "Eventbrite",
    });
    expect(urls.ticketUrl).toContain("eventbrite.com");
    expect(urls.websiteUrl).toBeNull();
    expect(isThirdPartyTicketUrl(urls.ticketUrl)).toBe(true);
  });

  it("explicit officialWebsite appears beneath Open in Maps for ticketed listings", () => {
    const event: LocalEventCard = {
      ...paidEvent(),
      sourceUrl: "https://www.eventbrite.com/e/summer-concert-123",
      sourceName: "Eventbrite",
      officialWebsite: "https://www.desertbotanical.org/events",
      lat: 33.4617,
      lon: -111.9446,
    };
    const actions = resolveEventArticleActions(event);
    expect(actions.map((a) => a.label)).toEqual([
      "Open in Maps",
      "Official Website",
      "Buy Tickets",
    ]);
    expect(actions.find((a) => a.id === "website")?.url).toBe(
      "https://www.desertbotanical.org/events"
    );
  });

  it("legacy resolveActionsForLocalEvent with includeSave adds save and share", () => {
    const actions = resolveActionsForLocalEvent(paidEvent());
    expect(actions.some((a) => a.label === "Share")).toBe(true);
    expect(actions.some((a) => a.label === "Save to Today's Board")).toBe(true);
  });

  it("article context actions omit save and share", () => {
    const article = articleFromLocalEvent(paidEvent());
    const actions = resolveArticleContextActions(article);
    expect(actions.some((a) => a.kind === "save")).toBe(false);
    expect(actions.some((a) => a.kind === "share")).toBe(false);
    expect(actions.some((a) => a.label === "Buy Tickets")).toBe(true);
    expect(actions.some((a) => a.label === "Open in Maps")).toBe(true);
  });

  it("restaurant surfaces Maps, Official Website, menu, and call when provider data exists", () => {
    const actions = resolveActionsForRecommendation(restaurantItem(), {
      includeSave: false,
    });
    expect(actions.map((a) => a.label)).toEqual(
      expect.arrayContaining([
        GOOGLE_MAPS_ACTION_LABEL,
        "Official Website",
        "View Menu",
        "Call",
        "Share",
      ])
    );
    const maps = actions.find((a) => a.id === "maps");
    expect(maps?.url).toContain(encodeURIComponent("123 Main St, Gilbert, AZ"));
  });

  it("coffee shop surfaces Google Maps but skips third-party Foursquare listing as official website", () => {
    const actions = resolveActionsForRecommendation(coffeeItem(), {
      includeSave: false,
    });
    expect(actions.some((a) => a.label === GOOGLE_MAPS_ACTION_LABEL)).toBe(true);
    expect(actions.some((a) => a.label === "Official Website")).toBe(false);
    expect(isThirdPartyListingUrl(coffeeItem().url)).toBe(true);
  });

  it("discovery item with explicit officialWebsite surfaces Official Website", () => {
    const item: DiscoveryItem = {
      ...coffeeItem(),
      url: "https://foursquare.com/v/joes-coffee/abc",
      officialWebsite: "https://www.joescoffee.example",
    };
    const actions = resolveActionsForActivity(item, { includeSave: false });
    expect(actions.some((a) => a.label === "Official Website")).toBe(true);
    expect(
      actions.find((a) => a.id === "website")?.url
    ).toBe("https://www.joescoffee.example");
  });

  it("museum surfaces Official Website and Google Maps", () => {
    const actions = resolveActionsForRecommendation(museumItem(), {
      includeSave: false,
    });
    expect(actions.some((a) => a.label === "Official Website")).toBe(true);
    expect(actions.some((a) => a.label === GOOGLE_MAPS_ACTION_LABEL)).toBe(true);
  });

  it("national park surfaces Official Website and Google Maps", () => {
    const actions = resolveActionsForRecommendation(npsParkItem(), {
      includeSave: false,
    });
    expect(actions.some((a) => a.label === "Official Website")).toBe(true);
    expect(actions.some((a) => a.label === GOOGLE_MAPS_ACTION_LABEL)).toBe(true);
    const maps = actions.find((a) => a.id === "maps");
    expect(maps?.url).toContain(encodeURIComponent("Yosemite National Park, CA"));
  });

  it("activity surfaces Google Maps for verified venues without fabricating menu or call", () => {
    const item: DiscoveryItem = {
      ...coffeeItem(),
      id: "act_bowl_1",
      title: "Main Event Gilbert",
      category: "activities",
      venueCategories: ["Bowling Alley"],
    };
    const actions = resolveActionsForActivity(item, { includeSave: false });
    expect(actions.some((a) => a.label === GOOGLE_MAPS_ACTION_LABEL)).toBe(true);
    expect(actions.some((a) => a.label === "View Menu")).toBe(false);
    expect(actions.some((a) => a.label === "Call")).toBe(false);
  });

  it("Bandit's Pick surfaces Official Website and Open in Maps when URLs exist", () => {
    const actions = resolveActionsForBanditsPick({
      url: "https://www.nps.gov/yose/planyourvisit/trails.htm",
      mapsDestination: {
        name: "Yosemite National Park",
        state: "CA",
      },
      includeSave: false,
    });
    expect(actions.some((a) => a.label === "Official Website")).toBe(true);
    expect(actions.some((a) => a.label === GOOGLE_MAPS_ACTION_LABEL)).toBe(true);
    expect(buildMapsUrl("Yosemite National Park, CA")).toContain(
      "google.com/maps/search"
    );
    expect(
      buildGoogleMapsSearchUrl({ name: "Yosemite National Park", state: "CA" })
    ).not.toContain("maps.apple.com");
  });
});
