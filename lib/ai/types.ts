export type InsightGenerationInput = {
  description: string;
  hasPhoto?: boolean;
};

export type InsightGenerationError =
  | "config_error"
  | "api_error"
  | "empty_response";

export type InsightGenerationResult =
  | { ok: true; body: string }
  | { ok: false; error: InsightGenerationError; detail: string };

export interface InsightProvider {
  generate(input: InsightGenerationInput): Promise<InsightGenerationResult>;
}
