import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildLocalEventsBody, type LocalEvent } from "./provider.ts";

/** Mirrors app/home.tsx sectionCityMismatch guard (lib/location/locationKey.ts). */
function citiesMatch(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  return Boolean(na && nb && na === nb);
}

function sampleEvent(city: string): LocalEvent {
  return {
    name: "Summer Concert",
    startDateTime: "Jul 18, 2026 · 7:00 PM",
    venue: "Downtown Amphitheater",
    city,
    sourceUrl: "https://example.com/event",
    sourceName: "Eventbrite",
  };
}

function majorityCityFromLocalEventsBody(body: string): string | null {
  const parsed = JSON.parse(body) as { events?: Array<{ city?: string }> };
  const cities = (parsed.events ?? [])
    .map((e) => e.city?.trim())
    .filter(Boolean) as string[];
  if (!cities.length) return null;
  const counts = new Map<string, number>();
  for (const c of cities) {
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [city, n] of counts) {
    if (n > bestN) {
      best = city;
      bestN = n;
    }
  }
  return best;
}

Deno.test("buildLocalEventsBody stamps editionCity on persisted events", () => {
  const body = buildLocalEventsBody(
    [sampleEvent("Phoenix"), sampleEvent("Scottsdale")],
    { editionCity: "Gilbert" }
  );
  const parsed = JSON.parse(body) as { events: Array<{ city: string }> };
  assertEquals(parsed.events.every((e) => e.city === "Gilbert"), true);
});

Deno.test("Gilbert edition local_events body resolves Gilbert as section city", () => {
  const body = buildLocalEventsBody([sampleEvent("Phoenix"), sampleEvent("Phoenix")], {
    editionCity: "Gilbert",
  });
  assertEquals(majorityCityFromLocalEventsBody(body), "Gilbert");
});

Deno.test("Gilbert edition passes home sectionCity guard against Phoenix catalog events", () => {
  const body = buildLocalEventsBody(
    [sampleEvent("Phoenix"), sampleEvent("Scottsdale"), sampleEvent("Phoenix")],
    { editionCity: "Gilbert" }
  );
  const sectionCity = majorityCityFromLocalEventsBody(body);
  const activeCity = "Gilbert";
  assertEquals(sectionCity, "Gilbert");
  assertEquals(citiesMatch(activeCity, sectionCity ?? ""), true);
});

Deno.test("buildLocalEventsBody keeps venue city when editionCity omitted", () => {
  const body = buildLocalEventsBody([sampleEvent("Phoenix")]);
  const parsed = JSON.parse(body) as { events: Array<{ city: string }> };
  assertEquals(parsed.events[0]?.city, "Phoenix");
});
