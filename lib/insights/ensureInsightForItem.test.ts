import { describe, expect, it, beforeEach, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/env";
import { ensureInsightForItem } from "@/lib/insights/ensureInsightForItem";

vi.mock("@/lib/insights/enqueueInsightJob", () => ({
  enqueueInsightJob: vi.fn().mockResolvedValue({
    id: "job-1",
    user_id: "user-1",
    item_id: "item-1",
    status: "pending",
    attempts: 0,
    last_error: null,
  }),
}));

describe("ensureInsightForItem", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    vi.clearAllMocks();
  });

  it("returns an existing insight without enqueueing", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "insights") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { body: "Existing" } }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await ensureInsightForItem(supabase as never, {
      userId: "user-1",
      itemId: "item-1",
    });

    expect(result).toEqual({ body: "Existing", pending: false });
  });

  it("returns pending when a retryable job exists", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "insights") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          };
        }

        if (table === "insight_jobs") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: "pending", attempts: 0 },
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const result = await ensureInsightForItem(supabase as never, {
      userId: "user-1",
      itemId: "item-1",
    });

    expect(result).toEqual({ body: null, pending: true });
  });
});
