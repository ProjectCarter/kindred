/**
 * Kindred's own editorial voice for verified places.
 *
 * Written once per metro+category refresh (cached with the places
 * themselves) — never per user, never per read. Claude only ever sees
 * provider-verified facts (name, address, provider category) and is
 * explicitly told not to add anything it wasn't given, so Recommendations
 * reads like a curated newspaper desk instead of a directory listing.
 */

import type { NormalizedPlace, PlacesCategory } from "./types.ts";
import {
  buildEditorialIntelligencePromptBlock,
  containsGenericAiPhrase,
} from "../editorial/editorialIntelligence.ts";

const CATEGORY_LABEL: Record<PlacesCategory, string> = {
  coffee: "coffee shop",
  restaurants: "restaurant",
  parks: "park",
  museums: "museum",
  bookstores: "bookstore",
  scenic_drives: "scenic drive or lookout",
  attractions: "attraction",
  bakeries: "bakery",
  gardens: "botanical garden",
  beaches: "beach",
  water_recreation: "kayak or paddleboard rental",
  escape_rooms: "escape room",
  bowling: "bowling alley",
  mini_golf: "mini golf course",
  rock_climbing: "rock climbing gym",
  axe_throwing: "axe throwing venue",
  go_karts: "go-kart track",
  pickleball: "pickleball court",
  arcades: "arcade",
  laser_tag: "laser tag venue",
  paintball: "paintball field",
  billiards: "billiards hall",
  roller_skating: "roller skating rink",
  ice_skating: "ice skating rink",
  karaoke: "karaoke bar",
  batting_cages: "batting cages",
};

export async function writeEditorialNotesForPlaces(
  places: NormalizedPlace[],
  category: PlacesCategory,
  city: string
): Promise<NormalizedPlace[]> {
  if (!places.length) return places;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return places.map((p) => ({ ...p, note: fallbackNote(p, category) }));
  }

  try {
    const listing = places
      .map((p, i) => {
        const bits = [p.name];
        if (p.address) bits.push(p.address);
        if (p.providerCategories.length) {
          bits.push(p.providerCategories.slice(0, 2).join(", "));
        }
        return `${i + 1}. ${bits.join(" — ")}`;
      })
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
          `You are Bandit, Kindred's local editor, recommending real ${CATEGORY_LABEL[category]} listings in ${city}. ` +
          "Kindred isn't a directory — a reader could get the address from Google Maps. Your one sentence has to " +
          "earn its place by answering 'will this help someone have a better day?' " +
          "For each place, write ONE warm, specific sentence (max 24 words) that hints at atmosphere, " +
          "who it suits, or what makes it worth the stop — using ONLY the name/address/category given. " +
          "Never invent hours, menu items, ratings, crowd size, or parking you weren't told. " +
          "If it's a small, independent, or local-feeling place, let that come through. " +
          "If little is known beyond the name, write an honest, understated line rather than embellishing. " +
          "No exclamation points. No hashtags. No 'must-visit' clichés. Vary openings across the list. " +
          `${buildEditorialIntelligencePromptBlock()} ` +
          "Respond ONLY with JSON: " +
          '{"notes":["..."]} with one string per place in the same order.',
        messages: [
          {
            role: "user",
            content: `Write Kindred notes for these ${CATEGORY_LABEL[category]} listings in ${city}:\n${listing}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[places:notes] HTTP error", response.status, category);
      return places.map((p) => ({ ...p, note: fallbackNote(p, category) }));
    }

    const data = await response.json();
    const text =
      typeof data?.content?.[0]?.text === "string" ? data.content[0].text : "";
    const notes = parseNotesJson(text, places.length);

    return places.map((p, i) => ({
      ...p,
      note: sanitizePlaceNote(notes[i]) || fallbackNote(p, category),
    }));
  } catch (err) {
    console.error("[places:notes] failure", {
      category,
      city,
      error: err instanceof Error ? err.message : String(err),
    });
    return places.map((p) => ({ ...p, note: fallbackNote(p, category) }));
  }
}

function parseNotesJson(text: string, expected: number): string[] {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as { notes?: unknown };
    if (Array.isArray(parsed.notes)) {
      return parsed.notes.map((n) => (typeof n === "string" ? n.trim() : ""));
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

function sanitizePlaceNote(note: string | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  if (!trimmed || trimmed.length < 12) return null;
  if (containsGenericAiPhrase(trimmed)) return null;
  return trimmed;
}

function fallbackNote(place: NormalizedPlace, category: PlacesCategory): string {
  const label = CATEGORY_LABEL[category];
  return `A ${label} worth knowing about${place.address ? `, on ${place.address}` : ""}.`;
}
