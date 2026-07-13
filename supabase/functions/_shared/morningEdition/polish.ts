import {
  MORNING_EDITION_SYSTEM_PROMPT,
  morningEditionPolishPrompt,
} from "./voice.ts";
import { composeAllBriefings } from "./compose.ts";
import { stripLeadingSalutation } from "../editorialStyle.ts";
import type {
  MorningBriefing,
  MorningBriefingLength,
  MorningEditionBeats,
  MorningEditionComposeInput,
} from "./types.ts";

type PolishedTrio = {
  opening_20s?: string;
  briefing_60s?: string;
  overview_3m?: string;
};

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function paragraphsFrom(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function toBriefing(
  length: MorningBriefingLength,
  text: string,
  seconds: number
): MorningBriefing {
  const cleaned = stripLeadingSalutation(text.replace(/!+/g, ".").trim());
  const paragraphs = paragraphsFrom(cleaned);
  const joined = paragraphs.join("\n\n");
  return {
    length,
    text: joined,
    paragraphs,
    estimatedSeconds: seconds,
    wordCount: wordCount(joined),
  };
}

function parseTrio(text: string): PolishedTrio | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as PolishedTrio;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as PolishedTrio;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function mergeBriefings(
  fallback: Record<MorningBriefingLength, MorningBriefing>,
  polished: PolishedTrio | null
): Record<MorningBriefingLength, MorningBriefing> {
  if (!polished) return fallback;
  return {
    opening_20s: polished.opening_20s?.trim()
      ? toBriefing("opening_20s", polished.opening_20s, 20)
      : fallback.opening_20s,
    briefing_60s: polished.briefing_60s?.trim()
      ? toBriefing("briefing_60s", polished.briefing_60s, 60)
      : fallback.briefing_60s,
    overview_3m: polished.overview_3m?.trim()
      ? toBriefing("overview_3m", polished.overview_3m, 180)
      : fallback.overview_3m,
  };
}

/**
 * Ask Claude to polish all three briefing lengths; templates always available.
 */
export async function polishMorningBriefings(
  grounding: string,
  beats: MorningEditionBeats,
  input: MorningEditionComposeInput,
  apiKey: string
): Promise<{
  briefings: Record<MorningBriefingLength, MorningBriefing>;
  polishedWithAi: boolean;
}> {
  const fallback = composeAllBriefings(beats, input);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1400,
        system: MORNING_EDITION_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: morningEditionPolishPrompt(grounding),
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    const parsed = text ? parseTrio(text) : null;
    const briefings = mergeBriefings(fallback, parsed);

    console.log("[morningEdition] polish", {
      httpStatus: response.status,
      ok: response.ok,
      usedAi: Boolean(parsed?.briefing_60s),
      apiErrorType: data?.error?.type ?? null,
    });

    return {
      briefings,
      polishedWithAi: Boolean(parsed?.briefing_60s || parsed?.opening_20s),
    };
  } catch (err) {
    console.log("[morningEdition] polish failed", String(err));
    return { briefings: fallback, polishedWithAi: false };
  }
}
