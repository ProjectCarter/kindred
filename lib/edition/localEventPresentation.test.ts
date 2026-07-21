import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLocalEventPresentation,
  composeNewspaperHeadline,
  isLowQualityEditorialHeadline,
  isUnusableVenueString,
  resolveEventCityLabel,
  resolveLocalEventDisplayCategory,
  sanitizeEventVenueName,
} from "./localEventPresentation.ts";
import type { LocalEventCard } from "./localEvents.ts";

function card(overrides: Partial<LocalEventCard> & Pick<LocalEventCard, "name">): LocalEventCard {
  return {
    date: "Jul 25, 2026",
    time: "7:00 PM",
    venue: "Test Venue",
    city: "Gilbert",
    sourceUrl: "https://www.eventbrite.com/e/example",
    sourceName: "Eventbrite",
    ...overrides,
  };
}

const GILBERT_EDITION_EVENTS: Array<Partial<LocalEventCard> & Pick<LocalEventCard, "name">> = [
  {
    name: "Live Music in Ocotillo Chandler Arizona featuring Joannah Zamora at The Casual Pint of Ocotillo",
    venue: "The Casual Pint of Ocotillo",
    city: "Gilbert",
    category: "music",
    editorialHeadline: "Chandler concert listing",
  },
  {
    name: "CHANDLER GHOST WALK",
    venue: "Mic Drop Comedy",
    city: "Gilbert",
    category: "comedy",
    editorialHeadline: "Mic Drop Comedy hosts a verified theater performance",
  },
  {
    name: "Mesa Night Market (Free Event) - Asian Food Festival",
    venue: "Parking Lot of 1920 W Broadway Rd Mesa AZ 85202",
    city: "Gilbert",
    category: "food",
    editorialHeadline: "Parking Lot of 1920 W Broadway Rd Mesa AZ 85202 on the Mesa calendar",
  },
  {
    name: "FREE ALL STAR NIGHT at Mic Drop Chandler AZ",
    venue: "Mic Drop MANIA Comedy Club",
    city: "Gilbert",
    category: "comedy",
    editorialHeadline: "Mic Drop MANIA Comedy Club hosts a verified theater performance",
  },
  {
    name: "DRAWING with M.A.R.C.U.S. Art",
    venue: "Phoenix Center for the Arts",
    city: "Gilbert",
    category: "arts",
    editorialHeadline: "Theater Performance at Phoenix Center for the Arts",
  },
  {
    name: "Train to Inspire & Influence 1 Day Workshop in Chandler, AZ",
    venue: "For venue details reach us @ events@skelora.com",
    city: "Gilbert",
    category: "arts",
    editorialHeadline:
      "For venue details reach us @ events@skelora.com hosts a verified workshop / class",
  },
];

test("flags scraped and template headlines", () => {
  assert.equal(
    isLowQualityEditorialHeadline("Chandler concert listing", {
      name: "Live Music",
      venue: "The Casual Pint of Ocotillo",
    }),
    true
  );
  assert.equal(
    isLowQualityEditorialHeadline(
      "Parking Lot of 1920 W Broadway Rd Mesa AZ 85202 on the Mesa calendar",
      { name: "Mesa Night Market", venue: "Parking Lot of 1920 W Broadway Rd Mesa AZ 85202" }
    ),
    true
  );
});

test("polishes Gilbert edition local events for newspaper presentation", () => {
  for (const raw of GILBERT_EDITION_EVENTS) {
    const polished = applyLocalEventPresentation(card(raw));
    assert.ok(
      !isLowQualityEditorialHeadline(polished.editorialHeadline ?? "", polished),
      `headline still low quality: ${polished.editorialHeadline}`
    );
    assert.ok(!/@/.test(polished.editorialHeadline ?? ""), "headline contains email");
    assert.ok(!/\b85202\b/.test(polished.editorialHeadline ?? ""), "headline contains address");
    assert.ok(polished.city !== "Gilbert" || /gilbert/i.test(raw.name ?? ""), `${raw.name} city should not default to Gilbert`);
    if (polished.venue) {
      assert.ok(!isUnusableVenueString(polished.venue), `venue still unusable: ${polished.venue}`);
    }
  }

  const music = applyLocalEventPresentation(card(GILBERT_EDITION_EVENTS[0]!));
  assert.match(music.editorialHeadline ?? "", /Joannah Zamora at The Casual Pint/i);
  assert.equal(music.city, "Chandler");
  assert.equal(music.category, "music");

  const ghostWalk = applyLocalEventPresentation(card(GILBERT_EDITION_EVENTS[1]!));
  assert.match(ghostWalk.editorialHeadline ?? "", /Chandler Ghost Walk/i);
  assert.equal(ghostWalk.category, "community");

  const nightMarket = applyLocalEventPresentation(card(GILBERT_EDITION_EVENTS[2]!));
  assert.match(nightMarket.editorialHeadline ?? "", /Mesa Night Market/i);
  assert.equal(nightMarket.venue, "Mesa Night Market");
  assert.equal(nightMarket.city, "Mesa");
  assert.equal(nightMarket.category, "market");

  const comedyNight = applyLocalEventPresentation(card(GILBERT_EDITION_EVENTS[3]!));
  assert.match(comedyNight.editorialHeadline ?? "", /Free All Star Night at Mic Drop Comedy/i);
  assert.equal(comedyNight.venue, "Mic Drop Comedy");
  assert.equal(comedyNight.city, "Chandler");

  const drawing = applyLocalEventPresentation(card(GILBERT_EDITION_EVENTS[4]!));
  assert.match(drawing.editorialHeadline ?? "", /Drawing Workshop With M\.A\.R\.C\.U\.S\. Art at Phoenix Center for the Arts/i);
  assert.equal(drawing.city, "Phoenix");
  assert.equal(drawing.category, "arts");

  const workshop = applyLocalEventPresentation(card(GILBERT_EDITION_EVENTS[5]!));
  assert.match(workshop.editorialHeadline ?? "", /Train to Inspire/i);
  assert.equal(workshop.venue, "");
  assert.equal(workshop.city, "Chandler");
  assert.equal(workshop.category, "community");
});

test("composeNewspaperHeadline stays within editorial length bounds", () => {
  for (const raw of GILBERT_EDITION_EVENTS) {
    const headline = composeNewspaperHeadline(card(raw));
    assert.ok(headline.length >= 12);
    assert.ok(headline.length <= 90);
  }
});

test("sanitizeEventVenueName removes address and email metadata", () => {
  assert.equal(
    sanitizeEventVenueName("Parking Lot of 1920 W Broadway Rd Mesa AZ 85202", "Mesa Night Market"),
    "Mesa Night Market"
  );
  assert.equal(
    sanitizeEventVenueName("For venue details reach us @ events@skelora.com", "Workshop in Chandler"),
    ""
  );
  assert.equal(
    sanitizeEventVenueName("Mic Drop MANIA Comedy Club", "Free All Star Night"),
    "Mic Drop Comedy"
  );
});

test("resolveEventCityLabel prefers verified city signals in title and venue", () => {
  assert.equal(resolveEventCityLabel("Ghost Walk in Chandler", "Mic Drop Comedy", "Gilbert"), "Chandler");
  assert.equal(
    resolveEventCityLabel("Drawing class", "Phoenix Center for the Arts", "Gilbert"),
    "Phoenix"
  );
});

test("resolveLocalEventDisplayCategory corrects miscategorized listings", () => {
  assert.equal(
    resolveLocalEventDisplayCategory("CHANDLER GHOST WALK", "Mic Drop Comedy", "comedy"),
    "community"
  );
  assert.equal(
    resolveLocalEventDisplayCategory("Mesa Night Market - Asian Food Festival", "Parking Lot", "food"),
    "market"
  );
});
