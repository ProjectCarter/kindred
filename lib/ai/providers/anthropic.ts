import {
  buildInsightUserPrompt,
  INSIGHT_SYSTEM_PROMPT,
} from "../prompts";
import type {
  InsightGenerationInput,
  InsightGenerationResult,
  InsightProvider,
} from "../types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 300;

type AnthropicMessageResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { type: string; message: string };
};

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
        return { ok: false, error: "config_error" };
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
          console.error(
            "Anthropic API request failed:",
            response.status,
            response.statusText
          );
          return { ok: false, error: "api_error" };
        }

        const data = (await response.json()) as AnthropicMessageResponse;
        const body = extractText(data);

        if (!body) {
          console.error("Anthropic API returned an empty insight.");
          return { ok: false, error: "empty_response" };
        }

        return { ok: true, body };
      } catch (error) {
        console.error("Anthropic API request error:", error);
        return { ok: false, error: "api_error" };
      }
    },
  };
}
