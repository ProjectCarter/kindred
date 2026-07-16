import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatTicketmasterSchedule,
  mapTicketmasterCategory,
  parseTicketmasterEvent,
} from "./ticketmasterSearch.ts";

Deno.test("formatTicketmasterSchedule formats local date and time", () => {
  const schedule = formatTicketmasterSchedule("2026-07-18", "19:00:00");
  assertEquals(schedule.startDateIso, "2026-07-18");
  assertEquals(schedule.startDateTime, "Jul 18, 2026 · 7:00 PM");
  assertEquals(schedule.startTimeIso, "19:00:00");
});

Deno.test("mapTicketmasterCategory maps sports and comedy segments", () => {
  assertEquals(
    mapTicketmasterCategory({
      segment: "Sports",
      genre: "Baseball",
      subGenre: "MLB",
      name: "Arizona Diamondbacks vs. San Diego Padres",
      venue: "Chase Field",
    }),
    "sports"
  );
  assertEquals(
    mapTicketmasterCategory({
      segment: "Arts & Theatre",
      genre: "Comedy",
      subGenre: "Stand-up Comedy",
      name: "An Evening with Nate Bargatze",
      venue: "Mortgage Matchup Center",
    }),
    "comedy"
  );
});

Deno.test("parseTicketmasterEvent builds ticket listing with sports category", () => {
  const parsed = parseTicketmasterEvent(
    {
      name: "Phoenix Suns vs. Los Angeles Lakers",
      url: "https://www.ticketmaster.com/phoenix-suns-vs-los-angeles-lakers-tickets/123",
      dates: {
        start: {
          localDate: "2026-10-12",
          localTime: "19:30:00",
          dateTBA: false,
          dateTBD: false,
          timeTBA: false,
          noSpecificTime: false,
        },
        timezone: "America/Phoenix",
      },
      classifications: [
        {
          segment: { name: "Sports" },
          genre: { name: "Basketball" },
          subGenre: { name: "NBA" },
        },
      ],
      _embedded: {
        venues: [
          {
            name: "Mortgage Matchup Center",
            city: { name: "Phoenix" },
            state: { stateCode: "AZ" },
            location: { latitude: "33.4457", longitude: "-112.0712" },
          },
        ],
      },
    },
    "Gilbert"
  );

  assert(parsed);
  assertEquals(parsed!.sourceId, "ticketmaster");
  assertEquals(parsed!.sourceName, "Ticketmaster");
  assertEquals(parsed!.category, "sports");
  assertEquals(parsed!.badges?.includes("tickets_required"), true);
  assert(parsed!.sourceUrl.includes("ticketmaster.com"));
});

Deno.test("parseTicketmasterEvent rejects TBA listings", () => {
  const parsed = parseTicketmasterEvent(
    {
      name: "Mystery Concert",
      url: "https://www.ticketmaster.com/mystery-concert-tickets/999",
      dates: {
        start: {
          dateTBA: true,
        },
      },
    },
    "Gilbert"
  );
  assertEquals(parsed, null);
});
