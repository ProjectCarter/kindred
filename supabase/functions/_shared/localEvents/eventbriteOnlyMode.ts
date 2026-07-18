/**
 * TEMPORARY — Eventbrite-only Local Events test mode.
 * Enable with LOCAL_EVENTS_EVENTBRITE_ONLY=true on generate-edition.
 * Must remain OFF for production U.S. markets (Seattle gold standard and beyond).
 */

import { KINDRED_LOCAL_RADIUS_KM } from "../editorial/editorialStandard.ts";
import { haversineKm } from "../discovery/geo.ts";
import {
  attachEventHorizon,
  parseEventStartDate,
  resolveEventHorizon,
} from "./horizon.ts";
import type { LocalEvent, LocalEventLocation } from "./provider.ts";

export function isEventbriteOnlyMode(): boolean {
  const v = Deno.env.get("LOCAL_EVENTS_EVENTBRITE_ONLY")?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export type EventbriteRejectionReason =
  | "missing_date"
  | "beyond_horizon"
  | "beyond_distance"
  | "missing_required";

export type EventbriteRejection = {
  title: string;
  url: string;
  reason: EventbriteRejectionReason;
};

export type EventbriteQualificationReport = {
  mode: "eventbrite_only";
  totalReturned: number;
  totalParsed: number;
  rejectedDate: number;
  rejectedDistance: number;
  rejectedMissing: number;
  persisted: number;
  seeAllAvailable: number;
  homepageShown: number;
  rejections: EventbriteRejection[];
};

function hasRequiredFields(event: LocalEvent): boolean {
  return Boolean(
    event.name?.trim() &&
      event.sourceUrl?.trim() &&
      event.venue?.trim() &&
      event.sourceId === "eventbrite"
  );
}

function distanceRejection(
  event: LocalEvent,
  location: LocalEventLocation
): "beyond_distance" | "missing_required" | null {
  const lat = event.lat;
  const lon = event.lon;
  if (
    typeof lat !== "number" ||
    !Number.isFinite(lat) ||
    typeof lon !== "number" ||
    !Number.isFinite(lon)
  ) {
    return "missing_required";
  }
  const km = haversineKm(location.lat, location.lon, lat, lon);
  return km <= KINDRED_LOCAL_RADIUS_KM ? null : "beyond_distance";
}

function passesDateGate(event: LocalEvent, now: Date): EventbriteRejectionReason | null {
  if (!event.startDateIso?.trim()) {
    const parsed = parseEventStartDate(event.startDateTime, null, now);
    if (!parsed) return "missing_date";
  }
  const withHorizon = attachEventHorizon(event, now);
  const bucket = withHorizon.horizonBucket ?? resolveEventHorizon(withHorizon, now);
  if (bucket === "beyond") return "beyond_horizon";
  return null;
}

/** Basic date + distance + required-field gate — no editorial scoring. */
export function qualifyEventbriteEvents(
  events: LocalEvent[],
  location: LocalEventLocation,
  now: Date
): { qualified: LocalEvent[]; report: EventbriteQualificationReport } {
  const rejections: EventbriteRejection[] = [];
  let rejectedDate = 0;
  let rejectedDistance = 0;
  let rejectedMissing = 0;
  const qualified: LocalEvent[] = [];

  for (const raw of events) {
    const title = raw.name?.trim() || "(untitled)";
    const url = raw.sourceUrl?.trim() || "";

    if (!hasRequiredFields(raw)) {
      rejectedMissing += 1;
      rejections.push({ title, url, reason: "missing_required" });
      continue;
    }

    const dateReason = passesDateGate(raw, now);
    if (dateReason) {
      rejectedDate += 1;
      rejections.push({ title, url, reason: dateReason });
      continue;
    }

    const distanceReason = distanceRejection(raw, location);
    if (distanceReason) {
      if (distanceReason === "beyond_distance") rejectedDistance += 1;
      else rejectedMissing += 1;
      rejections.push({ title, url, reason: distanceReason });
      continue;
    }

    const withHorizon = attachEventHorizon(raw, now);
    qualified.push({
      ...withHorizon,
      sourceId: "eventbrite",
      sourceName: "Eventbrite",
      sourceTier: "aggregator",
    });
  }

  const persisted = qualified.length;
  const report: EventbriteQualificationReport = {
    mode: "eventbrite_only",
    totalReturned: events.length,
    totalParsed: events.length,
    rejectedDate,
    rejectedDistance,
    rejectedMissing,
    persisted,
    seeAllAvailable: persisted,
    homepageShown: Math.min(8, persisted),
    rejections,
  };

  console.log("[localEvents:eventbriteOnly] qualification", {
    totalReturned: report.totalReturned,
    totalParsed: report.totalParsed,
    rejectedDate: report.rejectedDate,
    rejectedDistance: report.rejectedDistance,
    rejectedMissing: report.rejectedMissing,
    persisted: report.persisted,
    seeAllAvailable: report.seeAllAvailable,
    homepageShown: report.homepageShown,
  });

  for (const rejection of rejections) {
    console.log("[localEvents:eventbriteOnly] rejected", rejection);
  }

  return { qualified, report };
}
