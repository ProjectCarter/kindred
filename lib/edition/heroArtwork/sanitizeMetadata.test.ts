import { describe, it, expect } from "node:test";
import assert from "node:assert/strict";
import {
  containsWikidataSyntax,
  sanitizeArtworkTitle,
  sanitizeArtistName,
  sanitizeEditorialText,
} from "./sanitizeMetadata.ts";
import { normalizeMorningHeroExperience } from "./normalize.ts";

const DAHL_RAW =
  'Stream in the Liebethaler Grund title QS:P1476,en:"Stream in the Liebethaler Grund " label QS:Len,"Stream in the Liebethaler Grund " labe…';

const DAHL_FILE =
  "File:Johan Christian Dahl - Stream in the Liebethaler Grund - NG.M.01949 - National Museum of Art, Architecture and Design.jpg";

describe("sanitizeMetadata", () => {
  it("rejects Wikidata syntax in titles", () => {
    const title = sanitizeArtworkTitle(DAHL_RAW, { filePageTitle: DAHL_FILE });
    assert.equal(title, "Stream in the Liebethaler Grund");
    assert.equal(containsWikidataSyntax(title), false);
    assert.equal(title.includes("QS:"), false);
    assert.equal(/\blabel\b/i.test(title), false);
  });

  it("keeps human-readable artist names", () => {
    const artist = sanitizeArtistName("Johan Christian Dahl", DAHL_FILE);
    assert.equal(artist, "Johan Christian Dahl");
    assert.equal(containsWikidataSyntax(artist), false);
  });

  it("strips Wikidata blocks from editorial text", () => {
    const body = sanitizeEditorialText(
      `${DAHL_RAW} is a celebrated work by Johan Christian Dahl.`
    );
    assert.equal(/QS:/i.test(body), false);
    assert.equal(body.startsWith("Stream in the Liebethaler Grund is"), true);
  });

  it("preserves paragraph breaks in long-form editorial text", () => {
    const body = [
      "First paragraph with enough words to survive editorial validation gates cleanly.",
      "Second paragraph with enough words to survive editorial validation gates cleanly.",
      "Third paragraph with enough words to survive editorial validation gates cleanly.",
    ].join("\n\n");
    const cleaned = sanitizeEditorialText(body);
    assert.equal(cleaned.split(/\n{2,}/).length, 3);
  });
});

describe("normalizeMorningHeroExperience", () => {
  it("regenerates corrupt detail sections from clean structured fields", () => {
    const dirtyDetail = {
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
    };

    const normalized = normalizeMorningHeroExperience({
      editionDate: "2026-07-17",
      artworkId: "bf342928-0041-48e0-887f-196696b18c14",
      artworkTitle: "Stream in the Liebethaler Grund",
      artist: "Johan Christian Dahl",
      year: null,
      sourceInstitution: "Wikimedia Commons",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Johan_Christian_Dahl_-_Stream_in_the_Liebethaler_Grund_-_NG.M.01949_-_National_Museum_of_Art%2C_Architecture_and_Design.jpg",
      license: "public_domain",
      hostedUrl:
        "https://example.com/kindred-hero-artwork/wikimedia/97986387.jpg",
      aboutArtworkBody:
        "Stream in the Liebethaler Grund is a celebrated work by Johan Christian Dahl.",
      detail: dirtyDetail,
      collections: ["romanticism"],
    });

    assert.ok(normalized);
    const json = JSON.stringify(normalized);
    assert.equal(/QS:/i.test(json), false);
    assert.equal(/\bP1476\b/.test(json), false);
    assert.equal(/label QS:/i.test(json), false);
    assert.equal(/labe…/.test(json), false);
    assert.equal(
      normalized!.detail?.sections?.[0]?.paragraphs?.[0]?.includes(
        "Stream in the Liebethaler Grund"
      ),
      true
    );
  });
});
