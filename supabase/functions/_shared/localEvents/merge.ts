/**
 * Merge events from multiple trusted sources — dedupe with source priority.
 */

import type { LocalEvent } from "./provider.ts";
import { trustScoreForSource } from "./sources/types.ts";

function significantWords(name: string): Set<string> {
  const stop = new Set([
    "the", "a", "an", "at", "in", "on", "of", "and", "with", "to", "for",
  ]);
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w))
  );
}

function wordOverlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function eventQualityRank(event: LocalEvent): number {
  let score = trustScoreForSource(event.sourceId);
  if (event.imageUrl?.trim()) score += 4;
  if (event.sourceUrl?.trim()) score += 2;
  if (event.venue?.trim() && event.venue.toLowerCase() !== "venue tba") score += 2;
  if (event.startDateTime && !/tba/i.test(event.startDateTime)) score += 2;
  return score;
}

function pickPreferred(existing: LocalEvent, incoming: LocalEvent): LocalEvent {
  const existingRank = eventQualityRank(existing);
  const incomingRank = eventQualityRank(incoming);
  let winner: LocalEvent;
  if (incomingRank > existingRank) winner = incoming;
  else if (incomingRank < existingRank) winner = existing;
  else winner = (incoming.imageUrl && !existing.imageUrl) ? incoming : existing;

  const loser = winner === existing ? incoming : existing;
  const officialWebsite =
    winner.officialWebsite?.trim() || loser.officialWebsite?.trim() || null;

  const existingIso = existing.startDateIso?.trim() || null;
  const incomingIso = incoming.startDateIso?.trim() || null;
  let dateSourceConflict =
    Boolean(existingIso && incomingIso && existingIso !== incomingIso);

  // Trust verified Ticketmaster API schedules over secondary aggregator scrapes.
  if (
    winner.dateSourceType === "official_ticketing_page" &&
    winner.startDateIso?.trim()
  ) {
    dateSourceConflict = false;
  }

  const merged: LocalEvent = {
    ...winner,
    ...(officialWebsite ? { officialWebsite } : {}),
    ...(dateSourceConflict ? { dateSourceConflict: true } : {}),
  };
  return merged;
}

/**
 * Exact + fuzzy dedupe across all sources. When two listings match,
 * keep the higher-trust / more complete record.
 */
export function mergeEventsFromSources(sources: LocalEvent[][]): LocalEvent[] {
  const flat = sources.flat();
  const byExactKey = new Map<string, LocalEvent>();
  const wordsByVenue = new Map<string, Array<{ words: Set<string>; key: string }>>();

  for (const event of flat) {
    const venueKey = event.venue.toLowerCase().trim();
    const scheduleKey = event.startDateTime.toLowerCase().trim();
    const key = `${event.name.toLowerCase().trim()}__${venueKey}__${scheduleKey}`;

    if (byExactKey.has(key)) {
      byExactKey.set(key, pickPreferred(byExactKey.get(key)!, event));
      continue;
    }

    const words = significantWords(event.name);
    const venueEntries = wordsByVenue.get(venueKey) ?? [];
    let fuzzyKey: string | null = null;
    for (const entry of venueEntries) {
      if (wordOverlap(words, entry.words) >= 0.75) {
        fuzzyKey = entry.key;
        break;
      }
    }

    if (fuzzyKey && byExactKey.has(fuzzyKey)) {
      const merged = pickPreferred(byExactKey.get(fuzzyKey)!, event);
      byExactKey.set(fuzzyKey, merged);
      continue;
    }

    byExactKey.set(key, event);
    venueEntries.push({ words, key });
    wordsByVenue.set(venueKey, venueEntries);
  }

  return [...byExactKey.values()];
}

/** @deprecated Use mergeEventsFromSources — kept for Serp-only paths in tests. */
export function dedupeEvents(events: LocalEvent[]): LocalEvent[] {
  return mergeEventsFromSources([events]);
}
