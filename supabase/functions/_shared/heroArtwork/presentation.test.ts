import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateAboutArtworkBody, ABOUT_ARTWORK_WORD_MIN } from "./editorial.ts";
import { selectBanditMorningNote } from "./banditNote.ts";
import { buildMorningHeroExperience } from "./presentation.ts";
import type { HeroArtworkRecord } from "./types.ts";

const SAMPLE_ABOUT =
  "Claude Monet painted this scene during a prolific period of study along the Seine, " +
  "when Impressionism was still a young and controversial movement in Paris. The work matters " +
  "because it helped redefine how painters could capture light, atmosphere, and the passing " +
  "moment rather than polished illusion. It became famous as audiences recognized a new way " +
  "of seeing everyday beauty in modern life. Monet's brushwork here invites the viewer to " +
  "linger in color and reflection rather than narrative detail, offering calm at daybreak.";

const artwork: HeroArtworkRecord = {
  id: "uuid-1",
  internalId: "kindred:hero:met:water-lilies",
  artworkTitle: "Water Lilies",
  artist: "Claude Monet",
  year: "1919",
  sourceInstitution: "Metropolitan Museum of Art",
  sourceUrl: "https://www.metmuseum.org/art/collection/search/123",
  imageUrl: null,
  hostedUrl: null,
  storagePath: null,
  orientation: "landscape",
  dominantColors: ["green"],
  collections: ["impressionism"],
  moodTags: ["calm"],
  tags: [],
  seasons: ["summer"],
  holidays: [],
  license: "public_domain",
  licenseUrl: "https://www.metmuseum.org/open-access",
  publicDomainStatus: "verified",
  verificationSource: "Met Open Access",
  commercialUseConfirmed: true,
  attributionText: null,
  attributionRequired: true,
  verifiedAt: "2026-07-14T00:00:00.000Z",
  verifiedBy: "curator",
  sourceProvider: "met",
  sourceProviderArtworkId: "123",
  aboutArtworkBody: SAMPLE_ABOUT,
  aboutWordCount: 82,
  curatorEditorialStatus: "approved",
  banditMorningNote: null,
  featured: true,
  editorialPriority: 80,
  lastUsedAt: null,
  useCount: 0,
  approvalStatus: "approved",
};

Deno.test("about artwork enforces 80-150 word editorial range", () => {
  const valid = validateAboutArtworkBody(SAMPLE_ABOUT);
  assertEquals(valid.valid, true);
  assertEquals(valid.wordCount >= ABOUT_ARTWORK_WORD_MIN, true);

  const short = validateAboutArtworkBody("Too brief.");
  assertEquals(short.valid, false);
});

Deno.test("bandit morning note is quiet and mood-based", () => {
  const note = selectBanditMorningNote(artwork, {
    editionDate: "2026-07-14",
    season: "summer",
  });
  assertEquals(note.length > 0, true);
  assertEquals(note.includes("!"), false);
});

Deno.test("morning hero experience includes artwork and editorial sections", () => {
  const experience = buildMorningHeroExperience(artwork, "2026-07-14", {
    season: "summer",
  });
  assertEquals(experience?.artworkTitle, "Water Lilies");
  assertEquals(experience?.aboutArtworkHeading, "About Today's Artwork");
  assertEquals((experience?.banditMorningNote?.length ?? 0) > 0, true);
});
