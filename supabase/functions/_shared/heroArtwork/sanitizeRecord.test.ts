import { assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeMorningHeroExperience } from "./sanitizeRecord.ts";
import type { MorningHeroExperience } from "./presentation.ts";

const DAHL_RAW =
  'Stream in the Liebethaler Grund title QS:P1476,en:"Stream in the Liebethaler Grund " label QS:Len,"Stream in the Liebethaler Grund " labe…';

Deno.test("sanitizeMorningHeroExperience repairs frozen snapshot metadata", () => {
  const dirty: MorningHeroExperience = {
    editionDate: "2026-07-17",
    artworkId: "bf342928-0041-48e0-887f-196696b18c14",
    artworkTitle: DAHL_RAW,
    artist: "Johan Christian Dahl",
    year: "1476",
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
    creditLine: `${DAHL_RAW}, Johan Christian Dahl. Wikimedia Commons.`,
    aboutArtworkBody: `${DAHL_RAW} is a celebrated work by Johan Christian Dahl.`,
    aboutWordCount: 100,
    collections: ["romanticism"],
    detail: {
      sections: [
        {
          heading: "Introduction",
          paragraphs: [
            `Step closer to ${DAHL_RAW}, and the homepage glimpse becomes something richer.`,
          ],
        },
      ],
      lookingCloser: [`Notice how Johan Christian Dahl uses light in ${DAHL_RAW}.`],
      didYouKnow: `${DAHL_RAW} is shared through Wikimedia Commons.`,
      museumName: "Wikimedia Commons",
      museumLocation: "Online collection",
      officialMuseumUrl: "https://commons.wikimedia.org/",
      officialArtworkUrl: null,
      sourceReferences: [],
    },
  };

  const clean = sanitizeMorningHeroExperience(dirty);

  assertEquals(clean.artworkTitle, "Stream in the Liebethaler Grund");
  assertEquals(clean.artist, "Johan Christian Dahl");
  assertFalse(clean.year === "1476");
  assertFalse(/QS:/i.test(clean.aboutArtworkBody));
  assertFalse(/QS:/i.test(clean.creditLine));
  assertFalse(/\blabel\b/i.test(clean.artworkTitle));

  const detailText = JSON.stringify(clean.detail);
  assertFalse(/QS:/i.test(detailText));
  assertFalse(/\bP1476\b/i.test(detailText));
  assertFalse(/labe…/.test(detailText));
});
