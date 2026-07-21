import test from "node:test";
import assert from "node:assert/strict";
import {
  assessLocalNewsGeographicEligibility,
  hasAcceptableFallbackSourceMaterial,
  hasMinimumLeadSourceMaterial,
} from "./localNewsGeographicEligibility.ts";

const GILBERT = {
  city: "Gilbert",
  state: "AZ",
  region: "AZ",
  metroKey: "phoenix-az",
};

test("rejects Los Angeles Dodgers story for Gilbert edition", () => {
  const geo = assessLocalNewsGeographicEligibility({
    id: "dodgers-1",
    title: "Dodgers Change Pitching Order After Rain Rescheduling",
    description:
      "Inclement weather postponed their game Saturday. Yoshinobu Yamamoto will start the first game of the Dodgers’ doubleheader on Sunday.",
    source: "Los Angeles Times",
    category: "sports",
    score: 42,
    place: GILBERT,
  });
  assert.equal(geo.eligible, false);
  assert.match(geo.rejectionReason ?? "", /Dodgers|out-of-state/i);
});

test("accepts Arizona Diamondbacks as in-state sports fallback", () => {
  const geo = assessLocalNewsGeographicEligibility({
    id: "dbacks-1",
    title: "Diamondbacks rally past Padres in extra innings",
    description:
      "The Arizona Diamondbacks scored twice in the tenth inning at Chase Field on Saturday night.",
    source: "AZCentral",
    category: "sports",
    score: 38,
    place: GILBERT,
  });
  assert.equal(geo.eligible, true);
  assert.equal(geo.geographicTier, "state_sports");
});

test("requires minimum lead source material", () => {
  assert.equal(
    hasMinimumLeadSourceMaterial({
      title: "Rockets sign veteran guard Smith",
      description: "Rockets sign veteran guard Smith",
    }),
    false
  );
  assert.equal(
    hasMinimumLeadSourceMaterial({
      title: "Council approves park expansion",
      description:
        "Gilbert leaders voted Tuesday to expand Freestone Park with new trails after neighbors testified. The vote followed months of public comment.",
    }),
    true
  );
});

test("rejects Tampa Bay Rays story for Gilbert edition", () => {
  const geo = assessLocalNewsGeographicEligibility({
    id: "rays-1",
    title: "Tampa Bay Rays Drop Third Straight, Lose Series to Red Sox After All-Star Break",
    description:
      "The All-Star Break, watching their AL East lead shrink following another loss to the Red Sox. Despite home runs from Victor Mesa Jr. and Jonny DeLuca, Tampa Bay now faces growing urgency.",
    source: "Roundtable.io",
    category: "sports",
    score: 40,
    place: GILBERT,
  });
  assert.equal(geo.eligible, false);
  assert.match(geo.rejectionReason ?? "", /Rays|out-of-state/i);
});

test("accepts shorter fallback source when distinct from title", () => {
  assert.equal(
    hasAcceptableFallbackSourceMaterial({
      title: "Heat advisory issued for Phoenix metro",
      description:
        "The National Weather Service issued a heat advisory for the Phoenix metro area through Monday evening.",
    }),
    true
  );
});
