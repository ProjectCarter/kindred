import {
  BANDIT_SYSTEM_PROMPT,
  banditGroundingPrompt,
} from "./personality.ts";
import {
  buildBanditGrounding,
  composeBanditPayload,
  composeMorningLine,
} from "./compose.ts";
import { stripLeadingSalutation } from "../editorialStyle.ts";
import type { BanditComposeInput, BanditPayload } from "./types.ts";

function parseBanditLine(text: string): string | null {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as { line?: string };
    if (parsed.line?.trim()) return parsed.line.trim();
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        const parsed = JSON.parse(fenced[1].trim()) as { line?: string };
        if (parsed.line?.trim()) return parsed.line.trim();
      } catch {
        /* fall through */
      }
    }
  }
  // Soft fallback: treat plain text as the line if short enough.
  if (trimmed.length > 0 && trimmed.length <= 220 && !trimmed.startsWith("{")) {
    return trimmed.replace(/^["“]|["”]$/g, "").trim();
  }
  return null;
}

/**
 * Ask Claude for Bandit's morning line; fall back to composed templates.
 *
 * @deprecated No longer called from `generateBanditPayload`. The AI polish
 * pass kept drifting into literary/poetic phrasing ("...let the world come
 * to you.") that didn't match Bandit's "thoughtful friend" voice. Kept here
 * only in case a future, more tightly-scoped use needs it.
 */
export async function polishBanditMorningLine(
  input: BanditComposeInput,
  apiKey: string
): Promise<string> {
  const fallback = composeMorningLine(input);
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
        max_tokens: 120,
        system: BANDIT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: banditGroundingPrompt(buildBanditGrounding(input)),
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    const line = text ? parseBanditLine(text) : null;

    console.log("[bandit] polish morning line", {
      httpStatus: response.status,
      ok: response.ok,
      usedAi: Boolean(line),
      apiErrorType: data?.error?.type ?? null,
    });

    if (!line) return fallback;
    // Guard against exclamation / length drift, and against a leading
    // time-of-day greeting — Bandit's line can be read any time of day.
    return stripLeadingSalutation(line.replace(/!+/g, ".").slice(0, 220));
  } catch (err) {
    console.log("[bandit] polish failed", String(err));
    return fallback;
  }
}

/**
 * Full Bandit generation for an edition — reusable entry point.
 */
export async function generateBanditPayload(
  input: BanditComposeInput,
  _apiKey?: string | null
): Promise<BanditPayload> {
  // Deliberately deterministic, no AI call — see polishBanditMorningLine's
  // @deprecated note above. Keeps Bandit's voice consistent and removes
  // an Anthropic round trip from the generation pipeline.
  const morningLine = composeMorningLine(input);

  const payload = composeBanditPayload(input, morningLine);

  console.log("[bandit] payload", {
    occasion: payload.morning.occasion,
    occasions: payload.occasions,
    hasWeekly: Boolean(payload.weekly),
    hasSeasonal: Boolean(payload.seasonal),
    linePreview: payload.morning.line.slice(0, 80),
  });

  return payload;
}
