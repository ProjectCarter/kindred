import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseHistoricalImageAsset,
  resolveTodayInHistoryImage,
  shouldRenderTodayInHistoryImage,
  todayInHistoryImageFromNationalDaily,
} from "./todayInHistoryImage.ts";
import { parseUsNationalDailyRow, US_NATIONAL_COUNTRY_CODE } from "./usNationalDaily.ts";
import {
  articleIdentityFromSection,
  buildTodayInHistoryDeskSync,
  imageIdentityFromAsset,
} from "./todayInHistorySync.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const todaySectionSource = readFileSync(
  join(__dirname, "../../components/TodayInHistorySection.tsx"),
  "utf8"
);
const editionReaderSource = readFileSync(
  join(__dirname, "../../components/EditionReader.tsx"),
  "utf8"
);

const SAMPLE_IMAGE = {
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

const NATIONAL_ROW = {
  id: "0580ac54-866e-4649-8d35-331327b12a17",
  edition_date: "2026-07-18",
  country_code: US_NATIONAL_COUNTRY_CODE,
  today_in_history: {
    year: 1976,
    eventText: "Perfect 10",
    headline: "1976 — A Day Worth Remembering",
    body: "Verified body copy.",
    teaser: "Verified teaser.",
    sourceNote: "Sourced from Wikipedia",
    image: SAMPLE_IMAGE,
    selectionMeta: null,
  },
};

test("national Today in History image resolves when section matches national daily", () => {
  const record = parseUsNationalDailyRow(NATIONAL_ROW);
  const section: import("./types.ts").EditionSection = {
    id: "s1",
    section_type: "today_in_history",
    position: 4,
    headline: "1976 — A Day Worth Remembering",
    body: "Verified body copy.",
    source_note: "Sourced from Wikipedia",
  };
  const resolved = resolveTodayInHistoryImage({ section, nationalDaily: record });

  assert.equal(resolved.source, "national_daily");
  assert.equal(resolved.synced, true);
  assert.equal(
    resolved.image?.url,
    "https://upload.wikimedia.org/wikipedia/commons/8/87/Nadia.jpg"
  );
  assert.equal(shouldRenderTodayInHistoryImage(resolved.image, resolved), true);
});

test("mismatched section year omits national daily image", () => {
  const record = parseUsNationalDailyRow(NATIONAL_ROW);
  const section: import("./types.ts").EditionSection = {
    id: "s2",
    section_type: "today_in_history",
    position: 4,
    headline: "1914 — Aviation Section",
    body: "In 1914, the Aviation Section was established.",
    source_note: "Sourced from Wikipedia",
  };
  const resolved = resolveTodayInHistoryImage({ section, nationalDaily: record });
  assert.equal(resolved.synced, false);
  assert.equal(resolved.image, null);
});

test("attribution credit is preserved on national image", () => {
  const record = parseUsNationalDailyRow(NATIONAL_ROW);
  const image = todayInHistoryImageFromNationalDaily(record);
  assert.match(image?.credit ?? "", /Wikipedia/);
  assert.match(todaySectionSource, /image\?\.credit/);
});

test("missing or invalid image data omits cleanly", () => {
  assert.equal(parseHistoricalImageAsset(null), null);
  assert.equal(
    parseHistoricalImageAsset({ ...SAMPLE_IMAGE, url: "" }),
    null
  );
  assert.equal(
    parseHistoricalImageAsset({ ...SAMPLE_IMAGE, source: "unknown" }),
    null
  );
  assert.equal(
    resolveTodayInHistoryImage({ nationalDaily: null }).image,
    null
  );
  assert.equal(shouldRenderTodayInHistoryImage(null), false);
  assert.doesNotMatch(todaySectionSource, /imagePlaceholder/);
});

test("knowledge image renders when desk sync metadata matches section", () => {
  const section: import("./types.ts").EditionSection = {
    id: "s3",
    section_type: "today_in_history",
    position: 4,
    headline: "1976 — A Day Worth Remembering",
    body: "Verified body copy.",
    source_note: "Sourced from Wikipedia",
  };
  const article = articleIdentityFromSection(section);
  const imageIdentity = imageIdentityFromAsset(SAMPLE_IMAGE, {
    source: "knowledge",
    year: 1976,
  });
  const knowledge = {
    version: 1 as const,
    generatedAt: "2026-07-18T00:00:00.000Z",
    editionDate: "2026-07-18",
    location: { city: null, region: null, state: null },
    byStoryKey: {},
    highlights: [],
    editorBrief: "",
    selectionMeta: { storyCount: 0, facetCount: 0, editorNotes: [] },
    providerGrounding: {
      onThisDayImage: SAMPLE_IMAGE,
      onThisDaySync: buildTodayInHistoryDeskSync({
        year: 1976,
        eventText: "Perfect 10",
        articleFingerprint: article.fingerprint,
        imageFingerprint: imageIdentity.fingerprint,
        source: "client_recovery",
      }),
    },
  };

  const resolved = resolveTodayInHistoryImage({
    section,
    knowledge,
    nationalDaily: parseUsNationalDailyRow({
      ...NATIONAL_ROW,
      id: "other-national-id",
      today_in_history: {
        ...NATIONAL_ROW.today_in_history,
        image: { ...SAMPLE_IMAGE, url: "https://example.com/other.jpg" },
      },
    }),
  });

  assert.equal(resolved.source, "knowledge");
  assert.equal(resolved.synced, true);
  assert.equal(resolved.image?.url, SAMPLE_IMAGE.url);
});

test("image failure path does not block article section render", () => {
  assert.match(editionReaderSource, /TodayInHistorySection/);
  assert.match(editionReaderSource, /section=\{history\}/);
  assert.match(editionReaderSource, /fetchUsNationalDailyByDate/);
});

test("EditionReader resolves synced image against section record", () => {
  assert.match(editionReaderSource, /resolveTodayInHistoryImage/);
  assert.match(editionReaderSource, /pairedNationalDaily/);
  assert.match(editionReaderSource, /todayInHistorySyncTrace|logTodayInHistorySyncTrace/);
});
