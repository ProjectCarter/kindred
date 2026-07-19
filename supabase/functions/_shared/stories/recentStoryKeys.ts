/**
 * Prior-edition story keys for Local News / front-page cross-day dedupe.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export async function loadRecentStoryKeys(
  supabaseAdmin: SupabaseClient,
  userId: string,
  options: {
    limit?: number;
    /** Scope to one market — required so future audit editions elsewhere
     *  cannot push yesterday's local lead out of the window. */
    metroKey?: string | null;
    /** Omit the edition currently being rebuilt (same date) if desired. */
    excludeEditionDate?: string | null;
  } = {}
): Promise<string[]> {
  const limit = options.limit ?? 14;
  let query = supabaseAdmin
    .from("editions")
    .select("edition_date, lead_story, editorial_context")
    .eq("user_id", userId)
    .order("edition_date", { ascending: false })
    .limit(limit);

  if (options.metroKey?.trim()) {
    query = query.eq("metro_key", options.metroKey.trim());
  }
  if (options.excludeEditionDate?.trim()) {
    query = query.neq("edition_date", options.excludeEditionDate.trim());
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    if (error) {
      console.log("[stories] recent story keys lookup", {
        error: error.message,
      });
    }
    return [];
  }

  const keys: string[] = [];
  for (const row of data) {
    const lead = row.lead_story as {
      id?: string;
      headline?: string;
      url?: string | null;
    } | null;
    if (lead?.headline) keys.push(lead.headline);
    if (lead?.id) keys.push(lead.id);
    if (lead?.url) keys.push(lead.url);

    const ctx = row.editorial_context as {
      sections?: Array<{
        sectionType?: string;
        items?: Array<{ title?: string; id?: string }>;
      }>;
    } | null;
    const top = ctx?.sections?.find((s) => s.sectionType === "top_stories");
    for (const item of top?.items ?? []) {
      if (item.title) keys.push(item.title);
      if (item.id) keys.push(item.id);
    }
  }

  const unique = Array.from(new Set(keys.map((k) => k.trim()).filter(Boolean)));
  console.log("[stories] recent story keys", {
    editionCount: data.length,
    keyCount: unique.length,
    metroKey: options.metroKey ?? null,
  });
  return unique;
}
