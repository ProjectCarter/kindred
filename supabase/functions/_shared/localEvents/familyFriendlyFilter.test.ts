import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessFamilyFriendlyListing,
  filterFamilyFriendlyEvents,
  isFamilyFriendlyEvent,
} from "./familyFriendlyFilter.ts";
import type { LocalEvent } from "./provider.ts";

function event(partial: Partial<LocalEvent> & Pick<LocalEvent, "name">): LocalEvent {
  return {
    startDateTime: "Jul 18, 2026 · 7:00 PM",
    venue: "Venue TBA",
    city: "Phoenix",
    sourceUrl: "https://example.com/event",
    sourceName: "Eventbrite",
    ...partial,
  };
}

Deno.test("assessFamilyFriendlyListing excludes explicit adult entertainment titles", () => {
  const blocked = [
    "BuffBoyzz Male Revue",
    "Male Strippers Live",
    "Exotic Dancers Night",
    "Gentlemen's Club VIP Night",
    "Adult Entertainment Expo 2026",
    "Muscle Men Revue",
    "Adult Bookstore Grand Opening",
    "Adult Arcade Night",
  ];

  for (const name of blocked) {
    const result = assessFamilyFriendlyListing({ name, venue: "Downtown Phoenix" });
    assert(result.excluded, `expected block: ${name}`);
    assertEquals(result.category, "adult_entertainment");
  }
});

Deno.test("assessFamilyFriendlyListing keeps legitimate performances", () => {
  const allowed = [
    {
      name: "Hamilton — Broadway Tour",
      venue: "Gammage Auditorium",
    },
    {
      name: "The Nutcracker Ballet",
      venue: "Phoenix Symphony Hall",
    },
    {
      name: "An Evening with Nate Bargatze",
      venue: "Mortgage Matchup Center",
    },
    {
      name: "Family Drag Story Hour",
      venue: "Phoenix Public Library",
    },
    {
      name: "Community Speed Dating for Singles 30+",
      venue: "Downtown Coffee House",
    },
    {
      name: "Adult Contemporary Night — Live Acoustic Sets",
      venue: "The Van Buren",
    },
    {
      name: "Phoenix Symphony — Beethoven's Ninth",
      venue: "Symphony Hall",
    },
    {
      name: "Desert Botanical Garden Art Exhibit",
      venue: "Desert Botanical Garden",
    },
    {
      name: "Charity Gala Fundraiser for Local Schools",
      venue: "Phoenix Convention Center",
    },
    {
      name: "Phoenix Suns vs. Los Angeles Lakers",
      venue: "Mortgage Matchup Center",
    },
  ];

  for (const row of allowed) {
    const result = assessFamilyFriendlyListing(row);
    assert(!result.excluded, `expected allow: ${row.name}`);
  }
});

Deno.test("assessFamilyFriendlyListing excludes burlesque outside legitimate theatres", () => {
  assert(
    assessFamilyFriendlyListing({
      name: "Late Night Burlesque",
      venue: "Club Noir",
    }).excluded
  );
  assert(
    !assessFamilyFriendlyListing({
      name: "Holiday Burlesque — A Theatrical Revue",
      venue: "Herberger Theater Center",
    }).excluded
  );
});

Deno.test("assessFamilyFriendlyListing excludes hate, scam, and illegal listings", () => {
  const hate = assessFamilyFriendlyListing({
    name: "White Supremacist Rally Downtown",
    venue: "City Plaza",
  });
  assert(hate.excluded);
  assertEquals(hate.category, "hate_extremism");

  const scam = assessFamilyFriendlyListing({
    name: "Free Steak Dinner — Timeshare Presentation",
    venue: "Resort Ballroom",
  });
  assert(scam.excluded);
  assertEquals(scam.category, "scam_fraud");

  const mlm = assessFamilyFriendlyListing({
    name: "MLM Recruiting Opportunity Night",
    venue: "Hotel Conference Room",
  });
  assert(mlm.excluded);
  assertEquals(mlm.category, "scam_fraud");

  const illegal = assessFamilyFriendlyListing({
    name: "Underground Fight Night — Unlicensed",
    venue: "Warehouse District",
  });
  assert(illegal.excluded);
  assertEquals(illegal.category, "violence_illegal");
});

Deno.test("assessFamilyFriendlyListing keeps educational seminars and museum exhibits", () => {
  assert(
    !assessFamilyFriendlyListing({
      name: "Personal Finance Literacy Workshop",
      venue: "Phoenix Public Library",
      description: "Educational community seminar on budgeting",
    }).excluded
  );
  assert(
    !assessFamilyFriendlyListing({
      name: "History Exhibit: Rise of Hate Groups in America",
      venue: "Phoenix Art Museum",
      description: "Educational museum exhibit and panel discussion",
    }).excluded
  );
});

Deno.test("filterFamilyFriendlyEvents removes blocked listings before merge", () => {
  const events = [
    event({ name: "Phoenix Suns vs. Los Angeles Lakers", category: "sports" }),
    event({ name: "Male Revue Saturday Night", venue: "Club Lux" }),
    event({ name: "Get Rich Quick Seminar", venue: "Hotel Ballroom" }),
    event({ name: "Farmers Market Morning", category: "market" }),
  ];

  const result = filterFamilyFriendlyEvents(events);
  assertEquals(result.filteredCount, 2);
  assertEquals(result.kept.length, 2);
  assertEquals(result.samples[0]?.signal, "male revue");
  assertEquals(result.samples[0]?.category, "adult_entertainment");
  assertEquals(result.samples[1]?.category, "scam_fraud");
  assert(!isFamilyFriendlyEvent(events[1]));
});
