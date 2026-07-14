import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAttributionText,
  isHeroArtworkLicenseSafe,
  isHeroArtworkRecordSelectable,
} from "./licensing.ts";
import type { HeroArtworkRecord } from "./types.ts";

const verifiedArtwork: HeroArtworkRecord = {
  id: "uuid-1",
  internalId: "kindred:hero:met:test",
  artworkTitle: "Water Lilies",
  artist: "Claude Monet",
  year: "1919",
  sourceInstitution: "Metropolitan Museum of Art",
  sourceUrl: "https://www.metmuseum.org/art/collection/search/123",
  imageUrl: null,
  hostedUrl: null,
  storagePath: null,
  orientation: "landscape",
  dominantColors: ["green", "blue"],
  tags: ["impressionism"],
  seasons: ["summer"],
  holidays: [],
  license: "public_domain",
  publicDomainStatus: "verified",
  attributionText: null,
  attributionRequired: true,
  verifiedAt: "2026-07-14T00:00:00.000Z",
  verifiedBy: "curator",
  sourceProvider: "met",
  sourceProviderArtworkId: "123",
  featured: true,
  editorialPriority: 80,
  lastUsedAt: null,
  useCount: 0,
  approvalStatus: "approved",
};

Deno.test("verified public domain artwork is selectable", () => {
  assertEquals(isHeroArtworkLicenseSafe(verifiedArtwork), true);
  assertEquals(isHeroArtworkRecordSelectable(verifiedArtwork), true);
});

Deno.test("pending verification is rejected", () => {
  assertEquals(
    isHeroArtworkLicenseSafe({
      ...verifiedArtwork,
      publicDomainStatus: "pending",
    }),
    false
  );
});

Deno.test("unknown license is rejected", () => {
  assertEquals(
    isHeroArtworkLicenseSafe({
      ...verifiedArtwork,
      license: "all_rights_reserved",
    }),
    false
  );
});

Deno.test("attribution text includes institution", () => {
  const text = buildAttributionText({
    artworkTitle: "The Starry Night",
    artist: "Vincent van Gogh",
    year: "1889",
    sourceInstitution: "MoMA",
  });
  assertEquals(text.toLowerCase().includes("van gogh"), true);
  assertEquals(text.includes("MoMA"), true);
});
