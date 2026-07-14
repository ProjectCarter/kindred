import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isDisambiguationPage,
  MIN_KNOWLEDGE_CONFIDENCE,
  normalizeTitle,
  titleMatchScore,
} from "./confidence.ts";
import { isWikipediaEligible } from "./eligibility.ts";
import {
  buildOnThisDaySearchQuery,
  synthesizeEditorialSummary,
} from "./synthesize.ts";
import { getKnowledgeProviders } from "./index.ts";

Deno.test("wikipedia provider is registered when enabled", () => {
  const providers = getKnowledgeProviders();
  assertEquals(providers.some((p) => p.id === "wikipedia"), true);
});

Deno.test("eligibility rejects local restaurants and coffee shops", () => {
  assertEquals(
    isWikipediaEligible({
      context: "discovery_briefing",
      title: "Joe's Coffee",
      discoveryCategory: "coffee",
      venueCategories: ["Coffee Shop"],
    }),
    false
  );
  assertEquals(
    isWikipediaEligible({
      context: "discovery_briefing",
      title: "Local Grill",
      discoveryCategory: "restaurants",
      venueCategories: ["American Restaurant"],
    }),
    false
  );
});

Deno.test("eligibility allows museums and historic sites", () => {
  assertEquals(
    isWikipediaEligible({
      context: "discovery_briefing",
      title: "Heard Museum",
      discoveryCategory: "museums",
      venueCategories: ["Museum"],
    }),
    true
  );
  assertEquals(
    isWikipediaEligible({
      context: "discovery_briefing",
      title: "Montezuma Castle",
      discoveryCategory: "hiking",
      venueCategories: ["Historic Site"],
    }),
    true
  );
});

Deno.test("eligibility allows news persons but not companies", () => {
  assertEquals(
    isWikipediaEligible({
      context: "news_entity",
      title: "Albert Einstein",
      entityKind: "person",
    }),
    true
  );
  assertEquals(
    isWikipediaEligible({
      context: "news_entity",
      title: "Starbucks",
      entityKind: "company",
    }),
    false
  );
});

Deno.test("confidence scoring prefers exact title matches", () => {
  assertEquals(titleMatchScore("Heard Museum", "Heard Museum"), 1);
  assertEquals(titleMatchScore("Heard Museum", "heard museum"), 1);
  assertEquals(
    titleMatchScore("Heard Museum", "Museum of unrelated things") <
      MIN_KNOWLEDGE_CONFIDENCE,
    true
  );
});

Deno.test("disambiguation pages are rejected", () => {
  assertEquals(
    isDisambiguationPage("Spring (disambiguation)", "Spring may refer to:"),
    true
  );
  assertEquals(
    isDisambiguationPage("Heard Museum", "The Heard Museum is a museum in Phoenix."),
    false
  );
});

Deno.test("synthesize produces concise editorial summaries", () => {
  const long =
    "The Heard Museum is a private, not-for-profit museum in Phoenix, Arizona, " +
    "United States, dedicated to the advancement of American Indian art. " +
    "It presents the stories of American Indian people from a first-person perspective.";
  const summary = synthesizeEditorialSummary(long);
  assertEquals(summary.length <= 280, true);
  assertEquals(summary.includes("Heard Museum"), true);
});

Deno.test("on-this-day search query extracts subject from event text", () => {
  const query = buildOnThisDaySearchQuery(
    "Born: Albert Einstein, German-born physicist (b. 1879)"
  );
  assertEquals(normalizeTitle(query).includes("albert einstein"), true);
});
