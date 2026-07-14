import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getEditorialSearchProviders } from "./providers.ts";
import { searchWikimediaCommons } from "./wikimedia.ts";

Deno.test("wikimedia provider is registered but not active by default", () => {
  const active = getEditorialSearchProviders();
  assertEquals(active.some((p) => p.id === "wikimedia"), false);
});

Deno.test("wikimedia search returns standardized candidates from public API", async () => {
  const results = await searchWikimediaCommons("Gilbert Arizona park", {
    orientation: "landscape",
    perPage: 3,
  });

  if (results.length === 0) {
    console.warn("[wikimedia.test] live API returned no results — skipping shape assertions");
    return;
  }

  const first = results[0]!;
  assertEquals(first.provider, "wikimedia");
  assertEquals(typeof first.providerImageId, "string");
  assertEquals(first.downloadUrl.startsWith("https://"), true);
  assertEquals(first.sourcePageUrl.includes("commons.wikimedia.org"), true);
  assertEquals(Boolean(first.licenseShortName), true);
  assertEquals(Boolean(first.attributionText), true);
  assertEquals(first.tags.length >= 1, true);
});

Deno.test("wikimedia rejects non-commercial licenses in filter", async () => {
  const results = await searchWikimediaCommons("museum", { perPage: 5 });
  for (const result of results) {
    assertEquals(/non.?commercial|\bnc\b|no derivatives|\bnd\b/i.test(result.licenseShortName ?? ""), false);
  }
});
