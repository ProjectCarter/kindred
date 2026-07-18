import test from "node:test";
import assert from "node:assert/strict";
import {
  historyTeaserFromBody,
  isCompleteUsNationalDaily,
  parseUsNationalDailyRow,
  US_NATIONAL_COUNTRY_CODE,
} from "./usNationalDaily.ts";

const SAMPLE_MASTERPIECE = {
  artworkId: "art-001",
  presentation: {
    editionDate: "2026-07-18",
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
};

const SAMPLE_HISTORY = {
  year: 1969,
  eventText: "Apollo 11 astronauts landed on the Moon.",
  headline: "1969 — One Small Step on the Moon",
  body: "Paragraph one about the landing.\n\nParagraph two with verified context.",
  teaser: "Paragraph one about the landing.",
  sourceNote: "Sourced from Wikipedia",
  image: null,
  selectionMeta: {
    editorialScore: 80,
    imageScore: 70,
    candidateCount: 12,
    selectedRank: 1,
    editorNotes: [],
  },
};

test("parseUsNationalDailyRow — masterpiece and history ids stable for all cities", () => {
  const row = {
    id: "national-abc",
    edition_date: "2026-07-18",
    country_code: US_NATIONAL_COUNTRY_CODE,
    today_masterpiece: SAMPLE_MASTERPIECE,
    today_in_history: SAMPLE_HISTORY,
  };

  const gilbert = parseUsNationalDailyRow(row);
  const seattle = parseUsNationalDailyRow(row);

  assert.equal(gilbert?.id, seattle?.id);
  assert.equal(
    gilbert?.todayMasterpiece?.artworkId,
    seattle?.todayMasterpiece?.artworkId
  );
  assert.equal(gilbert?.todayInHistory?.headline, seattle?.todayInHistory?.headline);
});

test("different edition dates produce different national record ids", () => {
  const july17 = parseUsNationalDailyRow({
    id: "national-1",
    edition_date: "2026-07-17",
    country_code: US_NATIONAL_COUNTRY_CODE,
    today_masterpiece: SAMPLE_MASTERPIECE,
    today_in_history: SAMPLE_HISTORY,
  });
  const july18 = parseUsNationalDailyRow({
    id: "national-2",
    edition_date: "2026-07-18",
    country_code: US_NATIONAL_COUNTRY_CODE,
    today_masterpiece: SAMPLE_MASTERPIECE,
    today_in_history: SAMPLE_HISTORY,
  });

  assert.notEqual(july17?.id, july18?.id);
  assert.notEqual(july17?.editionDate, july18?.editionDate);
});

test("legacy edition rows without national reference still parse when embedded", () => {
  const legacy = parseUsNationalDailyRow({
    id: "legacy-national",
    edition_date: "2026-07-10",
    country_code: US_NATIONAL_COUNTRY_CODE,
    today_masterpiece: { artwork_id: "art-legacy", presentation: SAMPLE_MASTERPIECE.presentation },
    today_in_history: SAMPLE_HISTORY,
  });
  assert.equal(legacy?.todayMasterpiece?.artworkId, "art-legacy");
  assert.ok(legacy?.todayInHistory?.body.includes("Paragraph one"));
});

test("historyTeaserFromBody trims long openers", () => {
  const long = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");
  const teaser = historyTeaserFromBody(long);
  assert.ok(teaser.endsWith("…"));
  assert.ok(teaser.split(/\s+/).length <= 43);
});

test("isCompleteUsNationalDaily requires both desks", () => {
  assert.equal(
    isCompleteUsNationalDaily(
      parseUsNationalDailyRow({
        id: "x",
        edition_date: "2026-07-18",
        country_code: US_NATIONAL_COUNTRY_CODE,
        today_masterpiece: SAMPLE_MASTERPIECE,
        today_in_history: SAMPLE_HISTORY,
      })
    ),
    true
  );
  assert.equal(
    isCompleteUsNationalDaily(
      parseUsNationalDailyRow({
        id: "x",
        edition_date: "2026-07-18",
        country_code: US_NATIONAL_COUNTRY_CODE,
        today_masterpiece: SAMPLE_MASTERPIECE,
        today_in_history: null,
      })
    ),
    false
  );
});

test("national layer does not embed city-specific local desks", () => {
  const parsed = parseUsNationalDailyRow({
    id: "national-abc",
    edition_date: "2026-07-18",
    country_code: US_NATIONAL_COUNTRY_CODE,
    today_masterpiece: SAMPLE_MASTERPIECE,
    today_in_history: SAMPLE_HISTORY,
  });
  const serialized = JSON.stringify(parsed);
  assert.doesNotMatch(serialized, /Gilbert|Seattle|local_events|story_of/i);
});

/** Mirrors claim_us_national_history_write — only first writer when today_in_history is null. */
function simulateHistoryClaim(
  store: { today_in_history: typeof SAMPLE_HISTORY | null },
  incoming: typeof SAMPLE_HISTORY
): { claimed: boolean; stored: typeof SAMPLE_HISTORY | null } {
  if (store.today_in_history) {
    return { claimed: false, stored: store.today_in_history };
  }
  store.today_in_history = incoming;
  return { claimed: true, stored: incoming };
}

test("two simultaneous city builds create only one national history write", () => {
  const store: { today_in_history: typeof SAMPLE_HISTORY | null } = {
    today_in_history: null,
  };
  const gilbertAttempt = {
    ...SAMPLE_HISTORY,
    headline: "1969 — Gilbert builder attempt",
  };
  const seattleAttempt = {
    ...SAMPLE_HISTORY,
    headline: "1969 — Seattle builder attempt",
  };

  const gilbert = simulateHistoryClaim(store, gilbertAttempt);
  const seattle = simulateHistoryClaim(store, seattleAttempt);

  assert.equal(gilbert.claimed, true);
  assert.equal(seattle.claimed, false);
  assert.equal(seattle.stored?.headline, gilbert.stored?.headline);
  assert.equal(store.today_in_history?.headline, gilbertAttempt.headline);
});

test("Gilbert and Seattle editions attach the same national daily id on one date", () => {
  const nationalRow = {
    id: "national-shared-2026-07-18",
    edition_date: "2026-07-18",
    country_code: US_NATIONAL_COUNTRY_CODE,
    today_masterpiece: SAMPLE_MASTERPIECE,
    today_in_history: SAMPLE_HISTORY,
  };
  const national = parseUsNationalDailyRow(nationalRow);
  assert.ok(national);

  const gilbertEdition = {
    metroKey: "gilbert-az-metro",
    us_national_daily_id: nationalRow.id,
    masterpieceArtworkId: national?.todayMasterpiece?.artworkId,
    historyHeadline: national?.todayInHistory?.headline,
  };
  const seattleEdition = {
    metroKey: "seattle-wa-metro",
    us_national_daily_id: nationalRow.id,
    masterpieceArtworkId: national?.todayMasterpiece?.artworkId,
    historyHeadline: national?.todayInHistory?.headline,
  };

  assert.equal(gilbertEdition.us_national_daily_id, seattleEdition.us_national_daily_id);
  assert.equal(
    gilbertEdition.masterpieceArtworkId,
    seattleEdition.masterpieceArtworkId
  );
  assert.equal(gilbertEdition.historyHeadline, seattleEdition.historyHeadline);
  assert.notEqual(gilbertEdition.metroKey, seattleEdition.metroKey);
});
