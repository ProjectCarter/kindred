/**
 * Dedicated writer for Today in History — long-form Sunday newspaper feature.
 */

import { NEWSPAPER_STYLE_RULES, stripLeadingSalutation } from "../editorialStyle.ts";
import { formatTodayInHistoryHeadline } from "./headline.ts";

export type WriteTodayInHistoryInput = {
  groundingData: string;
  instruction: string;
  year: number;
  eventText: string;
  anthropicApiKey: string;
};

function parseSectionJson(text: string): { headline: string; body: string } {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        return { headline: "", body: "" };
      }
    }
    return { headline: "", body: "" };
  }
}

function wordCount(text: string): number {
  return text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function thinHistoryFallback(
  year: number,
  eventText: string
): { headline: string; body: string } {
  const headline = formatTodayInHistoryHeadline(year, eventText, null);
  const event = eventText.trim().replace(/\s+/g, " ");
  const opener = event.length
    ? `In ${year}, ${event.charAt(0).toLowerCase()}${event.slice(1)}`
    : `In ${year}, the world turned on an event worth remembering.`;
  const body = [
    opener.endsWith(".") ? opener : `${opener}.`,
    "Kindred keeps these anniversaries on the front page because they explain how we got here — a calm minute of context before the rest of the day pulls you forward.",
    "More verified background may arrive in later editions; this note stays within what the historical record confirms for the date.",
  ].join("\n\n");
  return { headline, body };
}

async function readAnthropicJson(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.warn("[buildEdition] writeTodayInHistorySection non-JSON response", {
      httpStatus: response.status,
      sample: raw.slice(0, 200),
    });
    return {};
  }
}

export async function writeTodayInHistorySection(
  input: WriteTodayInHistoryInput
): Promise<{ headline: string; body: string }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system:
        "You are Kindred's history editor, writing the signature Today in History feature " +
        "for a calm Sunday morning newspaper. " +
        "You write ONLY from the grounding data given — never invent a fact, date, name, or quote. " +
        "Tone: thoughtful, timeless, curious, and enjoyable — never encyclopedic, never copied verbatim. " +
        "Never open with \"Good morning\" or \"On this day\". " +
        "Never use exclamation points. " +
        `${NEWSPAPER_STYLE_RULES} ` +
        "Respond ONLY with valid JSON: {\"headline\": string, \"body\": string}. " +
        "The body must be 2–4 paragraphs separated by blank lines (\\n\\n). No markdown.",
      messages: [
        {
          role: "user",
          content:
            `Grounding data:\n${input.groundingData}\n\n` +
            `Instruction: ${input.instruction}\n\n` +
            `Headline format (required): \"${input.year} — Compelling editorial title\" — ` +
            `never \"Today in History\" alone. ` +
            `Body length: 300–700 words across 2–4 paragraphs.`,
        },
      ],
    }),
  });

  const data = await readAnthropicJson(response);
  const content = Array.isArray(data.content) ? data.content : [];
  const text =
    typeof content[0] === "object" &&
    content[0] &&
    "text" in content[0] &&
    typeof content[0].text === "string"
      ? content[0].text
      : "";
  const rawParsed = text
    ? parseSectionJson(text)
    : { headline: "", body: "" };

  let body = stripLeadingSalutation(rawParsed.body);
  let headline = formatTodayInHistoryHeadline(
    input.year,
    input.eventText,
    rawParsed.headline
  );

  if (!body.trim() || wordCount(body) < 40) {
    const fallback = thinHistoryFallback(input.year, input.eventText);
    headline = fallback.headline;
    body = fallback.body;
    console.warn("[buildEdition] writeTodayInHistorySection thin fallback", {
      httpStatus: response.status,
      ok: response.ok,
      apiErrorMessage:
        typeof data?.error === "object" &&
        data.error &&
        "message" in data.error &&
        typeof data.error.message === "string"
          ? data.error.message
          : null,
    });
  }

  const words = wordCount(body);
  console.log("[buildEdition] writeTodayInHistorySection", {
    httpStatus: response.status,
    ok: response.ok,
    hasContent: Boolean(text),
    parseOk: Boolean(headline && body),
    wordCount: words,
    targetWords: "300-700",
    apiErrorType:
      typeof data?.error === "object" &&
      data.error &&
      "type" in data.error &&
      typeof data.error.type === "string"
        ? data.error.type
        : null,
    apiErrorMessage:
      typeof data?.error === "object" &&
      data.error &&
      "message" in data.error &&
      typeof data.error.message === "string"
        ? data.error.message
        : null,
  });

  return { headline, body };
}
