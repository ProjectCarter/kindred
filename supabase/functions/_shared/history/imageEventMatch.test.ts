import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateHistoricalImageEditorial } from "./imageEventMatch.ts";

const AVIATION_1914_EVENT =
  "The Aviation Section, U.S. Signal Corps is created as the country's first military aviation unit.";

Deno.test("editorial gate rejects unrelated Nadia photo for 1914 aviation event", () => {
  assertEquals(
    evaluateHistoricalImageEditorial({
      eventYear: 1914,
      eventText: AVIATION_1914_EVENT,
      articleBody: AVIATION_1914_EVENT,
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/8/87/Nadia_Com%C4%83neci_at_Sports_Festival_2026.jpg",
        caption: "Nadia Comăneci",
        credit: "Photograph via Wikipedia (Nadia_Comăneci)",
        sourcePageUrl: "https://en.wikipedia.org/wiki/Nadia_Com%C4%83neci",
      },
      pageTitle: "Nadia Comăneci",
    }).passes,
    false
  );
});

Deno.test("editorial gate accepts aviation corps image for 1914 aviation event", () => {
  assertEquals(
    evaluateHistoricalImageEditorial({
      eventYear: 1914,
      eventText: AVIATION_1914_EVENT,
      articleBody: AVIATION_1914_EVENT,
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Aviation_Section.jpg",
        caption: "Aviation Section, U.S. Signal Corps",
        credit: "Photograph via Wikipedia (Aviation_Section,_U.S._Signal_Corps)",
        sourcePageUrl: "https://en.wikipedia.org/wiki/Aviation_Section,_U.S._Signal_Corps",
      },
      pageTitle: "Aviation Section, U.S. Signal Corps",
    }).passes,
    true
  );
});
