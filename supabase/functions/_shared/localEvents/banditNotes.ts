/**
 * Bandit's Note + verified event article body — generated fresh per event.
 * Editorial law: docs/editorial/EVENT_EDITORIAL_STANDARD.md
 * No template library. No fallback canned sentences.
 */

import type { LocalEvent } from "./provider.ts";
import {
  EVENT_EDITORIAL_SYSTEM_PROMPT,
  buildVerifiedEventBrief,
  parseGeneratedEventEditorial,
  sanitizeEventEditorialParagraphs,
  validateBanditNote,
} from "./eventEditorial.ts";
import { buildEditionVarietyPromptBlock, buildVarietySeed } from "../editorial/editionVariety.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX } from "../editorial/publishing.ts";
import { passesEventGoldenTest } from "./eventStorytelling.ts";
import {
  extractAiHintsFromBanditNote,
  resolveEventBadges,
} from "./badgeResolver.ts";

function withRefreshedBadges(
  event: LocalEvent,
  banditNote: string | null,
  editorialBody: string[] | null
): LocalEvent {
  const base: LocalEvent = {
    ...event,
    banditNote,
    editorialBody,
  };
  if (!banditNote || !event.badgeSignals) return base;
  const badgeSignals = {
    ...event.badgeSignals,
    aiHints: {
      ...event.badgeSignals.aiHints,
      ...extractAiHintsFromBanditNote(banditNote),
    },
  };
  const badges = resolveEventBadges(badgeSignals);
  return {
    ...base,
    badgeSignals,
    badges: badges.length ? badges : undefined,
  };
}

function preserveExistingEditorial(event: LocalEvent): LocalEvent {
  const existingNote = validateBanditNote(event.banditNote);
  const existingBody = sanitizeEventEditorialParagraphs(
    (event.editorialBody ?? []).filter((p) => typeof p === "string" && p.trim())
  );
  const editorialBody = existingBody.length ? existingBody : null;

  if (
    !passesEventGoldenTest({
      name: event.name,
      venue: event.venue,
      banditNote: existingNote,
      editorialBody,
    })
  ) {
    return withRefreshedBadges(event, null, null);
  }

  return withRefreshedBadges(event, existingNote, editorialBody);
}

/** Whether an event already carries publishable editorial from catalog or a prior pass. */
export function eventHasPublishableEditorial(event: LocalEvent): boolean {
  const existingNote = validateBanditNote(event.banditNote);
  const existingBody = sanitizeEventEditorialParagraphs(
    (event.editorialBody ?? []).filter((p) => typeof p === "string" && p.trim())
  );
  const editorialBody = existingBody.length ? existingBody : null;
  return passesEventGoldenTest({
    name: event.name,
    venue: event.venue,
    banditNote: existingNote,
    editorialBody,
  });
}

export type EnrichEventsEditorialOptions = {
  editionDate?: string | null;
  /** Cap Claude batch size — defaults to edition See All max. */
  maxGenerate?: number;
};

export async function enrichEventsWithBanditNotes(
  events: LocalEvent[],
  options?: EnrichEventsEditorialOptions
): Promise<LocalEvent[]> {
  if (!events.length) return events;

  const maxGenerate = options?.maxGenerate ?? LOCAL_EVENTS_EDITION_SURFACED_MAX;
  const preserved = events.map(preserveExistingEditorial);
  const pending: Array<{ index: number; event: LocalEvent }> = [];

  for (let index = 0; index < preserved.length; index++) {
    if (!eventHasPublishableEditorial(preserved[index]!)) {
      pending.push({ index, event: events[index]! });
    }
  }

  if (!pending.length) {
    console.log("[localEvents] editorial copy skipped — all surfaced events already enriched", {
      count: events.length,
    });
    return preserved;
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.warn("[localEvents] editorial copy skipped — ANTHROPIC_API_KEY not set");
    return preserved;
  }

  const batch = pending.slice(0, maxGenerate);
  console.log("[localEvents] editorial copy batch", {
    surfaced: events.length,
    pending: pending.length,
    generating: batch.length,
  });

  try {
    const brief = batch
      .map(({ event }, batchIndex) => {
        const verified = buildVerifiedEventBrief(event, batchIndex);
        const varietySeed = buildVarietySeed(options?.editionDate, event.name);
        return `${verified}\n\n${buildEditionVarietyPromptBlock(varietySeed)}`;
      })
      .join("\n\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: Math.min(4000, 180 * batch.length + 400),
        system: EVENT_EDITORIAL_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              "Write original Bandit notes and editorial article bodies for these verified events. " +
              "Use each event's Story type and Writing guidance — summarize the experience, not the listing. " +
              "Apply the golden test before you finalize each event.\n\n" +
              brief,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[localEvents] editorial copy HTTP", response.status);
      return preserved;
    }

    const data = await response.json();
    const text =
      typeof data?.content?.[0]?.text === "string" ? data.content[0].text : "";
    const generated = parseNotesJson(text, batch.map((row) => row.event));

    const merged = [...preserved];
    for (let i = 0; i < batch.length; i++) {
      const { index, event } = batch[i]!;
      const copy = generated[i] ?? {
        banditNote: null,
        editorialBody: null,
      };
      if (!copy.banditNote && !copy.editorialBody) {
        console.warn("[localEvents] editorial copy rejected or missing", {
          name: event.name.slice(0, 60),
        });
      }
      merged[index] = withRefreshedBadges(event, copy.banditNote, copy.editorialBody);
    }

    return merged;
  } catch (err) {
    console.error("[localEvents] editorial copy failure", {
      error: err instanceof Error ? err.message : String(err),
    });
    return preserved;
  }
}

function parseNotesJson(
  text: string,
  events: LocalEvent[]
): Array<{ banditNote: string | null; editorialBody: string[] | null }> {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { events?: unknown[] };
      if (!Array.isArray(parsed.events)) continue;
      return events.map((event, index) =>
        parseGeneratedEventEditorial(parsed.events?.[index], event)
      );
    } catch {
      continue;
    }
  }

  return events.map(() => ({
    banditNote: null,
    editorialBody: null,
  }));
}
