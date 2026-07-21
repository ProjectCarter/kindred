/**
 * Dedicated writer for Today in History — long-form Sunday newspaper feature.
 */

import { NEWSPAPER_STYLE_RULES, stripLeadingSalutation } from "../editorialStyle.ts";
import {
  buildEditorialIntelligencePromptBlock,
} from "../editorial/editorialIntelligence.ts";
import { buildHumanDetailsPromptBlock } from "../editorial/humanDetails.ts";
import { buildLastingImpressionPromptBlock } from "../editorial/lastingImpression.ts";
import { buildSourceConfidencePromptBlock } from "../editorial/sourceConfidence.ts";
import { buildEditionVarietyPromptBlock, buildVarietySeed } from "../editorial/editionVariety.ts";
import {
  validateHistoryArticle,
  wordCount,
} from "../editorial/articleQuality.ts";
import { formatTodayInHistoryHeadline } from "./headline.ts";

export type WriteTodayInHistoryInput = {
  groundingData: string;
  instruction: string;
  year: number;
  eventText: string;
  anthropicApiKey: string;
  /** Edition date or other stable seed — rotates structure across days. */
  varietySeed?: string | null;
};

const HISTORY_SYSTEM_PROMPT =
  "You are Kindred's history editor, writing the signature Today in History feature " +
  "for a calm Sunday morning newspaper. " +
  "You write ONLY from the grounding data given — never invent a fact, date, name, or quote. " +
  "Tone: thoughtful, timeless, curious, and enjoyable — never encyclopedic, never copied verbatim. " +
  "Never open with \"Good morning\" or \"On this day\". " +
  "Never use exclamation points. " +
  "Structure (6 paragraphs, separated by blank lines \\n\\n):\n" +
  "1. A specific opening hook tied to this date and event — not a generic history preamble\n" +
  "2. Historical context — what the world or region was like around this moment\n" +
  "3. What happened — the verified facts, told as narrative\n" +
  "4. Why it mattered then — stakes, surprise, or human detail from grounding\n" +
  "5. Long-term impact — how it changed something concrete (law, city, habit, border, industry)\n" +
  "6. Lasting legacy — ONE memorable closing observation unique to this event (Swap Test + Lasting Thought)\n" +
  "Vary paragraph length. Smooth transitions — never repeat the same opener twice. " +
  "Never repeat the same fact, sentence, or clause in different paragraphs — each paragraph must teach something new. " +
  "CONCLUSION (Swap Test): The final paragraph must belong only to this event and year — " +
  "an observation, never a summary recap. Never a reusable Kindred wrap-up, never 'explains how we got here,' " +
  "never generic statements about history. " +
  "LASTING THOUGHT: Leave the reader with one memorable idea they will remember an hour later — " +
  "a verified fact, overlooked detail, or specific connection to today. Never end with generic lines like " +
  "'this remains important today' or 'continues to inspire.' " +
  `${buildEditorialIntelligencePromptBlock()} ` +
  `${buildHumanDetailsPromptBlock("history")} ` +
  `${buildLastingImpressionPromptBlock("history")} ` +
  `${buildSourceConfidencePromptBlock("history")} ` +
  `${NEWSPAPER_STYLE_RULES} ` +
  "Respond ONLY with valid JSON: {\"headline\": string, \"body\": string}. " +
  "The body must be 450–900 words across exactly 6 paragraphs. No markdown.";

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

function thinHistoryFallback(
  year: number,
  eventText: string
): { headline: string; body: string } {
  const headline = formatTodayInHistoryHeadline(year, eventText, null);
  const event = eventText.trim().replace(/\s+/g, " ");
  const opener =
    /apollo|moon|armstrong|lunar/i.test(event)
      ? "Television sets stayed on past midnight as mission control waited for the first human footsteps on another world."
      : `Morning papers in ${year} carried a lead that would still be debated in classrooms, courtrooms, and kitchen tables decades later.`;
  const body = [
    opener,
    `${year} sat inside a wider moment — institutions, borders, trade routes, and daily habits were all shifting in ways people at the time could feel but not always name. Diplomats, editors, engineers, and neighbors were all reading the same headlines with different stakes.`,
    `Readers who lived through it often remembered the logistics first: who moved, who waited at counters and switchboards, and which ordinary routines changed before anyone agreed on the name for what had happened. The detail that stuck was rarely the speech; it was the delay, the detour, or the extra shift at work.`,
    `At the time, the stakes were immediate: who held power, who lost it, which communities gained a voice, and which customs suddenly looked outdated once the formal announcements caught up. Even people far from the center felt the ripple in prices, schedules, and the small freedoms of daily life.`,
    `The aftershocks did not stay in ${year}. Laws, maps, industries, engineering standards, and arguments we still treat as modern often trace back to mornings like this one. Anniversaries compress a long chain of cause and effect into a single date on the calendar.`,
    `Long after the headlines from ${year} faded, that calendar date still surfaces in places you might not expect — in a museum label, a street name, or a family story told without the year attached. Worth noticing once before the rest of the day pulls you forward.`,
  ].join("\n\n");
  return { headline, body };
}

function passesFinalHistoryGate(
  headline: string,
  body: string,
  year: number,
  eventText: string
): boolean {
  const quality = validateHistoryArticle(body, year, eventText, headline);
  if (quality.passes) return true;
  const onlyLengthFailures = quality.reasons.every(
    (reason) =>
      reason.startsWith("words:") ||
      reason.startsWith("lasting:") ||
      reason.startsWith("conclusion:") ||
      reason.startsWith("no_memorable") ||
      reason.startsWith("lasting_impression:") ||
      reason.startsWith("source_confidence:")
  );
  if (!onlyLengthFailures) return false;
  return (
    !quality.reasons.some((reason) => reason.startsWith("redundancy:")) &&
    quality.paragraphCount >= 6 &&
    quality.words >= 160
  );
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

async function callHistoryWriter(
  input: WriteTodayInHistoryInput,
  extraInstruction?: string
): Promise<{ response: Response; data: Record<string, unknown>; text: string }> {
  const varietySeed = buildVarietySeed(
    input.varietySeed ?? null,
    `${input.year}:${input.eventText.slice(0, 80)}`
  );
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      system: HISTORY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Grounding data:\n${input.groundingData}\n\n` +
            `Instruction: ${input.instruction}${extraInstruction ? `\n\n${extraInstruction}` : ""}\n\n` +
            `${buildEditionVarietyPromptBlock(varietySeed)}\n\n` +
            `Headline format (required): \"${input.year} — Compelling editorial title\" — ` +
            `never \"Today in History\" alone. ` +
            `Body length: 450–900 words across exactly 6 paragraphs.`,
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

  return { response, data, text };
}

export async function writeTodayInHistorySection(
  input: WriteTodayInHistoryInput
): Promise<{ headline: string; body: string }> {
  let { response, data, text } = await callHistoryWriter(input);

  let rawParsed = text ? parseSectionJson(text) : { headline: "", body: "" };
  let body = stripLeadingSalutation(rawParsed.body);
  let headline = formatTodayInHistoryHeadline(
    input.year,
    input.eventText,
    rawParsed.headline
  );

  let quality = validateHistoryArticle(
    body,
    input.year,
    input.eventText,
    headline
  );

  if (!body.trim() || wordCount(body) < 40) {
    const fallback = thinHistoryFallback(input.year, input.eventText);
    headline = fallback.headline;
    body = fallback.body;
    quality = validateHistoryArticle(
      body,
      input.year,
      input.eventText,
      headline
    );
    console.warn("[buildEdition] writeTodayInHistorySection thin fallback", {
      httpStatus: response.status,
      ok: response.ok,
    });
  } else if (!quality.passes) {
    console.warn("[buildEdition] writeTodayInHistorySection quality retry", {
      reasons: quality.reasons,
      paragraphCount: quality.paragraphCount,
      words: quality.words,
    });
    const retry = await callHistoryWriter(
      input,
      `Previous draft failed editorial quality (${quality.reasons.join(", ")}). ` +
        "Rewrite with exactly 6 paragraphs, 450+ words, a unique final observation tied to this event, " +
        "at least one memorable verified takeaway, no generic AI phrases, and no repeated facts or sentences."
    );
    response = retry.response;
    data = retry.data;
    text = retry.text;
    rawParsed = text ? parseSectionJson(text) : { headline: "", body: "" };
    body = stripLeadingSalutation(rawParsed.body);
    headline = formatTodayInHistoryHeadline(
      input.year,
      input.eventText,
      rawParsed.headline
    );
    quality = validateHistoryArticle(
      body,
      input.year,
      input.eventText,
      headline
    );
  }

  if (!passesFinalHistoryGate(headline, body, input.year, input.eventText)) {
    const fallback = thinHistoryFallback(input.year, input.eventText);
    headline = fallback.headline;
    body = fallback.body;
    quality = validateHistoryArticle(
      body,
      input.year,
      input.eventText,
      headline
    );
    console.warn("[buildEdition] writeTodayInHistorySection quality fallback", {
      reasons: quality.reasons,
      paragraphCount: quality.paragraphCount,
      words: quality.words,
    });
  }

  if (!passesFinalHistoryGate(headline, body, input.year, input.eventText)) {
    console.error("[buildEdition] writeTodayInHistorySection rejected", {
      reasons: quality.reasons,
      headline,
    });
    return { headline: "", body: "" };
  }

  console.log("[buildEdition] writeTodayInHistorySection", {
    httpStatus: response.status,
    ok: response.ok,
    hasContent: Boolean(text),
    parseOk: Boolean(headline && body),
    wordCount: quality.words,
    paragraphCount: quality.paragraphCount,
    qualityPass: quality.passes,
    targetWords: "450-900",
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
