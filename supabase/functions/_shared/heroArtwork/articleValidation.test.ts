import { assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  containsCorruptedArticleSyntax,
  masterpieceDetailIsCorrupt,
  validateMorningHeroArticle,
} from "./articleValidation.ts";
import { sanitizeMorningHeroExperience } from "./sanitizeRecord.ts";
import type { MorningHeroExperience } from "./presentation.ts";

const DAHL_DIRTY =
  'Stream in the Liebethaler Grund title QS:P1476,en:"Stream in the Liebethaler Grund " label QS:Len,"Stream in the Liebethaler Grund " labe…';

Deno.test("containsCorruptedArticleSyntax detects Wikidata article fragments", () => {
  assertEquals(containsCorruptedArticleSyntax(DAHL_DIRTY), true);
  assertEquals(containsCorruptedArticleSyntax("Stream in the Liebethaler Grund"), false);
  assertEquals(containsCorruptedArticleSyntax("labe..."), true);
  assertEquals(containsCorruptedArticleSyntax("label QS:Len"), true);
  assertEquals(containsCorruptedArticleSyntax("P1476"), true);
});

Deno.test("sanitizeMorningHeroExperience regenerates corrupt detail sections", () => {
  const dirty: MorningHeroExperience = {
    editionDate: "2026-07-17",
    artworkId: "bf342928-0041-48e0-887f-196696b18c14",
    artworkTitle: "Stream in the Liebethaler Grund",
    artist: "Johan Christian Dahl",
    year: null,
    sourceInstitution: "Wikimedia Commons",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Johan_Christian_Dahl_-_Stream_in_the_Liebethaler_Grund_-_NG.M.01949_-_National_Museum_of_Art%2C_Architecture_and_Design.jpg",
    license: "public_domain",
    licenseUrl: null,
    hostedUrl:
      "https://zdqjeocdsbdzecawumdp.supabase.co/storage/v1/object/public/kindred-hero-artwork/wikimedia/97986387.jpg",
    imageUrl:
      "https://zdqjeocdsbdzecawumdp.supabase.co/storage/v1/object/public/kindred-hero-artwork/wikimedia/97986387.jpg",
    imageWidth: 1400,
    imageHeight: 933,
    aspectRatio: 1.5,
    creditLine: "Johan Christian Dahl. Wikimedia Commons.",
    aboutArtworkBody:
      "Stream in the Liebethaler Grund is a celebrated work by Johan Christian Dahl.",
    aboutWordCount: 12,
    collections: ["romanticism"],
    detail: {
      sections: [
        {
          heading: "Introduction",
          paragraphs: [
            `Step closer to ${DAHL_DIRTY}, and the homepage glimpse becomes something richer.`,
          ],
        },
      ],
      lookingCloser: [`Notice light in ${DAHL_DIRTY}.`],
      didYouKnow: `${DAHL_DIRTY} is shared through Wikimedia Commons.`,
      museumName: "Wikimedia Commons",
      museumLocation: "Online collection",
      officialMuseumUrl: "https://commons.wikimedia.org/",
      officialArtworkUrl: null,
      sourceReferences: [],
    },
  };

  assertEquals(masterpieceDetailIsCorrupt(dirty.detail), true);

  const clean = sanitizeMorningHeroExperience(dirty);
  assertEquals(validateMorningHeroArticle(clean), true);
  assertFalse(JSON.stringify(clean.detail).includes("QS:"));
  assertFalse(JSON.stringify(clean.detail).includes("P1476"));
  assertFalse(JSON.stringify(clean.detail).includes("label QS:"));
  assertFalse(JSON.stringify(clean.detail).includes("labe"));
});
