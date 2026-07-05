import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";
import { processInsightJob } from "@/lib/insights/processInsightJob";
import type { InsightJob } from "@/lib/insights/types";

vi.mock("@/lib/ai/generateInsight", () => ({
  generateInsight: vi.fn().mockResolvedValue({
    ok: true,
    body: "A calm reflection.",
  }),
}));

vi.mock("@/lib/insights/rateLimit", () => ({
  isRateLimited: vi.fn().mockResolvedValue(false),
  recordGenerationAttempt: vi.fn().mockResolvedValue(undefined),
}));

const job: InsightJob = {
  id: "job-1",
  user_id: "user-1",
  item_id: "item-1",
  status: "pending",
  attempts: 0,
  last_error: null,
};

function createSupabaseMock() {
  const updates: Array<Record<string, unknown>> = [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "item-1",
                user_id: "user-1",
                description: "An old kayak",
                photo_path: null,
              },
            }),
          }),
        };
      }

      if (table === "insights") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      if (table === "insight_jobs") {
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            updates.push(payload);
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    updates,
  };

  return supabase;
}

describe("processInsightJob", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    vi.clearAllMocks();
  });

  it("loads item data from the database and completes the job", async () => {
    const supabase = createSupabaseMock();
    const { generateInsight } = await import("@/lib/ai/generateInsight");

    const result = await processInsightJob(supabase as never, job);

    expect(result).toBe("completed");
    expect(generateInsight).toHaveBeenCalledWith({
      description: "An old kayak",
      hasPhoto: false,
    });
    expect(supabase.updates.at(-1)).toMatchObject({ status: "completed" });
  });
});
