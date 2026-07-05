import { getEnv } from "@/lib/env";
import { processStaleJobs } from "@/lib/insights/processInsightJob";
import { log } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { CRON_SECRET } = getEnv();
  const authHeader = request.headers.get("authorization");

  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const processed = await processStaleJobs(supabase);

    log.info("Cron insight processing completed", { processed });

    return NextResponse.json({ processed });
  } catch (error) {
    log.error("Cron insight processing failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
