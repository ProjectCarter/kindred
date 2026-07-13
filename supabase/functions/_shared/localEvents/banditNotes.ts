/**
 * Bandit’s one-line invitation for each local event.
 * Calm, specific, place-bound — never marketing fluff.
 */

import type { LocalEvent } from "./provider.ts";
import {
  extractAiHintsFromBanditNote,
  resolveEventBadges,
} from "./badgeResolver.ts";

function withRefreshedBadges(event: LocalEvent, banditNote: string): LocalEvent {
  if (!event.badgeSignals) {
    return { ...event, banditNote };
  }
  const badgeSignals = {
    ...event.badgeSignals,
    aiHints: {
      ...event.badgeSignals.aiHints,
      ...extractAiHintsFromBanditNote(banditNote),
    },
  };
  const badges = resolveEventBadges(badgeSignals);
  return {
    ...event,
    banditNote,
    badgeSignals,
    badges: badges.length ? badges : undefined,
  };
}

export async function enrichEventsWithBanditNotes(
  events: LocalEvent[]
): Promise<LocalEvent[]> {
  if (!events.length) return events;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return events.map((e) =>
      withRefreshedBadges(e, e.banditNote?.trim() || fallbackBanditNote(e))
    );
  }

  try {
    const listing = events
      .map(
        (e, i) =>
          `${i + 1}. "${e.name}" — ${e.startDateTime} at ${e.venue}, ${e.city}`
      )
      .join("\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1600,
        system:
          "You are Bandit, Kindred’s local editor. For each event, write ONE short sentence " +
          "(max 18 words) explaining why it’s worth leaving the house. Warm, specific, never salesy. " +
          "No exclamation points. No hashtags. Respond ONLY with JSON: " +
          '{"notes":["..."]} with one string per event in the same order.',
        messages: [
          {
            role: "user",
            content: `Write Bandit notes for these local events:\n${listing}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[localEvents] bandit notes HTTP", response.status);
      return events.map((e) =>
        withRefreshedBadges(e, e.banditNote?.trim() || fallbackBanditNote(e))
      );
    }

    const data = await response.json();
    const text =
      typeof data?.content?.[0]?.text === "string" ? data.content[0].text : "";
    const notes = parseNotesJson(text, events.length);

    return events.map((e, i) =>
      withRefreshedBadges(
        e,
        notes[i]?.trim() || fallbackBanditNote(e)
      )
    );
  } catch (err) {
    console.error("[localEvents] bandit notes failure", {
      error: err instanceof Error ? err.message : String(err),
    });
    return events.map((e) =>
      withRefreshedBadges(e, e.banditNote?.trim() || fallbackBanditNote(e))
    );
  }
}

function parseNotesJson(text: string, expected: number): string[] {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as { notes?: unknown };
    if (Array.isArray(parsed.notes)) {
      return parsed.notes.map((n) =>
        typeof n === "string" ? n.trim() : ""
      );
    }
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        const parsed = JSON.parse(fenced[1].trim()) as { notes?: unknown };
        if (Array.isArray(parsed.notes)) {
          return parsed.notes.map((n) =>
            typeof n === "string" ? n.trim() : ""
          );
        }
      } catch {
        /* fall through */
      }
    }
  }
  return Array.from({ length: expected }, () => "");
}

/** Quiet fallback when Claude is unavailable — still Bandit-shaped. */
export function fallbackBanditNote(event: LocalEvent): string {
  const venue = event.venue?.trim();
  if (venue && venue !== "Venue TBA") {
    return `Worth stepping out for — ${venue} has something happening tonight.`;
  }
  return "Worth leaving the house for — a local moment you might otherwise miss.";
}
