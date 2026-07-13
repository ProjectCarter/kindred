import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type {
  MemoryClipping,
  MemoryPriorEdition,
  MemoryUnfinishedRead,
} from "./types.ts";

export type MemoryArchive = {
  priorEditions: MemoryPriorEdition[];
  unfinishedReads: MemoryUnfinishedRead[];
  clippings: MemoryClipping[];
  lastReadAt: string | null;
  openDays: string[];
  homeLocation: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  } | null;
  travel: {
    away?: boolean;
    city?: string | null;
    until?: string | null;
    note?: string | null;
  } | null;
};

type PreloadedProfileRow = {
  home_location?: {
    city?: string | null;
    region?: string | null;
    state?: string | null;
  } | null;
  travel?: {
    away?: boolean;
    city?: string | null;
    until?: string | null;
    note?: string | null;
  } | null;
} | null;

/**
 * Load prior editions + unfinished reads for the Memory Engine.
 * Failures return empty archive — edition build must not fail.
 *
 * Pass `preloadedProfile` when the caller already fetched this same
 * `profiles` row (buildEditionForUser does, once, up front) — this skips a
 * redundant DB round trip instead of re-querying the same row.
 */
export async function loadMemoryArchive(
  supabaseAdmin: SupabaseClient,
  userId: string,
  options?: { editionLimit?: number; signalDays?: number },
  preloadedProfile?: PreloadedProfileRow
): Promise<MemoryArchive> {
  const editionLimit = options?.editionLimit ?? 14;
  const since = new Date();
  since.setDate(since.getDate() - (options?.signalDays ?? 45));

  const [editionsRes, signalsRes, clipsRes, profileRes] = await Promise.all([
    supabaseAdmin
      .from("editions")
      .select(
        "edition_date, lead_story, editorial_context, discovery, knowledge"
      )
      .eq("user_id", userId)
      .order("edition_date", { ascending: false })
      .limit(editionLimit),
    supabaseAdmin
      .from("user_reading_signals")
      .select(
        "signal_type, story_key, section_type, payload, created_at"
      )
      .eq("user_id", userId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(300),
    supabaseAdmin
      .from("clippings")
      .select("story_key, section_type, source, headline, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    preloadedProfile !== undefined
      ? Promise.resolve({ data: preloadedProfile, error: null })
      : supabaseAdmin
          .from("profiles")
          .select("home_location, travel")
          .eq("id", userId)
          .maybeSingle(),
  ]);

  if (editionsRes.error) {
    console.log("[memory] editions archive", { error: editionsRes.error.message });
  }
  if (signalsRes.error) {
    console.log("[memory] signals archive", { error: signalsRes.error.message });
  }
  if (clipsRes.error) {
    console.log("[memory] clippings archive", { error: clipsRes.error.message });
  }
  if (profileRes.error) {
    console.log("[memory] profile archive", { error: profileRes.error.message });
  }

  const profile = profileRes.data as {
    home_location?: {
      city?: string | null;
      region?: string | null;
      state?: string | null;
    } | null;
    travel?: {
      away?: boolean;
      city?: string | null;
      until?: string | null;
      note?: string | null;
    } | null;
  } | null;

  const priorEditions: MemoryPriorEdition[] = (editionsRes.data ?? []).map(
    (row) => {
      const lead = row.lead_story as {
        id?: string;
        headline?: string;
      } | null;
      const ctx = row.editorial_context as {
        sections?: Array<{
          sectionType?: string;
          items?: Array<{ title?: string; id?: string }>;
        }>;
      } | null;
      const top = ctx?.sections?.find((s) => s.sectionType === "top_stories");
      const discovery = row.discovery as {
        picks?: Array<{
          id?: string;
          title?: string;
          category?: string;
          why?: string;
        }>;
      } | null;
      const knowledge = row.knowledge as {
        highlights?: Array<{
          storyKey?: string;
          headline?: string;
          facetType?: string;
          why?: string;
        }>;
      } | null;

      return {
        editionDate: String(row.edition_date).slice(0, 10),
        lead: lead
          ? { id: lead.id, headline: lead.headline }
          : null,
        topStories: (top?.items ?? []).map((i) => ({
          id: i.id,
          title: i.title,
        })),
        discoveryPicks: (discovery?.picks ?? [])
          .filter((p) => p.title)
          .slice(0, 8)
          .map((p) => ({
            id: p.id,
            title: p.title!,
            category: p.category,
            why: p.why,
          })),
        knowledgeHighlights: (knowledge?.highlights ?? [])
          .filter((h) => h.headline)
          .slice(0, 8)
          .map((h) => ({
            storyKey: h.storyKey,
            headline: h.headline!,
            facetType: h.facetType,
            why: h.why,
          })),
      };
    }
  );

  // Unfinished: latest read_progress per story below completion threshold.
  const unfinishedMap = new Map<string, MemoryUnfinishedRead>();
  let lastReadAt: string | null = null;
  const openDays = new Set<string>();

  for (const raw of signalsRes.data ?? []) {
    const row = raw as {
      signal_type?: string;
      story_key?: string;
      section_type?: string | null;
      payload?: Record<string, unknown> | null;
      created_at?: string;
    };
    if (row.created_at) {
      if (!lastReadAt || row.created_at > lastReadAt) {
        lastReadAt = row.created_at;
      }
      openDays.add(row.created_at.slice(0, 10));
    }

    if (row.signal_type !== "read_progress" || !row.story_key) continue;
    const scroll = Number(row.payload?.scroll_pct ?? 0);
    if (scroll >= 85) continue;
    if (scroll < 12) continue;

    const existing = unfinishedMap.get(row.story_key);
    if (existing && existing.updatedAt >= (row.created_at ?? "")) continue;

    unfinishedMap.set(row.story_key, {
      storyKey: row.story_key,
      headline:
        typeof row.payload?.headline === "string"
          ? row.payload.headline
          : null,
      sectionType: row.section_type ?? null,
      scrollPct: scroll,
      updatedAt: row.created_at ?? new Date().toISOString(),
    });
  }

  // Drop unfinished if a later read_complete exists for same key.
  for (const raw of signalsRes.data ?? []) {
    const row = raw as { signal_type?: string; story_key?: string };
    if (row.signal_type === "read_complete" && row.story_key) {
      unfinishedMap.delete(row.story_key);
    }
  }

  const clippings: MemoryClipping[] = (clipsRes.data ?? []).map((c) => {
    const row = c as {
      story_key?: string | null;
      headline?: string | null;
      source?: string | null;
      section_type?: string | null;
      created_at?: string | null;
    };
    return {
      storyKey: row.story_key || row.headline || "clip",
      headline: row.headline ?? null,
      source: row.source ?? null,
      sectionType: row.section_type ?? null,
      createdAt: row.created_at ?? null,
    };
  });

  console.log("[memory] archive loaded", {
    priorEditions: priorEditions.length,
    unfinished: unfinishedMap.size,
    clippings: clippings.length,
    openDays: openDays.size,
  });

  return {
    priorEditions,
    unfinishedReads: Array.from(unfinishedMap.values()).slice(0, 12),
    clippings,
    lastReadAt,
    openDays: Array.from(openDays),
    homeLocation: profile?.home_location ?? null,
    travel: profile?.travel ?? null,
  };
}
