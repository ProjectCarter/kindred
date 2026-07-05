import { describe, expect, it, beforeEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";
import {
  getStaleProcessingBefore,
  isProcessingStale,
} from "@/lib/insights/jobUtils";

describe("jobUtils", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.INSIGHT_PROCESSING_STALE_MS = "60000";
  });

  it("treats missing updated_at as stale", () => {
    expect(isProcessingStale(undefined)).toBe(true);
  });

  it("detects stale and fresh processing jobs", () => {
    const stale = new Date(Date.now() - 120_000).toISOString();
    const fresh = new Date().toISOString();

    expect(isProcessingStale(stale)).toBe(true);
    expect(isProcessingStale(fresh)).toBe(false);
  });

  it("computes stale threshold timestamp", () => {
    const before = getStaleProcessingBefore();
    expect(new Date(before).getTime()).toBeLessThan(Date.now());
  });
});
