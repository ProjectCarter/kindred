import { describe, expect, it, beforeEach } from "vitest";
import { getEnv, resetEnvCacheForTests, validateEnvAtStartup } from "@/lib/env";

describe("env", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("parses defaults for optional numeric settings", () => {
    const env = getEnv();
    expect(env.INSIGHT_RATE_LIMIT_PER_HOUR).toBe(10);
    expect(env.INSIGHT_POLL_INTERVAL_MS).toBe(3000);
  });

  it("throws when required Supabase vars are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => getEnv()).toThrow(/Invalid environment configuration/);
  });

  it("allows missing Anthropic key outside production", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => validateEnvAtStartup()).not.toThrow();
  });
});
