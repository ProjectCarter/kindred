import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeVenueConfidenceFromFields,
  mergeFieldObservation,
  fieldSourceLabel,
} from "../editorial/sourceManager.ts";

Deno.test("mergeFieldObservation — official website wins over Foursquare for hours", () => {
  const observedAt = "2026-07-16T12:00:00Z";

  const foursquare = mergeFieldObservation("hours", null, {
    value: "8AM–8PM",
    source: "foursquare",
    confidence: 75,
    observedAt,
  });

  const merged = mergeFieldObservation("hours", foursquare.provenance, {
    value: "8AM–9PM",
    source: "official_website",
    confidence: 99,
    observedAt,
  });

  assertEquals(merged.provenance.value, "8AM–9PM");
  assertEquals(merged.provenance.source, "official_website");
  assertEquals(merged.provenance.confidence, 99);
  assertEquals(merged.changed, true);
  assertEquals(merged.provenance.alternatives.length, 1);
  assertEquals(merged.provenance.alternatives[0]?.value, "8AM–8PM");
});

Deno.test("mergeFieldObservation — keeps higher-confidence value when Google disagrees", () => {
  const observedAt = "2026-07-16T12:00:00Z";
  const current = mergeFieldObservation("hours", null, {
    value: "8AM–9PM",
    source: "google_places",
    confidence: 85,
    observedAt,
  }).provenance;

  const kept = mergeFieldObservation("hours", current, {
    value: "8AM–8PM",
    source: "foursquare",
    confidence: 75,
    observedAt,
  });

  assertEquals(kept.provenance.value, "8AM–9PM");
  assertEquals(kept.provenance.source, "google_places");
  assertEquals(kept.changed, false);
});

Deno.test("fieldSourceLabel returns human-readable attribution", () => {
  const fieldSources = {
    hours: {
      value: "8AM–9PM",
      source: "official_website" as const,
      confidence: 99,
      verifiedAt: "2026-07-16T12:00:00Z",
      alternatives: [],
    },
  };
  assertEquals(fieldSourceLabel(fieldSources, "hours"), "Official Website");
});

Deno.test("computeVenueConfidenceFromFields aggregates weighted field trust", () => {
  const score = computeVenueConfidenceFromFields({
    name: {
      value: "Joe's Coffee",
      source: "foursquare",
      confidence: 75,
      verifiedAt: "2026-07-16T12:00:00Z",
      alternatives: [],
    },
    website: {
      value: "https://example.com",
      source: "official_website",
      confidence: 99,
      verifiedAt: "2026-07-16T12:00:00Z",
      alternatives: [],
    },
  });
  assertEquals(score >= 70 && score <= 100, true);
});
