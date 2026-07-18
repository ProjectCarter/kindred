import test from "node:test";
import assert from "node:assert/strict";
import {
  filterUniqueFacts,
  normalizeHistoryPlaceSnapshot,
} from "./normalize.ts";

/** Minimal v1.0 frozen snapshot — no v1.1 structured fields. */
function v1Place(
  id: string,
  slug: string,
  placeName: string,
  category: "landmark" | "museum" | "historic_district" | "historic_home"
) {
  return {
    id,
    slug,
    placeName,
    category,
    categoryLabel: "Historic place",
    teaser: `${placeName} teaser.`,
    body: [
      `Introduction paragraph for ${placeName}.`,
      `Second paragraph for ${placeName}.`,
      `Third paragraph for ${placeName}.`,
    ],
    modules: [
      {
        id: "why_it_matters",
        label: "Why it matters",
        body: `Why ${placeName} matters today.`,
      },
      {
        id: "interesting_facts",
        label: "Interesting facts",
        body: `A verified fact about ${placeName} that readers may not know.`,
      },
    ],
    closingNote: `Closing thought for ${placeName}.`,
    heroImageUrl: "https://example.com/photo.jpg",
    lat: 33.35,
    lon: -111.79,
    address: "123 Main St",
    city: "Gilbert",
    state: "AZ",
    officialWebsite: "https://www.gilbertaz.gov/explore-gilbert/history",
    nearbyPlaces: ["Heritage District"],
  };
}

const GILBERT_V1_SLUGS = [
  ["place-water-tower", "gilbert-water-tower", "Gilbert Water Tower", "landmark"],
  ["place-museum", "gilbert-historical-museum", "Gilbert Historical Museum", "museum"],
  ["place-heritage", "heritage-district", "Heritage District", "historic_district"],
  ["place-bank", "bank-of-gilbert", "Bank of Gilbert", "historic_home"],
  ["place-jail", "gilberts-first-jail", "Gilbert's First Jail", "landmark"],
  ["place-market", "liberty-market", "Liberty Market", "landmark"],
] as const;

const V1_PLACE = v1Place(
  "place-1",
  "gilbert-water-tower",
  "Gilbert Water Tower",
  "landmark"
);

test("normalizeHistoryPlaceSnapshot fills missing v1.1 arrays from v1.0 body/modules", () => {
  const normalized = normalizeHistoryPlaceSnapshot(V1_PLACE);

  assert.ok(Array.isArray(normalized.theStory));
  assert.equal(normalized.theStory.length, 2);
  assert.equal(
    normalized.editorialIntroduction,
    "Introduction paragraph for Gilbert Water Tower."
  );
  assert.equal(
    normalized.whyItMatters,
    "Why Gilbert Water Tower matters today."
  );
  assert.ok(Array.isArray(normalized.lookingCloser));
  assert.equal(normalized.lookingCloser.length, 0);
  assert.ok(Array.isArray(normalized.didYouKnow));
  assert.ok(normalized.didYouKnow.length >= 1);
  assert.ok(Array.isArray(normalized.timeline));
  assert.equal(normalized.timeline.length, 0);
  assert.ok(Array.isArray(normalized.nearbyLinks));
  assert.equal(normalized.nearbyLinks.length, 1);
  assert.ok(Array.isArray(normalized.designations));
  assert.equal(normalized.designations.length, 0);
});

test("filterUniqueFacts never throws on v1.0 normalized snapshot", () => {
  const normalized = normalizeHistoryPlaceSnapshot(V1_PLACE);
  assert.doesNotThrow(() => filterUniqueFacts(normalized));
  const facts = filterUniqueFacts(normalized);
  assert.ok(Array.isArray(facts));
});

test("filterUniqueFacts tolerates explicitly undefined v1.1 fields", () => {
  const broken = normalizeHistoryPlaceSnapshot({
    ...V1_PLACE,
    theStory: undefined as unknown as string[],
    didYouKnow: undefined as unknown as string[],
    lookingCloser: undefined as unknown as string[],
    timeline: undefined as unknown as [],
    nearbyLinks: undefined as unknown as [],
    designations: undefined as unknown as string[],
  });

  assert.doesNotThrow(() => filterUniqueFacts(broken));
  assert.ok(Array.isArray(broken.theStory));
});

test("all six Gilbert v1.0 places normalize for reader open", () => {
  for (const [id, slug, name, category] of GILBERT_V1_SLUGS) {
    const raw = v1Place(id, slug, name, category);
    assert.doesNotThrow(() => {
      const normalized = normalizeHistoryPlaceSnapshot(raw);
      assert.ok(Array.isArray(normalized.theStory));
      assert.ok(Array.isArray(normalized.didYouKnow));
      assert.ok(Array.isArray(normalized.lookingCloser));
      assert.ok(Array.isArray(normalized.timeline));
      assert.ok(Array.isArray(normalized.nearbyLinks));
      assert.ok(Array.isArray(normalized.designations));
      filterUniqueFacts(normalized);
    });
  }
});

test("v1.0 crash field theStory is derived when missing", () => {
  const raw = {
    ...V1_PLACE,
    theStory: undefined,
    didYouKnow: undefined,
    lookingCloser: undefined,
    timeline: undefined,
    nearbyLinks: undefined,
    designations: undefined,
  };

  const normalized = normalizeHistoryPlaceSnapshot(
    raw as unknown as typeof V1_PLACE
  );
  assert.ok(Array.isArray(normalized.theStory));
  assert.ok(normalized.theStory.length > 0);
  assert.doesNotThrow(() => filterUniqueFacts(normalized));
});
