import test from "node:test";
import assert from "node:assert/strict";
import {
  auditEditionSectionRow,
  buildEditionDeskGapReport,
  filterEditionSectionRowsByMarket,
} from "./editionSectionAudit.ts";
import { resolveEditionMarket } from "./resolveEditionMarket.ts";

const SEATTLE = {
  city: "Seattle",
  state: "WA",
  lat: 47.6062,
  lon: -122.3321,
};

const seattleMarket = resolveEditionMarket(SEATTLE)!;

test("auditEditionSectionRow flags Chandler events in Seattle build", () => {
  const body = JSON.stringify({
    events: [
      { name: "Farmers Market", city: "Chandler", venue: "Downtown" },
      { name: "Art Walk", city: "Gilbert", venue: "Heritage District" },
    ],
  });
  const audit = auditEditionSectionRow({
    row: {
      edition_id: "ed-1",
      section_type: "local_events",
      position: 3,
      headline: "Events",
      body,
    },
    market: seattleMarket,
    catalogMetroKey: "seattle-wa",
    anchor: SEATTLE,
  });

  assert.equal(audit.sectionType, "local_events");
  assert.equal(audit.metroKey, "seattle-wa");
  assert.equal(audit.catalogMetroKey, "seattle-wa");
  assert.equal(audit.sourceCatalog, "events_catalog:seattle-wa");
  assert.equal(audit.crossMetroRejected, true);
  assert.ok(audit.rejectReason?.includes("Chandler") || audit.rejectReason?.includes("Gilbert"));
});

test("filterEditionSectionRowsByMarket keeps metro-local sections only", () => {
  const seattleEventsBody = JSON.stringify({
    events: [{ name: "Pike Place Tour", city: "Seattle", venue: "Pike Place" }],
  });
  const chandlerEventsBody = JSON.stringify({
    events: [{ name: "Chandler Fest", city: "Chandler", venue: "Downtown" }],
  });

  const { kept, rejected } = filterEditionSectionRowsByMarket({
    rows: [
      {
        edition_id: "ed-1",
        section_type: "greeting",
        position: 0,
        headline: "Good morning",
        body: "Welcome to Seattle.",
      },
      {
        edition_id: "ed-1",
        section_type: "local_events",
        position: 3,
        headline: "Events",
        body: seattleEventsBody,
      },
      {
        edition_id: "ed-1",
        section_type: "local_events",
        position: 4,
        headline: "Wrong city",
        body: chandlerEventsBody,
      },
    ],
    market: seattleMarket,
    catalogMetroKey: "seattle-wa",
    anchor: SEATTLE,
  });

  assert.equal(kept.length, 2);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0]?.sectionType, "local_events");
});

test("auditEditionSectionRow rejects story_of with wrong metroKey in source_note", () => {
  const audit = auditEditionSectionRow({
    row: {
      edition_id: "ed-1",
      section_type: "story_of",
      position: 5,
      headline: "The Story of Gilbert",
      body: "Gilbert grew from farmland…",
      source_note: JSON.stringify({ metroKey: "phoenix-az" }),
    },
    market: seattleMarket,
    catalogMetroKey: "seattle-wa",
    anchor: SEATTLE,
  });

  assert.equal(audit.crossMetroRejected, true);
  assert.match(audit.rejectReason ?? "", /story_of_metro_mismatch/);
});

test("buildEditionDeskGapReport explains missing discovery desks", () => {
  const report = buildEditionDeskGapReport({
    city: "Seattle",
    catalogMetroKey: "seattle-wa",
    market: seattleMarket,
    catalogBootstrap: {
      eventsCatalogBootstrapped: false,
      activitiesCatalogBootstrapped: false,
      foodDrinkCatalogBootstrapped: false,
    },
    leadStoryPresent: false,
    topStoriesCount: 0,
    banditsPickPresent: false,
    morningHeroPresent: false,
    localEventsCount: 0,
    discoverySurfaces: {},
    localPlacesCount: 0,
    localPlacesFilteredCount: 0,
  });

  assert.equal(report.localNews.present, false);
  assert.equal(report.banditsPick.present, false);
  assert.equal(report.morningHero.present, false);
  assert.equal(report.activities.present, false);
  assert.equal(report.recommendations.present, false);
  assert.match(report.localEvents.reason ?? "", /events_catalog_not_bootstrapped/);
});
