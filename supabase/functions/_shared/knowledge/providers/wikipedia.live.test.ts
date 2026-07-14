import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { lookupWikipedia } from "./wikipedia.ts";

Deno.test("wikipedia live lookup returns standardized shape for museum", async () => {
  const mockAdmin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
      upsert: async () => ({ error: null }),
      update: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }),
  };

  const result = await lookupWikipedia(mockAdmin as never, {
    entityName: "Heard Museum",
    context: "Phoenix, Arizona",
  });

  if (!result) {
    console.warn("[wikipedia.test] live API returned no match — skipping shape assertions");
    return;
  }

  assertEquals(result.provider, "wikipedia");
  assertEquals(typeof result.pageTitle, "string");
  assertEquals(result.canonicalUrl.includes("wikipedia.org"), true);
  assertEquals(result.editorialSummary.length > 20, true);
  assertEquals(result.extract.length > result.editorialSummary.length, true);
  assertEquals(typeof result.pageId, "number");
  assertEquals(result.language, "en");
  assertEquals(result.confidence >= 0.62, true);
  assertEquals(result.sourceAttribution.includes("Wikipedia"), true);
  assertEquals(Boolean(result.retrievedAt), true);
});

Deno.test("wikipedia rejects low-confidence local business lookup", async () => {
  const mockAdmin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
      upsert: async () => ({ error: null }),
      update: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }),
  };

  const result = await lookupWikipedia(mockAdmin as never, {
    entityName: "Random Local Coffee Shop XYZ123",
    context: "Gilbert, Arizona",
  });

  assertEquals(result, null);
});
