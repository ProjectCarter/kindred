import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarMonthDayFromEditionDate,
  formatNationalDailyValidationFailure,
  nationalDailyValidationPassed,
  priorCalendarEditionDate,
  snapshotFromNationalDailyRow,
  validateNationalDailyForAttach,
} from "./nationalDailyValidation.ts";

const MASTERPIECE = (editionDate: string) => ({
  artworkId: "art-001",
  presentation: {
    editionDate,
    artworkId: "art-001",
    artworkTitle: "The Great Wave off Kanagawa",
    artist: "Katsushika Hokusai",
    year: "c. 1831",
    sourceInstitution: "Metropolitan Museum of Art",
    sourceUrl: "https://example.com/wave",
    license: "Public Domain",
    licenseUrl: null,
    hostedUrl: "https://cdn.example.com/wave.jpg",
    imageUrl: "https://cdn.example.com/wave.jpg",
    imageWidth: 1200,
    imageHeight: 800,
    aspectRatio: 1.5,
    creditLine: "Metropolitan Museum of Art",
    aboutArtworkBody: "A verified overview of the artwork.",
    aboutWordCount: 120,
    collections: [],
    detail: null,
  },
});

const HISTORY = (calendarMonthDay: string) => ({
  year: 1976,
  eventText: "Nadia Comăneci scored the first perfect 10 in Olympic gymnastics.",
  headline: "1976 — A Perfect Ten",
  body: "Paragraph one.\n\nParagraph two.",
  teaser: "Paragraph one.",
  sourceNote: "Sourced from Wikipedia",
  image: null,
  selectionMeta: {
    editorialScore: 80,
    imageScore: 70,
    candidateCount: 12,
    selectedRank: 1,
    editorNotes: [],
    calendarMonthDay,
  },
});

const NATIONAL_NEWS = (editionDate: string) => ({
  packageId: `national-news-${editionDate}`,
  editionDate,
  stories: [
    {
      id: "story-1",
      rank: 1,
      headline: "Headline one",
      summary: "Summary one",
      sourceName: "AP",
      sourceUrl: "https://example.com/1",
    },
    {
      id: "story-2",
      rank: 2,
      headline: "Headline two",
      summary: "Summary two",
      sourceName: "Reuters",
      sourceUrl: "https://example.com/2",
    },
    {
      id: "story-3",
      rank: 3,
      headline: "Headline three",
      summary: "Summary three",
      sourceName: "NPR",
      sourceUrl: "https://example.com/3",
    },
  ],
});

function validRow(editionDate: string) {
  return snapshotFromNationalDailyRow({
    edition_date: editionDate,
    today_masterpiece: MASTERPIECE(editionDate),
    masterpiece_artwork_id: "art-001",
    today_in_history: HISTORY(calendarMonthDayFromEditionDate(editionDate)!),
    history_event_key: "1976:Nadia",
    national_news: NATIONAL_NEWS(editionDate),
  });
}

test("priorCalendarEditionDate — steps back one calendar day", () => {
  assert.equal(priorCalendarEditionDate("2026-07-19"), "2026-07-18");
  assert.equal(priorCalendarEditionDate("2026-03-01"), "2026-02-28");
});

test("validateNationalDailyForAttach — accepts a fresh consecutive day", () => {
  const july18 = validRow("2026-07-18");
  const july19 = validRow("2026-07-19");
  july19.todayMasterpiece = MASTERPIECE("2026-07-19");
  july19.todayInHistory = HISTORY("07-19");
  july19.nationalNews = NATIONAL_NEWS("2026-07-19");

  const issues = validateNationalDailyForAttach({
    row: july19,
    heroSelectionArtworkId: "art-001",
    priorDay: july18,
  });
  assert.equal(nationalDailyValidationPassed(issues), true);
});

test("validateNationalDailyForAttach — rejects stale embedded editionDate (July 19 clone)", () => {
  const priorDay = validRow("2026-07-18");
  const clone = snapshotFromNationalDailyRow({
    edition_date: "2026-07-19",
    today_masterpiece: MASTERPIECE("2026-07-18"),
    masterpiece_artwork_id: "art-001",
    today_in_history: HISTORY("07-18"),
    history_event_key: "1976:Nadia",
    national_news: NATIONAL_NEWS("2026-07-18"),
  });

  const issues = validateNationalDailyForAttach({
    row: clone,
    heroSelectionArtworkId: null,
    priorDay,
  });

  assert.equal(nationalDailyValidationPassed(issues), false);
  assert.ok(
    issues.some((issue) => issue.code === "stale_masterpiece_edition_date")
  );
  assert.ok(
    issues.some((issue) => issue.code === "stale_national_news_edition_date")
  );
  assert.ok(
    issues.some((issue) => issue.code === "history_calendar_month_day_mismatch")
  );
  assert.ok(issues.some((issue) => issue.code === "missing_hero_selection"));
  assert.ok(
    issues.some((issue) => issue.code === "identical_masterpiece_from_prior_day")
  );
  assert.ok(
    issues.some((issue) => issue.code === "identical_history_from_prior_day")
  );
  assert.ok(
    issues.some((issue) => issue.code === "identical_national_news_from_prior_day")
  );
});

test("validateNationalDailyForAttach — consecutive days with distinct payloads pass", () => {
  const july18 = validRow("2026-07-18");
  const july19 = validRow("2026-07-19");
  july19.todayMasterpiece = {
    ...MASTERPIECE("2026-07-19"),
    artworkId: "art-002",
    presentation: {
      ...MASTERPIECE("2026-07-19").presentation,
      artworkId: "art-002",
      artworkTitle: "Starry Night",
      artist: "Vincent van Gogh",
    },
  };
  july19.masterpieceArtworkId = "art-002";
  july19.todayInHistory = {
    ...HISTORY("07-19"),
    year: 1969,
    eventText: "Apollo 11 astronauts landed on the Moon.",
    headline: "1969 — One Small Step on the Moon",
    body: "Different body for July 19.",
  };
  july19.nationalNews = NATIONAL_NEWS("2026-07-19");

  const issues = validateNationalDailyForAttach({
    row: july19,
    heroSelectionArtworkId: "art-002",
    priorDay: july18,
  });
  assert.equal(nationalDailyValidationPassed(issues), true);
});

test("formatNationalDailyValidationFailure — includes edition date and codes", () => {
  const message = formatNationalDailyValidationFailure("2026-07-19", [
    { code: "missing_hero_selection", message: "hero row missing" },
  ]);
  assert.match(message, /2026-07-19/);
  assert.match(message, /missing_hero_selection/);
});
