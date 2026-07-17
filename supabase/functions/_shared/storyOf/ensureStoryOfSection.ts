/**
 * Persist story_of into edition_sections when missing — for editions built
 * before the city article library shipped.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { fetchApprovedCityArticle } from "./library.ts";
import { cityArticleSourceNote } from "./sourceNote.ts";

export type EnsureStoryOfSectionResult = {
  ok: boolean;
  changed: boolean;
  headline?: string | null;
  metroKey?: string | null;
  error?: string | null;
};

export async function ensureStoryOfSectionForEdition(
  admin: SupabaseClient,
  input: {
    editionId: string;
    location: {
      city: string;
      state?: string | null;
      region?: string | null;
    };
  }
): Promise<EnsureStoryOfSectionResult> {
  const { data: existing, error: existingError } = await admin
    .from("edition_sections")
    .select("id, section_type")
    .eq("edition_id", input.editionId)
    .in("section_type", ["story_of", "your_city"])
    .maybeSingle();

  if (existingError) {
    return { ok: false, changed: false, error: existingError.message };
  }

  if (existing?.id) {
    return { ok: true, changed: false };
  }

  const article = await fetchApprovedCityArticle(admin, input.location);
  if (!article) {
    return {
      ok: true,
      changed: false,
      error: "no_approved_article",
      metroKey: null,
    };
  }

  const { error: insertError } = await admin.from("edition_sections").insert({
    edition_id: input.editionId,
    section_type: "story_of",
    position: 5,
    headline: article.headline,
    body: article.body,
    source_note: cityArticleSourceNote(article),
  });

  if (insertError) {
    return { ok: false, changed: false, error: insertError.message };
  }

  console.log("[storyOf] ensure section persisted", {
    editionId: input.editionId,
    metroKey: article.metroKey,
    headline: article.headline.slice(0, 60),
  });

  return {
    ok: true,
    changed: true,
    headline: article.headline,
    metroKey: article.metroKey,
  };
}
