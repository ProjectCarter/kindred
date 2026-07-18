/**
 * Early MVP checkpoint — insert core sections and mark ready before optional desks finish.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { editionsConflictTarget } from "../markets/editionIdentity.ts";
import { assessMinimumViableEdition } from "./minimumViableEdition.ts";

export type EarlySectionRow = {
  section_type: string;
  position: number;
  headline: string;
  body: string;
  source_note?: string | null;
};

export type EarlyEditionCheckpointInput = {
  traceId?: string | null;
  userId: string;
  editionDate: string;
  metroKey: string;
  editionCore: Record<string, unknown>;
  sectionRows: EarlySectionRow[];
};

export type EarlyEditionCheckpointResult =
  | { ok: true; editionId: string; markedReady: boolean; sectionCount: number }
  | { ok: false; error: string };

export async function publishMinimumViableEditionCheckpoint(
  admin: SupabaseClient,
  input: EarlyEditionCheckpointInput
): Promise<EarlyEditionCheckpointResult> {
  const started = performance.now();
  const traceId = input.traceId ?? null;

  const upsertCore = {
    user_id: input.userId,
    edition_date: input.editionDate,
    metro_key: input.metroKey,
    status: "processing" as const,
    ...input.editionCore,
  };

  const { data: edition, error: upsertError } = await admin
    .from("editions")
    .upsert(upsertCore, { onConflict: editionsConflictTarget() })
    .select("id, status")
    .single();

  if (upsertError || !edition?.id) {
    return {
      ok: false,
      error: upsertError?.message ?? "edition upsert failed",
    };
  }

  const editionId = edition.id as string;
  const mvpRows = input.sectionRows.filter(
    (row) => row.headline?.trim() && row.body?.trim()
  );

  if (mvpRows.length === 0) {
    console.log("[earlyEditionPublish] skip — no MVP rows", { traceId, editionId });
    return { ok: true, editionId, markedReady: false, sectionCount: 0 };
  }

  const { data: existing } = await admin
    .from("edition_sections")
    .select("section_type")
    .eq("edition_id", editionId);

  const existingTypes = new Set(
    (existing ?? []).map((row) => String((row as { section_type: string }).section_type))
  );

  const toInsert = mvpRows
    .filter((row) => !existingTypes.has(row.section_type))
    .map((row) => ({ ...row, edition_id: editionId }));
  if (toInsert.length > 0) {
    const { error: insertError } = await admin.from("edition_sections").insert(toInsert);
    if (insertError) {
      return { ok: false, error: insertError.message };
    }
  }

  const { data: allSections } = await admin
    .from("edition_sections")
    .select("section_type")
    .eq("edition_id", editionId);

  const mvp = assessMinimumViableEdition(allSections ?? []);
  let markedReady = false;

  if (mvp.paintable && edition.status !== "ready") {
    const { error: readyError } = await admin
      .from("editions")
      .update({ status: "ready" })
      .eq("id", editionId);
    if (readyError) {
      return { ok: false, error: readyError.message };
    }
    markedReady = true;
  }

  console.log("[earlyEditionPublish] checkpoint", {
    traceId,
    editionId,
    metroKey: input.metroKey,
    inserted: toInsert.length,
    totalSections: allSections?.length ?? 0,
    markedReady,
    mvpReasons: mvp.reasons,
    elapsedMs: Math.round(performance.now() - started),
  });

  return {
    ok: true,
    editionId,
    markedReady,
    sectionCount: allSections?.length ?? 0,
  };
}
