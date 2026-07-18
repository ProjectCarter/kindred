/**
 * Incremental edition section persistence — never delete completed desks.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type EditionSectionUpsertRow = {
  edition_id: string;
  section_type: string;
  position: number;
  headline: string;
  body: string;
  source_note?: string | null;
};

export async function upsertEditionSection(
  admin: SupabaseClient,
  row: EditionSectionUpsertRow
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing } = await admin
    .from("edition_sections")
    .select("id")
    .eq("edition_id", row.edition_id)
    .eq("section_type", row.section_type)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from("edition_sections")
      .update({
        position: row.position,
        headline: row.headline,
        body: row.body,
        source_note: row.source_note ?? null,
      })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const { error } = await admin.from("edition_sections").insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function upsertEditionSections(
  admin: SupabaseClient,
  rows: EditionSectionUpsertRow[]
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  let count = 0;
  for (const row of rows) {
    const result = await upsertEditionSection(admin, row);
    if (!result.ok) return result;
    count += 1;
  }
  return { ok: true, count };
}

export function estimateJsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}
