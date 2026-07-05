import { createAnthropicProvider } from "./providers/anthropic";
import type { InsightProvider } from "./types";

export function getInsightProvider(): InsightProvider {
  switch (process.env.AI_PROVIDER ?? "anthropic") {
    case "anthropic":
      return createAnthropicProvider();
    default:
      return createAnthropicProvider();
  }
}
