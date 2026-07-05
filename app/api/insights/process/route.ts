import { createClient } from "@/lib/supabase/server";
import { processPendingJobsForUser } from "@/lib/insights/processInsightJob";
import { log } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const processed = await processPendingJobsForUser(supabase, user.id);
    return NextResponse.json({ processed });
  } catch (error) {
    log.error("Insight processing request failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
