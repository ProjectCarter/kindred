/**
 * Bandit's Note + verified event article body — generated fresh per event.
 * Editorial law: docs/editorial/EVENT_EDITORIAL_STANDARD.md
 * No template library. No fallback canned sentences.
 */

import type { LocalEvent } from "./provider.ts";
import {
  EVENT_EDITORIAL_SYSTEM_PROMPT,
  EVENT_EDITORIAL_MIN_PARAGRAPHS,
  buildVerifiedEventBrief,
  diagnoseGeneratedEventEditorial,
  parseGeneratedEventEditorial,
  sanitizeEventEditorialParagraphs,
  validateBanditNote,
  validateEditorialHeadline,
  resolveEditorialHeadline,
  type GeneratedEventEditorial,
} from "./eventEditorial.ts";
import { buildEditionVarietyPromptBlock, buildVarietySeed } from "../editorial/editionVariety.ts";
import { fetchWithTimeout } from "../http/fetchWithTimeout.ts";
import { LOCAL_EVENTS_EDITION_SURFACED_MAX } from "../editorial/publishing.ts";
import { passesEventGoldenTest } from "./eventStorytelling.ts";
import {
  extractAiHintsFromBanditNote,
  resolveEventBadges,
} from "./badgeResolver.ts";

function withRefreshedBadges(
  event: LocalEvent,
  copy: GeneratedEventEditorial
): LocalEvent {
  const base: LocalEvent = {
    ...event,
    editorialHeadline: copy.editorialHeadline,
    banditNote: copy.banditNote,
    editorialBody: copy.editorialBody,
  };
  const banditNote = copy.banditNote;
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

function editorialCopyFromEvent(event: LocalEvent): GeneratedEventEditorial {
  const existingNote = validateBanditNote(event.banditNote);
  const existingBody = sanitizeEventEditorialParagraphs(
    (event.editorialBody ?? []).filter((p) => typeof p === "string" && p.trim())
  );
  const existingHeadline = resolveEditorialHeadline(
    event.editorialHeadline ?? null,
    event,
    existingBody.length >= EVENT_EDITORIAL_MIN_PARAGRAPHS ? existingBody : [],
    existingNote
  );
  const editorialBody =
    existingBody.length >= EVENT_EDITORIAL_MIN_PARAGRAPHS ? existingBody : null;
  return {
    editorialHeadline: existingHeadline,
    banditNote: existingNote,
    editorialBody,
  };
}

function copyPassesPublishGate(
  copy: GeneratedEventEditorial,
  event: Pick<LocalEvent, "name" | "venue">
): boolean {
  if (!copy.editorialHeadline || !copy.banditNote || !copy.editorialBody?.length) {
    return false;
  }
  if (copy.editorialBody.length < EVENT_EDITORIAL_MIN_PARAGRAPHS) return false;
  return passesEventGoldenTest({
    name: event.name,
    venue: event.venue,
    banditNote: copy.banditNote,
    editorialBody: copy.editorialBody,
  });
}

function preserveExistingEditorial(event: LocalEvent): LocalEvent {
  const copy = editorialCopyFromEvent(event);
  if (!copyPassesPublishGate(copy, event)) {
    return withRefreshedBadges(event, {
      editorialHeadline: null,
      banditNote: null,
      editorialBody: null,
    });
  }
  return withRefreshedBadges(event, copy);
}

/** Whether an event already carries publishable editorial from catalog or a prior pass. */
export function eventHasPublishableEditorial(event: LocalEvent): boolean {
  return copyPassesPublishGate(editorialCopyFromEvent(event), event);
}

export type EnrichEventsEditorialOptions = {
  editionDate?: string | null;
  /** Cap Claude batch size — defaults to edition See All max. */
  maxGenerate?: number;
};

async function generateSingleEventEditorial(
  event: LocalEvent,
  options: { editionDate?: string | null; apiKey: string; retryHint?: string }
): Promise<GeneratedEventEditorial> {
  const varietySeed = buildVarietySeed(options.editionDate, event.name);
  const verified = buildVerifiedEventBrief(event, 0);
  const response = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": options.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2800,
        system: EVENT_EDITORIAL_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content:
              "Write one original newspaper headline, Bandit note, and editorial article body " +
              "for this verified event. Summarize the experience, not the listing. " +
              "Apply the golden test before you finalize.\n\n" +
              (options.retryHint ? `${options.retryHint}\n\n` : "") +
              `${verified}\n\n${buildEditionVarietyPromptBlock(varietySeed)}`,
          },
        ],
      }),
    },
    60_000
  );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("[localEvents] editorial copy HTTP", response.status, errBody.slice(0, 240));
      if (/credit balance is too low/i.test(errBody)) {
        console.error("[localEvents] editorial copy blocked — Anthropic credits exhausted");
      }
      return { editorialHeadline: null, banditNote: null, editorialBody: null };
    }

  const data = await response.json();
  const text =
    typeof data?.content?.[0]?.text === "string" ? data.content[0].text : "";
  const parsed = parseNotesJson(text, event);
  if (!copyPassesPublishGate(parsed, event)) {
    const trimmed = text.trim();
    const candidates = [trimmed];
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) candidates.push(fenced[1].trim());
    for (const candidate of candidates) {
      try {
        const row = JSON.parse(candidate) as { events?: unknown[] };
        if (!Array.isArray(row.events) || !row.events.length) continue;
        const diagnosis = diagnoseGeneratedEventEditorial(row.events[0], event);
        if (diagnosis.reason) {
          console.warn("[localEvents] editorial parse rejected", {
            name: event.name.slice(0, 60),
            reason: diagnosis.reason,
          });
        }
        break;
      } catch {
        continue;
      }
    }
  }
  return parsed;
}

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
    mode: "sequential",
  });

  const merged = [...preserved];
  let accepted = 0;
  let rejected = 0;

  try {
    for (const { index, event } of batch) {
      let copy: GeneratedEventEditorial | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const generated = await generateSingleEventEditorial(event, {
          editionDate: options?.editionDate,
          apiKey,
          retryHint:
            attempt === 1
              ? "Previous draft failed editorial validation — write a fresh headline, " +
                `Bandit note, and ${EVENT_EDITORIAL_MIN_PARAGRAPHS}–10 distinct paragraphs with a specific closing thought.`
              : undefined,
        });
        if (copyPassesPublishGate(generated, event)) {
          copy = generated;
          break;
        }
      }

      if (copy) {
        accepted += 1;
        merged[index] = withRefreshedBadges(event, copy);
      } else {
        rejected += 1;
        console.warn("[localEvents] editorial copy rejected after retries", {
          name: event.name.slice(0, 60),
        });
      }
    }

    console.log("[localEvents] editorial copy result", {
      generating: batch.length,
      accepted,
      rejected,
    });

    return merged;
  } catch (err) {
    console.error("[localEvents] editorial copy failure", {
      error: err instanceof Error ? err.message : String(err),
    });
    return preserved;
  }
}

function parseNotesJson(text: string, event: LocalEvent): GeneratedEventEditorial {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (Array.isArray(parsed.events) && parsed.events.length) {
        return parseGeneratedEventEditorial(parsed.events[0], event);
      }
      if (
        parsed &&
        typeof parsed === "object" &&
        ("banditNote" in parsed ||
          "editorialBody" in parsed ||
          "editorialHeadline" in parsed ||
          "editorial_body" in parsed)
      ) {
        return parseGeneratedEventEditorial(parsed, event);
      }
    } catch {
      continue;
    }
  }

  return { editorialHeadline: null, banditNote: null, editorialBody: null };
}
