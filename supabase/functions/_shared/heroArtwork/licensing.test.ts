import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildAttributionText,
  isHeroArtworkLicenseSafe,
  isHeroArtworkRecordSelectable,
} from "./licensing.ts";
import type { HeroArtworkRecord } from "./types.ts";

const SAMPLE_ABOUT =
  "Claude Monet painted this scene during a prolific period of study along the Seine, " +
  "when Impressionism was still a young and controversial movement in Paris. The work matters " +
  "because it helped redefine how painters could capture light, atmosphere, and the passing " +
  "moment rather than polished illusion. It became famous as audiences recognized a new way " +
  "of seeing everyday beauty in modern life. Monet's brushwork here invites the viewer to " +
  "linger in color and reflection rather than narrative detail, offering calm at daybreak.";

const verifiedArtwork: HeroArtworkRecord = {
  id: "uuid-1",
  internalId: "kindred:hero:met:test",
  artworkTitle: "Water Lilies",
  artist: "Claude Monet",
  year: "1919",
  sourceInstitution: "Metropolitan Museum of Art",
  sourceUrl: "https://www.metmuseum.org/art/collection/search/123",
  imageUrl: "https://example.com/water-lilies.jpg",
  hostedUrl: "https://zdqjeocdsbdzecawumdp.supabase.co/storage/v1/object/public/kindred-hero-artwork/met/test.jpg",
  storagePath: "met/test.jpg",
  imageWidth: 1400,
  imageHeight: 933,
  aspectRatio: 1.501609,
  orientation: "landscape",
  dominantColors: ["green", "blue"],
  collections: ["impressionism", "museum_open_access"],
  moodTags: ["calm", "wonder"],
  tags: ["impressionism"],
  seasons: ["summer"],
  holidays: [],
  license: "public_domain",
  licenseUrl: "https://www.metmuseum.org/about-the-met/policies-and-documents/open-access",
  publicDomainStatus: "verified",
  verificationSource: "Met Open Access Policy",
  commercialUseConfirmed: true,
  attributionText:
    "Painting by Claude Monet • Public Domain via Metropolitan Museum of Art",
  attributionRequired: true,
  verifiedAt: "2026-07-14T00:00:00.000Z",
  verifiedBy: "curator",
  sourceProvider: "met",
  sourceProviderArtworkId: "123",
  aboutArtworkBody: SAMPLE_ABOUT,
  aboutWordCount: 82,
  longStoryBody: null,
  longStoryParagraphCount: null,
  artistBiography: null,
  lookCloserItems: [],
  didYouKnow: null,
  museumName: null,
  museumLocation: null,
  officialMuseumUrl: null,
  officialArtworkUrl: null,
  sourceReferences: [],
  detailEditorialStatus: "pending",
  curatorEditorialStatus: "approved",
  banditMorningNote: null,
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

Deno.test("unhosted artwork is not edition-ready", () => {
  assertEquals(
    isHeroArtworkRecordSelectable({
      ...verifiedArtwork,
      hostedUrl: null,
      storagePath: null,
      imageWidth: null,
      imageHeight: null,
      aspectRatio: null,
    }),
    false
  );
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

Deno.test("unconfirmed commercial use is rejected", () => {
  assertEquals(
    isHeroArtworkLicenseSafe({
      ...verifiedArtwork,
      commercialUseConfirmed: false,
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
