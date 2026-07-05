import { createAnthropicProvider } from "./providers/anthropic";
import type { InsightProvider } from "./types";

export function getInsightProvider(): InsightProvider {
  const provider = process.env.AI_PROVIDER ?? "anthropic";

  if (provider !== "anthropic") {
    console.warn(
      `Unknown AI provider "${provider}" — falling back to anthropic.`
    );
  }

  return createAnthropicProvider();
}
