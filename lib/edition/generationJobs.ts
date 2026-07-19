import type { SupabaseClient } from "@supabase/supabase-js";

/** HTTP invoke budget — enqueue should return quickly. */
export const GENERATION_INVOKE_TIMEOUT_MS = 45_000;

/** Client poll budget while the background worker builds the edition. */
export const GENERATION_POLL_MAX_MS = 8 * 60_000;

/** Client first-paint budget — open folio or show recoverable status. */
export const GENERATION_FIRST_PAINT_MAX_MS = 60_000;

export const GENERATION_STALL_MESSAGE =
  "Today's edition is taking longer than expected. Tap Retry to check again.";

export type GenerationJobRow = {
  id?: string;
  status: string;
  last_error: string | null;
  edition_id?: string | null;
};

export type GenerateEditionEnqueueResponse =
  | {
      kind: "ready";
      editionId: string;
      metroKey: string;
      editionDate: string;
      alreadyReady?: boolean;
    }
  | {
      kind: "async";
      status: "pending" | "processing";
      editionDate: string;
      metroKey: string;
      pollIntervalMs: number;
    }
  | {
      kind: "error";
      message: string;
      code?: string;
    };

/** Parse generate-edition JSON — sync ready, async enqueue, or error. */
export function parseGenerateEditionResponse(
  body: unknown
): GenerateEditionEnqueueResponse | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;

  if (typeof row.error === "string" && row.error.trim()) {
    return {
      kind: "error",
      message: row.error.trim(),
      code: typeof row.code === "string" ? row.code : undefined,
    };
  }

  const editionId = typeof row.editionId === "string" ? row.editionId.trim() : "";
  const metroKey = typeof row.metroKey === "string" ? row.metroKey.trim() : "";
  const editionDate =
    typeof row.editionDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.editionDate)
      ? row.editionDate
      : "";

  if (row.success === true && editionId && metroKey) {
    return {
      kind: "ready",
      editionId,
      metroKey,
      editionDate,
      alreadyReady: row.alreadyReady === true,
    };
  }

  if (row.accepted === true && row.async === true && metroKey && editionDate) {
    const status = row.status === "processing" ? "processing" : "pending";
    const pollIntervalMs =
      typeof row.pollIntervalMs === "number" && row.pollIntervalMs > 0
        ? row.pollIntervalMs
        : 5000;
    return {
      kind: "async",
      status,
      editionDate,
      metroKey,
      pollIntervalMs,
    };
  }

  return null;
}

/** Scope generation_jobs lookup to the active market when metro_key is known. */
export async function fetchGenerationJobForEdition(
  supabase: SupabaseClient,
  input: {
    userId: string;
    editionDate: string;
    metroKey?: string | null;
  }
): Promise<{ data: GenerationJobRow | null; error: Error | null }> {
  let query = supabase
    .from("generation_jobs")
    .select("id, status, last_error, edition_id")
    .eq("user_id", input.userId)
    .eq("edition_date", input.editionDate);

  if (input.metroKey?.trim()) {
    query = query.eq("metro_key", input.metroKey.trim());
  }

  const { data, error } = await query.maybeSingle();
  return { data: data as GenerationJobRow | null, error: error as Error | null };
}

export type WaitForEditionOutcome =
  | { outcome: "ready"; editionId: string | null; partial?: boolean }
  | { outcome: "failed"; lastError: string | null }
  | { outcome: "timeout" }
  | { outcome: "aborted" };

export type EditionPollStageMeta = {
  elapsedMs: number;
  editionStatus: string | null;
  sectionCount: number;
  paintable: boolean;
};

function isCoreSectionType(sectionType: string): boolean {
  return (
    sectionType === "today_in_history" ||
    sectionType === "story_of" ||
    sectionType === "your_city" ||
    sectionType === "local_events" ||
    sectionType === "weather"
  );
}

function sectionsArePaintable(
  status: string | null | undefined,
  sectionTypes: string[]
): boolean {
  if (status === "ready" && sectionTypes.length > 0) return true;
  if (status !== "processing") return false;
  return sectionTypes.some(isCoreSectionType);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      },
      { once: true }
    );
  });
}

/** Poll editions + generation_jobs until ready, failed, timeout, or abort. */
export async function waitForEditionGeneration(
  supabase: SupabaseClient,
  input: {
    userId: string;
    editionDate: string;
    metroKey: string;
    signal?: AbortSignal;
    pollIntervalMs?: number;
    maxWaitMs?: number;
    onTick?: (status: "pending" | "processing" | "ready" | "failed") => void;
    onPoll?: (meta: EditionPollStageMeta) => void;
  }
): Promise<WaitForEditionOutcome> {
  const pollIntervalMs = input.pollIntervalMs ?? 5000;
  const maxWaitMs = input.maxWaitMs ?? GENERATION_POLL_MAX_MS;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    if (input.signal?.aborted) {
      return { outcome: "aborted" };
    }

    const tickStarted = Date.now();
    const [editionResult, jobResult] = await Promise.all([
      supabase
        .from("editions")
        .select("id, status")
        .eq("user_id", input.userId)
        .eq("edition_date", input.editionDate)
        .eq("metro_key", input.metroKey)
        .maybeSingle(),
      fetchGenerationJobForEdition(supabase, {
        userId: input.userId,
        editionDate: input.editionDate,
        metroKey: input.metroKey,
      }),
    ]);

    const editionStatus =
      (editionResult.data as { status?: string } | null)?.status ?? null;
    const editionId = editionResult.data?.id as string | undefined;

    let sectionTypes: string[] = [];
    if (editionId) {
      const { data: rows } = await supabase
        .from("edition_sections")
        .select("section_type")
        .eq("edition_id", editionId);
      sectionTypes = (rows ?? []).map((row) =>
        String((row as { section_type: string }).section_type)
      );
    }
    const paintable = sectionsArePaintable(editionStatus, sectionTypes);

    input.onPoll?.({
      elapsedMs: Date.now() - started,
      editionStatus,
      sectionCount: sectionTypes.length,
      paintable,
    });

    if (editionId && paintable) {
      input.onTick?.("ready");
      return {
        outcome: "ready",
        editionId,
        partial: editionStatus === "processing",
      };
    }

    const jobStatus = jobResult.data?.status;
    if (jobStatus === "failed") {
      input.onTick?.("failed");
      return {
        outcome: "failed",
        lastError: jobResult.data?.last_error ?? null,
      };
    }

    input.onTick?.(
      jobStatus === "processing" ? "processing" : "pending"
    );

    try {
      await sleep(pollIntervalMs, input.signal);
    } catch {
      return { outcome: "aborted" };
    }

    if (__DEV__) {
      console.log("[generationJobs] poll tick", {
        elapsedMs: Date.now() - started,
        queryMs: Date.now() - tickStarted,
        editionStatus,
        sectionCount: sectionTypes.length,
        paintable,
      });
    }
  }

  return { outcome: "timeout" };
}
