import test from "node:test";
import assert from "node:assert/strict";
import {
  articleIdentityFromSection,
  articleIdentityFromNationalDaily,
  resolveSyncedTodayInHistoryDesk,
  resolvePairedNationalDailyForCache,
} from "./todayInHistorySync.ts";
import { parseUsNationalDailyRow, US_NATIONAL_COUNTRY_CODE } from "./usNationalDaily.ts";
import { resolveTodayInHistoryImage } from "./todayInHistoryImage.ts";
import type { EditionSection } from "./types.ts";

const NADIA_IMAGE = {
  url: "https://upload.wikimedia.org/wikipedia/commons/8/87/Nadia.jpg",
  previewUrl:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Nadia.jpg/330px-Nadia.jpg",
  caption: "Nadia Comăneci",
  credit: "Photograph via Wikipedia (Nadia_Comăneci)",
  source: "wikipedia" as const,
  sourcePageUrl: "https://en.wikipedia.org/wiki/Nadia_Com%C4%83neci",
  assetKind: "photograph" as const,
  license: null,
  matchScore: 28,
  resolvedAt: "2026-07-18T17:21:05.142Z",
};

const NETWORK_NADIA = parseUsNationalDailyRow({
  id: "0580ac54-866e-4649-8d35-331327b12a17",
  edition_date: "2026-07-18",
  country_code: US_NATIONAL_COUNTRY_CODE,
  today_in_history: {
    year: 1976,
    eventText: "Perfect 10",
    headline: "1976 — A Day Worth Remembering",
    body: "Verified Nadia body copy with enough words to fingerprint consistently across the pipeline.",
    teaser: "Verified teaser.",
    sourceNote: "Sourced from Wikipedia",
    image: NADIA_IMAGE,
    selectionMeta: null,
  },
});

const SECTION_1914: EditionSection = {
  id: "section-1914",
  section_type: "today_in_history",
  position: 4,
  headline: "1914 — Aviation Section",
  body: "In 1914, the Aviation Section of the U.S. Signal Corps was established. Verified copy about early military aviation with enough words to fingerprint consistently across the pipeline.",
  source_note: "Sourced from Wikipedia",
};

const SECTION_1976: EditionSection = {
  id: "section-1976",
  section_type: "today_in_history",
  position: 4,
  headline: "1976 — A Day Worth Remembering",
  body: "Verified Nadia body copy with enough words to fingerprint consistently across the pipeline.",
  source_note: "Sourced from Wikipedia",
};

test("1914 section + 1976 national daily rejects image instead of rendering mismatch", () => {
  const desk = resolveSyncedTodayInHistoryDesk({
    section: SECTION_1914,
    nationalDaily: NETWORK_NADIA,
  });

  assert.equal(desk.synced, false);
  assert.equal(desk.image, null);
  assert.match(desk.reason ?? "", /section_year_1914_national_daily_year_1976/);
  assert.equal(desk.article.year, 1914);
});

test("1976 section + matching national daily keeps paired image", () => {
  const desk = resolveSyncedTodayInHistoryDesk({
    section: SECTION_1976,
    nationalDaily: NETWORK_NADIA,
  });

  assert.equal(desk.synced, true);
  assert.equal(desk.image?.url, NADIA_IMAGE.url);
  assert.equal(desk.imageSource, "national_daily");
});

test("paired cache snapshot wins over mismatched network national daily", () => {
  const paired = parseUsNationalDailyRow({
    id: "paired:client_recovery:2026-07-18:1914",
    edition_date: "2026-07-18",
    country_code: US_NATIONAL_COUNTRY_CODE,
    today_in_history: {
      year: 1914,
      eventText: "Aviation Section established",
      headline: SECTION_1914.headline,
      body: SECTION_1914.body,
      teaser: "Aviation teaser",
      sourceNote: "Sourced from Wikipedia",
      image: {
        ...NADIA_IMAGE,
        url: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Aviation_Section.jpg",
        caption: "Aviation Section, U.S. Signal Corps",
      },
      selectionMeta: null,
    },
  });

  const resolved = resolveTodayInHistoryImage({
    section: SECTION_1914,
    nationalDaily: NETWORK_NADIA,
    pairedNationalDaily: paired,
  });

  assert.equal(resolved.synced, true);
  assert.equal(resolved.source, "paired_cache");
  assert.match(resolved.image?.url ?? "", /Aviation_Section/);
});

test("article fingerprints differ between 1914 section and 1976 national daily", () => {
  const sectionArticle = articleIdentityFromSection(SECTION_1914);
  const networkArticle = articleIdentityFromNationalDaily(NETWORK_NADIA);
  assert.notEqual(sectionArticle.fingerprint, networkArticle?.fingerprint);
});

test("resolvePairedNationalDailyForCache drops mismatched existing paired snapshot", () => {
  const stalePaired = parseUsNationalDailyRow({
    id: "paired:stale",
    edition_date: "2026-07-18",
    country_code: US_NATIONAL_COUNTRY_CODE,
    today_in_history: {
      year: 1914,
      eventText: "Aviation",
      headline: SECTION_1914.headline,
      body: SECTION_1914.body,
      teaser: "Aviation teaser",
      sourceNote: "Sourced from Wikipedia",
      image: NADIA_IMAGE,
      selectionMeta: null,
    },
  });

  const resolved = resolvePairedNationalDailyForCache({
    sections: [SECTION_1976],
    networkDaily: NETWORK_NADIA,
    existingPaired: stalePaired,
  });

  assert.equal(resolved?.id, NETWORK_NADIA?.id);
});

test("national daily from wrong edition date is ignored during sync", () => {
  const wrongDate = parseUsNationalDailyRow({
    ...NETWORK_NADIA!,
    id: "wrong-date",
    edition_date: "2026-07-17",
  });

  const desk = resolveSyncedTodayInHistoryDesk({
    section: SECTION_1976,
    nationalDaily: wrongDate,
    editionDate: "2026-07-18",
  });

  assert.equal(desk.synced, false);
  assert.equal(desk.image, null);
});
