import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateHistoricalImageEditorial,
  historicalImageMatchesEvent,
  scoreImageEventMatch,
} from "./imageEventMatch.ts";

const AVIATION_1914_EVENT =
  "The Aviation Section, U.S. Signal Corps is created as the country's first military aviation unit.";

const LINCOLN_EVENT =
  "President Abraham Lincoln delivers the Gettysburg Address at the dedication of the Soldiers' National Cemetery.";

const TITANIC_EVENT =
  "RMS Titanic departs Southampton on her maiden voyage across the North Atlantic.";

const WRIGHT_EVENT =
  "Orville and Wilbur Wright make the first sustained powered flight at Kitty Hawk, North Carolina.";

function reject(input: Parameters<typeof historicalImageMatchesEvent>[0]) {
  const evaluation = evaluateHistoricalImageEditorial(input);
  assert.equal(evaluation.passes, false, JSON.stringify(evaluation));
  assert.ok(evaluation.score < 36, `expected low score, got ${evaluation.score}`);
}

function accept(input: Parameters<typeof historicalImageMatchesEvent>[0]) {
  const evaluation = evaluateHistoricalImageEditorial(input);
  assert.equal(evaluation.passes, true, JSON.stringify(evaluation));
  assert.ok(evaluation.score >= 36, `expected passing score, got ${evaluation.score}`);
}

test("rejects 1914 Aviation Section + Nadia Comăneci", () => {
  reject({
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
  });
});

test("rejects Abraham Lincoln + Apollo spacecraft", () => {
  reject({
    eventYear: 1863,
    eventText: LINCOLN_EVENT,
    articleBody: LINCOLN_EVENT,
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/0/00/Apollo_11_launch2.jpg",
      caption: "Apollo 11 Saturn V launch",
      credit: "NASA — Apollo 11",
      sourcePageUrl: "https://en.wikipedia.org/wiki/Apollo_11",
    },
    pageTitle: "Apollo 11",
  });
});

test("rejects Titanic + Eiffel Tower", () => {
  reject({
    eventYear: 1912,
    eventText: TITANIC_EVENT,
    articleBody: TITANIC_EVENT,
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/8/85/Eiffel_Tower_from_Trocadero.jpg",
      caption: "Eiffel Tower",
      credit: "Photograph via Wikipedia (Eiffel_Tower)",
      sourcePageUrl: "https://en.wikipedia.org/wiki/Eiffel_Tower",
    },
    pageTitle: "Eiffel Tower",
  });
});

test("rejects Wright Brothers + Space Shuttle", () => {
  reject({
    eventYear: 1903,
    eventText: WRIGHT_EVENT,
    articleBody: WRIGHT_EVENT,
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/3/3f/Space_Shuttle_Atlantis_streak.jpg",
      caption: "Space Shuttle Atlantis launch",
      credit: "NASA — Space Shuttle",
      sourcePageUrl: "https://en.wikipedia.org/wiki/Space_Shuttle",
    },
    pageTitle: "Space Shuttle",
  });
});

test("accepts 1914 Aviation Section + Aviation Corps image", () => {
  accept({
    eventYear: 1914,
    eventText: AVIATION_1914_EVENT,
    articleBody: AVIATION_1914_EVENT,
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Aviation_Section_US_Signal_Corps.jpg",
      caption: "Aviation Section, U.S. Signal Corps",
      credit: "Photograph via Wikipedia (Aviation_Section,_U.S._Signal_Corps)",
      sourcePageUrl: "https://en.wikipedia.org/wiki/Aviation_Section,_U.S._Signal_Corps",
    },
    pageTitle: "Aviation Section, U.S. Signal Corps",
  });
});

test("accepts Abraham Lincoln + Lincoln portrait", () => {
  accept({
    eventYear: 1863,
    eventText: LINCOLN_EVENT,
    articleBody: LINCOLN_EVENT,
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Abraham_Lincoln_O-77_matte_collodion_print.jpg",
      caption: "Abraham Lincoln",
      credit: "Photograph via Wikipedia (Abraham_Lincoln)",
      sourcePageUrl: "https://en.wikipedia.org/wiki/Abraham_Lincoln",
    },
    pageTitle: "Abraham Lincoln",
  });
});

test("accepts Titanic + Titanic ship photograph", () => {
  accept({
    eventYear: 1912,
    eventText: TITANIC_EVENT,
    articleBody: TITANIC_EVENT,
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/6/6d/RMS_Titanic_3.jpg",
      caption: "RMS Titanic departing Southampton",
      credit: "Photograph via Wikipedia (RMS_Titanic)",
      sourcePageUrl: "https://en.wikipedia.org/wiki/RMS_Titanic",
    },
    pageTitle: "RMS Titanic",
  });
});

test("accepts Wright Brothers + Wright Flyer artifact", () => {
  accept({
    eventYear: 1903,
    eventText: WRIGHT_EVENT,
    articleBody: WRIGHT_EVENT,
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/8/86/Wright_Flyer_I_at_the_Smithsonian%2C_IMG_4583.jpg",
      caption: "Wright Flyer I",
      credit: "Photograph via Wikipedia (Wright_Flyer)",
      sourcePageUrl: "https://en.wikipedia.org/wiki/Wright_Flyer",
      assetKind: "artifact",
    },
    pageTitle: "Wright Flyer",
  });
});

test("modern person photo passes only when article is about that person", () => {
  const nadiaEvent =
    "Nadia Comăneci becomes the first gymnast to score a perfect 10 at the Montreal Olympics.";

  accept({
    eventYear: 1976,
    eventText: nadiaEvent,
    articleBody: nadiaEvent,
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/8/87/Nadia_Com%C4%83neci_at_Sports_Festival_2026.jpg",
      caption: "Nadia Comăneci",
      credit: "Photograph via Wikipedia (Nadia_Comăneci)",
      sourcePageUrl: "https://en.wikipedia.org/wiki/Nadia_Com%C4%83neci",
    },
    pageTitle: "Nadia Comăneci",
  });

  reject({
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
  });
});

test("missing metadata fails closed with no image", () => {
  assert.equal(
    historicalImageMatchesEvent({
      eventYear: 1914,
      eventText: AVIATION_1914_EVENT,
      articleBody: AVIATION_1914_EVENT,
      image: { url: "https://example.com/photo.jpg", caption: "", credit: "" },
    }),
    false
  );
  assert.equal(scoreImageEventMatch({
    eventYear: 1914,
    eventText: AVIATION_1914_EVENT,
    articleBody: AVIATION_1914_EVENT,
    image: { url: "https://example.com/photo.jpg", caption: "", credit: "" },
  }) <= 0, true);
});
