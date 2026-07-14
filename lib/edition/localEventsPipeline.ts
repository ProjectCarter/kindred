/**
 * Local Events pipeline diagnostics — development-only tracing from edition
 * sections through parse/validate to the grid. Never surfaces in production UI.
 */

import type { EditionSection } from "./types";
import {
  parseLocalEventsBody,
  type LocalEventCard,
} from "./localEvents";
import {
  filterValidEvents,
  isValidEventCard,
} from "./localEventsValidation";

export type LocalEventsLoadStatus =
  | "loading"
  | "ready"
  | "quiet_day"
  | "recovering"
  | "failed";

export type LocalEventsPipelineCounts = {
  editionSectionPresent: boolean;
  rawBodyLength: number;
  afterParse: number;
  afterValidation: number;
  afterGridOrder: number;
  passedToComponent: number;
};

function devLog(message: string, data?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log(`[localEvents:pipeline] ${message}`, data ?? {});
  }
}

export {
  isValidEventCard,
  filterValidEvents,
} from "./localEventsValidation";

export function extractEventsFromSections(
  sections: EditionSection[]
): LocalEventCard[] {
  const section = sections.find((s) => s.section_type === "local_events");
  if (!section?.body) return [];
  const parsed = parseLocalEventsBody(section.body);
  return parsed ?? [];
}

export function countEventsInSections(sections: EditionSection[]): number {
  return extractEventsFromSections(sections).length;
}

export function countValidEventsInSections(sections: EditionSection[]): number {
  const raw = extractEventsFromSections(sections);
  return filterValidEvents(raw).valid.length;
}

export function pipelineCountsFromSections(
  sections: EditionSection[],
  gridCount?: number
): LocalEventsPipelineCounts {
  const section = sections.find((s) => s.section_type === "local_events");
  const rawBodyLength = section?.body?.length ?? 0;
  const parsed = section?.body ? parseLocalEventsBody(section.body) : null;
  const afterParse = parsed?.length ?? 0;
  const { valid } = filterValidEvents(parsed ?? []);

  return {
    editionSectionPresent: Boolean(section),
    rawBodyLength,
    afterParse,
    afterValidation: valid.length,
    afterGridOrder: gridCount ?? valid.length,
    passedToComponent: gridCount ?? valid.length,
  };
}

export function logLocalEventsPipeline(
  stage: string,
  counts: LocalEventsPipelineCounts,
  meta?: Record<string, unknown>
): void {
  devLog(stage, {
    ...counts,
    ...meta,
  });
}

export function logLocalEventsRequest(meta: {
  source: string;
  city?: string | null;
  region?: string | null;
  state?: string | null;
  lat?: number | null;
  lon?: number | null;
  editionDate?: string | null;
  editionId?: string | null;
  searchRadius?: string | null;
  dateRange?: string | null;
}): void {
  devLog("request started", meta);
}
