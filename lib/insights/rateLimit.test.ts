import { describe, expect, it, beforeEach, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";
import { isRateLimited } from "@/lib/insights/rateLimit";

function createSupabaseMock(count: number | null, error = false) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({
            count: error ? null : count,
            error: error ? { message: "db error" } : null,
          }),
        }),
      }),
    }),
  };
}

describe("isRateLimited", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.INSIGHT_RATE_LIMIT_PER_HOUR = "2";
  });

  it("returns false when under the limit", async () => {
    const supabase = createSupabaseMock(1);
    await expect(isRateLimited(supabase as never, "user-1")).resolves.toBe(false);
  });

  it("returns true when at or over the limit", async () => {
    const supabase = createSupabaseMock(2);
    await expect(isRateLimited(supabase as never, "user-1")).resolves.toBe(true);
  });
});
