import {
  buildInsightUserPrompt,
  INSIGHT_SYSTEM_PROMPT,
} from "../prompts";
import { log } from "@/lib/logger";
import type {
  InsightGenerationInput,
  InsightGenerationResult,
  InsightProvider,
} from "../types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 300;

type AnthropicMessageResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { type: string; message: string };
};

async function readAnthropicErrorDetail(response: Response): Promise<string> {
  const raw = await response.text();

  if (!raw) {
    return `${response.status} ${response.statusText}`;
  }

  try {
    const parsed = JSON.parse(raw) as {
      error?: { type?: string; message?: string };
      type?: string;
      message?: string;
    };
    const nested = parsed.error?.message ?? parsed.message;
    const nestedType = parsed.error?.type ?? parsed.type;

    if (nested) {
      return nestedType
        ? `${response.status} ${response.statusText}: ${nestedType} — ${nested}`
        : `${response.status} ${response.statusText}: ${nested}`;
    }
  } catch {
    // Fall through with raw body.
  }

  return `${response.status} ${response.statusText}: ${raw}`;
}

function extractText(response: AnthropicMessageResponse): string | null {
  const block = response.content?.find(
    (part) => part.type === "text" && part.text
  );
  const text = block?.text?.trim();
  return text || null;
}

export function createAnthropicProvider(): InsightProvider {
  return {
    async generate(input: InsightGenerationInput): Promise<InsightGenerationResult> {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return {
          ok: false,
          error: "config_error",
          detail: "ANTHROPIC_API_KEY is not set",
        };
      }

      const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

      try {
        const response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
            system: INSIGHT_SYSTEM_PROMPT,
            messages: [
              {
                role: "user",
                content: buildInsightUserPrompt(input),
              },
            ],
          }),
        });

        if (!response.ok) {
          const detail = await readAnthropicErrorDetail(response);

          log.error("Anthropic API request failed", {
            status: response.status,
            statusText: response.statusText,
            model,
            detail,
          });
          console.error(`[Kindred] Anthropic API error: ${detail}`);

          return { ok: false, error: "api_error", detail };
        }

        const data = (await response.json()) as AnthropicMessageResponse;
        const body = extractText(data);

        if (!body) {
          const detail = "Anthropic API returned an empty insight body";
          log.error("Anthropic API returned an empty insight", { model, detail });
          console.error(`[Kindred] Anthropic API error: ${detail}`);
          return { ok: false, error: "empty_response", detail };
        }

        return { ok: true, body };
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown Anthropic request error";

        log.error("Anthropic API request error", {
          model,
          detail,
        });
        console.error(`[Kindred] Anthropic API error: ${detail}`);

        return { ok: false, error: "api_error", detail };
      }
    },
  };
}
