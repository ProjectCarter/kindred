/**
 * Edition Pipeline V2 Phase 4 — cross-city QA target metros.
 */

import type { AuditCitySpec } from "./nationwideAudit.ts";

export type Phase4CitySpec = AuditCitySpec & {
  /** Catalog metro when reader city differs (e.g. Gilbert → phoenix-az catalog). */
  catalogMetroKey?: string;
};

export const PHASE4_QA_CITIES: Phase4CitySpec[] = [
  {
    label: "Gilbert",
    city: "Gilbert",
    state: "AZ",
    region: "Arizona",
    lat: 33.2748,
    lon: -111.7769,
    expectedMetroKey: "gilbert-az",
    catalogMetroKey: "phoenix-az",
    forbiddenBleed: ["Seattle", "Space Needle", "Chicago, IL", "Miami Beach", "Cincinnati, OH"],
  },
  {
    label: "Phoenix",
    city: "Phoenix",
    state: "AZ",
    region: "Arizona",
    lat: 33.4484,
    lon: -112.074,
    expectedMetroKey: "phoenix-az",
    forbiddenBleed: ["Seattle", "Space Needle", "Chicago, IL", "Miami Beach", "Gilbert Heritage"],
  },
  {
    label: "Seattle",
    city: "Seattle",
    state: "WA",
    region: "Washington",
    lat: 47.6062,
    lon: -122.3321,
    expectedMetroKey: "seattle-wa",
    forbiddenBleed: ["Gilbert", "Phoenix, AZ", "Miami Beach", "Chicago, IL"],
  },
  {
    label: "Chicago",
    city: "Chicago",
    state: "IL",
    region: "Illinois",
    lat: 41.8781,
    lon: -87.6298,
    expectedMetroKey: "chicago-il",
    forbiddenBleed: ["Gilbert", "Seattle", "Phoenix, AZ", "Miami Beach"],
  },
  {
    label: "Miami",
    city: "Miami",
    state: "FL",
    region: "Florida",
    lat: 25.7617,
    lon: -80.1918,
    expectedMetroKey: "miami-fl",
    forbiddenBleed: ["Gilbert", "Seattle", "Denver, CO", "Chicago, IL"],
  },
  {
    label: "Cincinnati",
    city: "Cincinnati",
    state: "OH",
    region: "Ohio",
    lat: 39.1031,
    lon: -84.512,
    expectedMetroKey: "cincinnati-oh",
    forbiddenBleed: ["Gilbert", "Seattle", "Phoenix, AZ", "Miami Beach"],
  },
  {
    label: "New York",
    city: "New York",
    state: "NY",
    region: "New York",
    lat: 40.7128,
    lon: -74.006,
    expectedMetroKey: "new-york-ny",
    forbiddenBleed: ["Gilbert", "Seattle", "Phoenix, AZ", "Miami Beach"],
  },
];

export function phase4CityByLabel(label: string): Phase4CitySpec | undefined {
  return PHASE4_QA_CITIES.find(
    (c) => c.label.toLowerCase() === label.trim().toLowerCase()
  );
}

export function phase4CityByMetroKey(metroKey: string): Phase4CitySpec | undefined {
  return PHASE4_QA_CITIES.find((c) => c.expectedMetroKey === metroKey);
}
