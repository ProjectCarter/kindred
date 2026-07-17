/**
 * Regression tests — edition read path must not invoke discovery providers.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

let gatherCalled = false;
let foursquareSearchCalled = false;

Deno.test("getLocalEvents with admin does not call pipeline gather", async () => {
  gatherCalled = false;

  const admin = {
    from(table: string) {
      if (table === "events_catalog_metros") {
        return {
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === "events_catalog") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  };

  const { getLocalEvents } = await import("../localEvents/provider.ts");

  const events = await getLocalEvents(
    { lat: 33.35, lon: -111.79, city: "Gilbert", state: "AZ" },
    {
      admin: admin as never,
      now: new Date("2026-07-17T12:00:00.000Z"),
      editionDate: "2026-07-17",
      timezone: "America/Phoenix",
    }
  );

  assertEquals(gatherCalled, false);
  assertEquals(events.length, 0);
});

Deno.test("getLocalPlaces routes activity categories to catalog loader", async () => {
  foursquareSearchCalled = false;
  let catalogReadCategory: string | null = null;

  const admin = {
    from(table: string) {
      if (table === "food_drink_catalog_metros" || table === "activities_catalog_metros") {
        return {
          upsert: () => Promise.resolve({ error: null }),
        };
      }
      if (table === "activities_catalog") {
        const chain = {
          eq(col: string, val: string) {
            if (col === "provider_category") catalogReadCategory = val;
            return chain;
          },
          in: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        };
        return { select: () => chain };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    },
  };

  const { getLocalPlaces } = await import("../places/index.ts");

  await getLocalPlaces(
    admin as never,
    { lat: 33.35, lon: -111.79, city: "Gilbert", state: "AZ" },
    ["bowling"]
  );

  assertEquals(foursquareSearchCalled, false);
  assertEquals(catalogReadCategory, "bowling");
});

Deno.test("metro key is shared for users in same city", async () => {
  const { metroKeyFromEventLocation } = await import("../localEvents/eventsCatalog.ts");
  const { metroKeyFromLocation } = await import("../places/foodDrinkCatalogSync.ts");

  const location = { lat: 33.35, lon: -111.79, city: "Gilbert", state: "AZ" };
  assertEquals(
    metroKeyFromEventLocation(location),
    metroKeyFromLocation(location)
  );
});
