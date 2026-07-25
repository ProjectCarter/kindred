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
import { buildHumanDetailsPromptBlock, humanDetailsDeskForPlacesCategory } from "../editorial/humanDetails.ts";
import { buildLastingImpressionPromptBlock } from "../editorial/lastingImpression.ts";
import {
  buildSourceConfidencePromptBlock,
  sourceConfidenceDeskForPlacesCategory,
  validateSourceConfidenceText,
} from "../editorial/sourceConfidence.ts";
import { buildEditionVarietyPromptBlock, buildVarietySeed } from "../editorial/editionVariety.ts";

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
  city: string,
  options?: { editionDate?: string | null }
): Promise<NormalizedPlace[]> {
  if (!places.length) return places;

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return places.map((p) => ({
      ...p,
      note: fallbackNote(p, category),
      about: null,
    }));
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

    const varietySeed = buildVarietySeed(
      options?.editionDate,
      `${city}:${category}`
    );

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
          "ALSO write a warm editorial 'about' for each place: one or two short paragraphs " +
          "(2–4 sentences total, under 65 words) that help a reader decide whether to go — what the " +
          "experience feels like, what makes it worth a stop, and who would enjoy it — using ONLY the " +
          "name/address/category given. Same rules: never invent hours, menu items, ratings, prices, " +
          "awards, or specifics you weren't told; if little is known, keep it honest and understated; " +
          "never copy a provider description; no clichés, no marketing voice. " +
          `${buildEditorialIntelligencePromptBlock()} ` +
          `${buildHumanDetailsPromptBlock(humanDetailsDeskForPlacesCategory(category))} ` +
          `${buildLastingImpressionPromptBlock(humanDetailsDeskForPlacesCategory(category))} ` +
          `${buildSourceConfidencePromptBlock(sourceConfidenceDeskForPlacesCategory(category))} ` +
          `${buildEditionVarietyPromptBlock(varietySeed)} ` +
          "Respond ONLY with JSON: " +
          '{"notes":["..."],"abouts":["..."]} with one string per place in each array, in the same order.',
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
      return places.map((p) => ({
        ...p,
        note: fallbackNote(p, category),
        about: null,
      }));
    }

    const data = await response.json();
    const text =
      typeof data?.content?.[0]?.text === "string" ? data.content[0].text : "";
    const { notes, abouts } = parseNotesJson(text, places.length);

    return places.map((p, i) => ({
      ...p,
      note: sanitizePlaceNote(notes[i], category) || fallbackNote(p, category),
      // `about` is optional: omit (null) rather than fabricate when invalid, so
      // the reader falls back to Kindred's composed editorial body.
      about: sanitizePlaceAbout(abouts[i], category),
    }));
  } catch (err) {
    console.error("[places:notes] failure", {
      category,
      city,
      error: err instanceof Error ? err.message : String(err),
    });
    return places.map((p) => ({
      ...p,
      note: fallbackNote(p, category),
      about: null,
    }));
  }
}

function parseNotesJson(
  text: string,
  expected: number
): { notes: string[]; abouts: string[] } {
  const empty = () => Array.from({ length: expected }, () => "");
  const toStrings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map((n) => (typeof n === "string" ? n.trim() : ""))
      : empty();

  const extract = (raw: string): { notes: string[]; abouts: string[] } | null => {
    try {
      const parsed = JSON.parse(raw) as { notes?: unknown; abouts?: unknown };
      if (Array.isArray(parsed.notes) || Array.isArray(parsed.abouts)) {
        return { notes: toStrings(parsed.notes), abouts: toStrings(parsed.abouts) };
      }
    } catch {
      /* fall through */
    }
    return null;
  };

  const trimmed = text.trim();
  const direct = extract(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = extract(fenced[1].trim());
    if (fromFence) return fromFence;
  }

  return { notes: empty(), abouts: empty() };
}

function sanitizePlaceNote(note: string | undefined, category: PlacesCategory): string | null {
  const trimmed = note?.trim() ?? "";
  if (!trimmed || trimmed.length < 12) return null;
  if (containsGenericAiPhrase(trimmed)) return null;
  if (!validateSourceConfidenceText(trimmed, {
    desk: sourceConfidenceDeskForPlacesCategory(category),
  }).passes) {
    return null;
  }
  return trimmed;
}

/**
 * Validate the 1–2 paragraph editorial "about" the same way as the one-liner:
 * reject generic AI phrasing and low source confidence, cap length as a safety
 * net, and return null (omit) rather than fabricate when it fails.
 */
function sanitizePlaceAbout(
  about: string | undefined,
  category: PlacesCategory
): string | null {
  const trimmed = about?.replace(/\s+/g, " ").trim() ?? "";
  if (trimmed.length < 40) return null;
  if (containsGenericAiPhrase(trimmed)) return null;
  if (!validateSourceConfidenceText(trimmed, {
    desk: sourceConfidenceDeskForPlacesCategory(category),
  }).passes) {
    return null;
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 90) return `${words.slice(0, 90).join(" ")}…`;
  return trimmed;
}

function fallbackNote(place: NormalizedPlace, category: PlacesCategory): string {
  const label = CATEGORY_LABEL[category];
  return `A ${label} worth knowing about${place.address ? `, on ${place.address}` : ""}.`;
}
