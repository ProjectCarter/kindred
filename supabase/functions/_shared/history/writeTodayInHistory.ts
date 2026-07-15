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

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  const rawParsed = text
    ? parseSectionJson(text)
    : { headline: "", body: "" };

  const body = stripLeadingSalutation(rawParsed.body);
  const headline = formatTodayInHistoryHeadline(
    input.year,
    input.eventText,
    rawParsed.headline
  );

  const words = wordCount(body);
  console.log("[buildEdition] writeTodayInHistorySection", {
    httpStatus: response.status,
    ok: response.ok,
    hasContent: Boolean(text),
    parseOk: Boolean(headline && body),
    wordCount: words,
    targetWords: "300-700",
    apiErrorType: data?.error?.type ?? null,
    apiErrorMessage: data?.error?.message ?? null,
  });

  return { headline, body };
}
