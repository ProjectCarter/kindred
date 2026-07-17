import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  validateAboutArtworkBody,
  ABOUT_ARTWORK_SENTENCE_MIN,
} from "./editorial.ts";
import { copyMorningHeroFromRecord } from "./presentation.ts";
import type { HeroArtworkRecord } from "./types.ts";

const SAMPLE_ABOUT =
  "Monet painted Water Lilies when Impressionism was still a daring experiment — and Paris had not yet learned to trust quick brushwork and open air. " +
  "The painting still rewards anyone willing to slow down, watch light move across water, and wonder why it endures.";

const SAMPLE_LONG_STORY =
  "Claude Monet painted Water Lilies during a late chapter of his career, when the artist devoted himself to the shifting surface of his garden pond at Giverny. " +
  "The series belongs to Impressionism's mature period, when Monet was less interested in fixed outlines than in the way light, reflection, and atmosphere could carry a painting.\n\n" +
  "By the time this canvas took shape, Monet had already spent decades testing how quick brushwork and high-key color could record a moment rather than a polished illusion. " +
  "Water Lilies extends that inquiry into a quieter register, where the viewer is invited to linger inside color and reflection instead of narrative action.\n\n" +
  "Look at how the surface divides between deep greens and pale violets, and notice how the lily forms seem to float forward while the water pushes back into depth. " +
  "Monet organizes the scene so that your eye travels in slow arcs rather than sharp lines, which gives the painting its meditative rhythm.\n\n" +
  "The work mattered because it showed that a subject as familiar as a garden pond could become a laboratory for modern vision. " +
  "Monet was not illustrating a place so much as teaching viewers how to see light change across an ordinary afternoon.\n\n" +
  "Later audiences recognized Water Lilies as one of the bridges between nineteenth-century Impressionism and the more abstract currents of twentieth-century painting. " +
  "Its scale, repetition, and emphasis on sensation influenced artists who wanted color and surface to speak for themselves.\n\n" +
  "Today the painting is preserved within the Metropolitan Museum of Art's collection in New York, where it remains one of the most quietly powerful examples of Monet's late style. " +
  "Kindred presents a mobile-optimized reproduction for morning discovery; the museum remains the authoritative home for the original canvas.";

const artwork: HeroArtworkRecord = {
  id: "uuid-1",
  internalId: "kindred:hero:met:water-lilies",
  artworkTitle: "Water Lilies",
  artist: "Claude Monet",
  year: "1919",
  sourceInstitution: "Metropolitan Museum of Art",
  sourceUrl: "https://www.metmuseum.org/art/collection/search/123",
  imageUrl: "https://example.com/hero.webp",
  hostedUrl: "https://example.com/hero.webp",
  storagePath: "met/water-lilies.webp",
  imageWidth: 1400,
  imageHeight: 933,
  aspectRatio: 1.501609,
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
  attributionText:
    "Painting by Claude Monet • Public Domain via Metropolitan Museum of Art",
  attributionRequired: true,
  verifiedAt: "2026-07-14T00:00:00.000Z",
  verifiedBy: "curator",
  sourceProvider: "met",
  sourceProviderArtworkId: "123",
  aboutArtworkBody: SAMPLE_ABOUT,
  aboutWordCount: 38,
  longStoryBody: SAMPLE_LONG_STORY,
  longStoryParagraphCount: 6,
  editorialSections: null,
  artistBiography:
    "Claude Monet (1840–1926) was a French painter and a leading figure of Impressionism. " +
    "His studies of light, atmosphere, and everyday landscape changed how modern audiences experience color in nature. " +
    "Works such as Water Lilies remain central to museum collections worldwide because they reward patient, unhurried looking.",
  lookCloserItems: [
    "Notice how the lily pads vary in value — some catch direct light while others fall into green shadow, creating depth without hard outlines.",
    "Look at the brushwork in the water: short, layered strokes suggest movement rather than a mirror-smooth surface.",
    "Compare the warm pinks near the center with the cooler greens at the edges; Monet uses that temperature shift to keep your eye circulating through the pond.",
  ],
  didYouKnow:
    "Monet's Water Lilies series grew out of the garden he cultivated at Giverny, where he designed the pond itself as part of the composition he would paint for years.",
  museumName: "Metropolitan Museum of Art",
  museumLocation: "New York, United States",
  officialMuseumUrl: "https://www.metmuseum.org/",
  officialArtworkUrl: "https://www.metmuseum.org/art/collection/search/123",
  sourceReferences: ["https://www.metmuseum.org/art/collection/search/123"],
  detailEditorialStatus: "approved",
  curatorEditorialStatus: "approved",
  banditMorningNote: null,
  featured: true,
  editorialPriority: 80,
  lastUsedAt: null,
  useCount: 0,
  approvalStatus: "approved",
};

Deno.test("about artwork enforces 1-2 sentence homepage teaser range", () => {
  const valid = validateAboutArtworkBody(SAMPLE_ABOUT);
  assertEquals(valid.valid, true);
  assertEquals(valid.sentenceCount >= ABOUT_ARTWORK_SENTENCE_MIN, true);

  const short = validateAboutArtworkBody("Too brief.");
  assertEquals(short.valid, false);
});

Deno.test("morning hero copies completed library record without generation", () => {
  const experience = copyMorningHeroFromRecord(artwork, "2026-07-14");
  assertEquals(experience?.artworkTitle, "Water Lilies");
  assertEquals(experience?.hostedUrl, artwork.hostedUrl);
  assertEquals(experience?.imageWidth, 1400);
  assertEquals(
    experience?.creditLine,
    "Painting by Claude Monet • Public Domain via Metropolitan Museum of Art"
  );
  assertEquals(experience?.aboutArtworkBody, SAMPLE_ABOUT);
  assertEquals(experience?.detail?.sections.length, 6);
  assertEquals(experience?.detail?.lookingCloser.length, 3);
});
