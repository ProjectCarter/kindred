import { supabase } from "../supabase";
import type { ReadingSignalInput } from "./types";
import {
  isPersonalLibraryEnabled,
  isPersonalLibrarySignalType,
} from "../edition/clippingsFeature";

/**
 * Fire-and-forget signal write. Never blocks reading UX.
 * Safe to call from Lead, Top Stories, Sports, Science, etc.
 */
export async function trackReadingSignal(
  input: ReadingSignalInput
): Promise<void> {
  if (
    !isPersonalLibraryEnabled() &&
    isPersonalLibrarySignalType(input.signalType)
  ) {
    return;
  }
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const storyKey = input.storyKey?.trim();
    if (!storyKey) return;

    const { error } = await supabase.from("user_reading_signals").insert({
      user_id: user.id,
      signal_type: input.signalType,
      story_key: storyKey.slice(0, 240),
      section_type: input.sectionType ?? null,
      edition_id: input.editionId ?? null,
      section_id: input.sectionId ?? null,
      source: input.source?.trim() || null,
      topic: input.topic?.trim() || null,
      payload: input.payload ?? {},
    });

    if (error) {
      // Table may not be migrated yet — fail quietly.
      if (__DEV__) {
        console.log("[personalization] signal skipped", error.message);
      }
    }
  } catch (err) {
    if (__DEV__) {
      console.log(
        "[personalization] signal error",
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

export function inferTopicFromSection(
  sectionType: string | null | undefined,
  headline?: string | null
): string | null {
  if (sectionType && sectionType !== "lead" && sectionType !== "top_stories") {
    return sectionType;
  }
  if (!headline) return sectionType ?? null;
  const h = headline.toLowerCase();
  if (/\b(nba|nfl|mlb|soccer|olympics|game|match|coach)\b/.test(h)) {
    return "sports";
  }
  if (/\b(stock|market|bank|economy|earnings|fed)\b/.test(h)) {
    return "business";
  }
  if (/\b(nasa|space|climate|scientist|study|research)\b/.test(h)) {
    return "science";
  }
  if (/\b(recipe|cook|kitchen|restaurant|chef)\b/.test(h)) {
    return "cooking";
  }
  if (/\b(car|auto|ev|vehicle|driver)\b/.test(h)) {
    return "cars";
  }
  if (/\b(tech|software|ai|apple|google|cyber)\b/.test(h)) {
    return "technology";
  }
  return sectionType ?? null;
}
