/**
 * Persist story_of into edition_sections when missing — for editions built
 * before the city article library shipped.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { fetchApprovedCityArticle } from "./library.ts";
import { cityArticleSourceNote } from "./sourceNote.ts";
import { storyOfHeadline } from "./types.ts";

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
      lat?: number;
      lon?: number;
    };
  }
): Promise<EnsureStoryOfSectionResult> {
  const city = input.location.city?.trim();
  if (!city || city.toLowerCase() === "your area") {
    return { ok: true, changed: false, error: "no_city" };
  }

  const expectedHeadline = storyOfHeadline(city);

  const { data: existing, error: existingError } = await admin
    .from("edition_sections")
    .select("id, section_type, headline")
    .eq("edition_id", input.editionId)
    .in("section_type", ["story_of", "your_city"])
    .maybeSingle();

  if (existingError) {
    return { ok: false, changed: false, error: existingError.message };
  }

  if (existing?.id && existing.headline?.trim() === expectedHeadline) {
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

  if (existing?.id) {
    const { error: deleteError } = await admin
      .from("edition_sections")
      .delete()
      .eq("id", existing.id);
    if (deleteError) {
      return { ok: false, changed: false, error: deleteError.message };
    }
    console.warn("[storyOf] replaced wrong-city story_of section", {
      editionId: input.editionId,
      previousHeadline: existing.headline?.slice(0, 80) ?? null,
      nextHeadline: article.headline,
    });
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
