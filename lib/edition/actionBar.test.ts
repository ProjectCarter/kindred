import {
  resolveActionsForActivity,
  resolveActionsForBanditsPick,
  resolveActionsForLocalEvent,
  resolveActionsForRecommendation,
  buildMapsUrl,
  isThirdPartyListingUrl,
  GOOGLE_MAPS_ACTION_LABEL,
} from "./actionBar";
import { buildGoogleMapsSearchUrl } from "./googleMaps";
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
  it("paid event surfaces Buy Tickets and Google Maps, not fabricated links", () => {
    const actions = resolveActionsForLocalEvent(paidEvent(), { includeSave: false });
    expect(actions.some((a) => a.label === "Buy Tickets")).toBe(true);
    expect(actions.some((a) => a.label === GOOGLE_MAPS_ACTION_LABEL)).toBe(true);
    expect(actions.some((a) => a.label === "Share")).toBe(true);
    expect(actions.some((a) => a.label === "Reserve Spot")).toBe(false);
  });

  it("event with coordinates builds a coordinate Google Maps URL", () => {
    const event: LocalEventCard = {
      ...paidEvent(),
      lat: 33.4617,
      lon: -111.9446,
    };
    const actions = resolveActionsForLocalEvent(event, { includeSave: false });
    const maps = actions.find((a) => a.id === "maps");
    expect(maps?.label).toBe(GOOGLE_MAPS_ACTION_LABEL);
    expect(maps?.url).toContain("33.4617");
    expect(maps?.url).toContain("-111.9446");
    expect(maps?.url).toContain("google.com/maps/search");
  });

  it("free event surfaces Reserve Spot instead of Buy Tickets", () => {
    const actions = resolveActionsForLocalEvent(freeEvent(), { includeSave: false });
    expect(actions.some((a) => a.label === "Reserve Spot")).toBe(true);
    expect(actions.some((a) => a.label === "Buy Tickets")).toBe(false);
  });

  it("restaurant surfaces menu, Google Maps, website, and call when provider data exists", () => {
    const actions = resolveActionsForRecommendation(restaurantItem(), {
      includeSave: false,
    });
    expect(actions.map((a) => a.label)).toEqual(
      expect.arrayContaining([
        "View Menu",
        GOOGLE_MAPS_ACTION_LABEL,
        "Official Website",
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
    expect(actions.some((a) => a.label === "Website")).toBe(false);
    expect(isThirdPartyListingUrl(coffeeItem().url)).toBe(true);
  });

  it("museum surfaces museum website and Google Maps", () => {
    const actions = resolveActionsForRecommendation(museumItem(), {
      includeSave: false,
    });
    expect(actions.some((a) => a.label === "Museum Website")).toBe(true);
    expect(actions.some((a) => a.label === GOOGLE_MAPS_ACTION_LABEL)).toBe(true);
  });

  it("national park surfaces NPS page and Google Maps", () => {
    const actions = resolveActionsForRecommendation(npsParkItem(), {
      includeSave: false,
    });
    expect(actions.some((a) => a.label === "NPS Page")).toBe(true);
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

  it("Bandit's Pick surfaces Learn More and Google Maps when URLs exist", () => {
    const actions = resolveActionsForBanditsPick({
      url: "https://www.nps.gov/yose/planyourvisit/trails.htm",
      mapsDestination: {
        name: "Yosemite National Park",
        state: "CA",
      },
      includeSave: false,
    });
    expect(actions.some((a) => a.label === "Learn More")).toBe(true);
    expect(actions.some((a) => a.label === GOOGLE_MAPS_ACTION_LABEL)).toBe(true);
    expect(buildMapsUrl("Yosemite National Park, CA")).toContain(
      "google.com/maps/search"
    );
    expect(
      buildGoogleMapsSearchUrl({ name: "Yosemite National Park", state: "CA" })
    ).not.toContain("maps.apple.com");
  });
});
