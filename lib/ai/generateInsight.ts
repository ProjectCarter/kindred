/**
 * Server-only. Import from Server Actions, Route Handlers, or Server Components only.
 */
import { getInsightProvider } from "./getProvider";
import type { InsightGenerationInput, InsightGenerationResult } from "./types";

export async function generateInsight(
  input: InsightGenerationInput
): Promise<InsightGenerationResult> {
  const provider = getInsightProvider();
  return provider.generate(input);
}

export type { InsightGenerationInput, InsightGenerationResult } from "./types";
