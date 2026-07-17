/**
 * The Story of [City Name] recovery — when edition_sections lacks story_of
 * (editions built before the library shipped), hydrate from kindred_city_articles.
 */

import { supabase } from "../supabase";
import type { KindredPlace } from "../location/types";
import { metroKeyFromPlace } from "../location/metroKey";
import type { EditionSection } from "./types";
import {
  editionSectionFromCityArticle,
  isStoryOfSection,
  type CityArticleLibraryRow,
} from "./storyOf";
import { loadWithRetry } from "./loadWithRetry";
import {
  saveCachedEdition,
  type CachedEditionBundle,
} from "./editionCache";

const RECOVERY_THROTTLE_MS = 60_000;
const lastRecoveryAt = new Map<string, number>();

export type StoryOfRecoveryResult = {
  attempted: boolean;
  recovered: boolean;
  sections: EditionSection[];
  headline?: string | null;
  metroKey?: string | null;
  source?: "server" | "client" | null;
  error?: string | null;
};

function recoveryKey(editionId: string, metroKey: string): string {
  return `${editionId}:${metroKey}`;
}

function canAttemptRecovery(editionId: string, metroKey: string): boolean {
  const key = recoveryKey(editionId, metroKey);
  const last = lastRecoveryAt.get(key) ?? 0;
  return Date.now() - last >= RECOVERY_THROTTLE_MS;
}

function markRecoveryAttempt(editionId: string, metroKey: string): void {
  lastRecoveryAt.set(recoveryKey(editionId, metroKey), Date.now());
}

export function needsStoryOfRecovery(sections: EditionSection[]): boolean {
  return !sections.some((s) => isStoryOfSection(s.section_type));
}

function mergeStoryOfSection(
  sections: EditionSection[],
  storySection: EditionSection
): EditionSection[] {
  const without = sections.filter((s) => !isStoryOfSection(s.section_type));
  return [...without, storySection].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
}

async function fetchStoryOfSection(
  editionId: string
): Promise<EditionSection | null> {
  const { data, error } = await supabase
    .from("edition_sections")
    .select("id, section_type, position, headline, body, source_note")
    .eq("edition_id", editionId)
    .in("section_type", ["story_of", "your_city"])
    .maybeSingle();

  if (error && __DEV__) {
    console.warn("[storyOf:recovery] section fetch error", error.message);
    return null;
  }

  return (data as EditionSection | null) ?? null;
}

export async function recoverStoryOf(params: {
  editionId: string;
  editionDate: string;
  place: KindredPlace | null;
  currentSections: EditionSection[];
  cachedBundle?: CachedEditionBundle | null;
}): Promise<StoryOfRecoveryResult> {
  const { editionId, editionDate, place, currentSections, cachedBundle } = params;

  if (!needsStoryOfRecovery(currentSections)) {
    return {
      attempted: false,
      recovered: false,
      sections: currentSections,
    };
  }

  const city = place?.city?.trim();
  if (!city || city.toLowerCase() === "your area") {
    return {
      attempted: false,
      recovered: false,
      sections: currentSections,
      error: "no_city",
    };
  }

  const metroKey = metroKeyFromPlace({
    city,
    state: place?.state ?? null,
    region: place?.region ?? null,
  });

  if (!canAttemptRecovery(editionId, metroKey)) {
    return {
      attempted: false,
      recovered: false,
      sections: currentSections,
      error: "throttled",
    };
  }

  markRecoveryAttempt(editionId, metroKey);

  // Server persist — writes a real edition_sections row with a clippable UUID.
  const serverResult = await loadWithRetry(
    async () => {
      const { data, error } = await supabase.functions.invoke(
        "ensure-story-of-section",
        {
          body: {
            editionDate,
            location: place
              ? {
                  city: place.city,
                  state: place.state ?? null,
                  region: place.region ?? null,
                  lat: place.lat,
                  lon: place.lon,
                }
              : undefined,
          },
        }
      );
      if (error) throw new Error(error.message);
      return data as {
        ok?: boolean;
        changed?: boolean;
        headline?: string;
        error?: string;
      };
    },
    { label: "recoverStoryOf", maxAttempts: 2 }
  );

  if (serverResult.ok && serverResult.value?.ok && serverResult.value.changed) {
    const sectionRow = await fetchStoryOfSection(editionId);
    if (sectionRow) {
      const merged = mergeStoryOfSection(currentSections, sectionRow);

      if (cachedBundle) {
        void saveCachedEdition({
          ...cachedBundle,
          sections: merged,
          cachedAt: Date.now(),
        });
      }

      if (__DEV__) {
        console.log("[storyOf:recovery] server persist succeeded", {
          headline: sectionRow.headline,
        });
      }

      return {
        attempted: true,
        recovered: true,
        sections: merged,
        headline: sectionRow.headline,
        metroKey,
        source: "server",
      };
    }
  }

  // Client fallback — display immediately when server is unavailable.
  const { data, error } = await supabase
    .from("kindred_city_articles")
    .select(
      "metro_key, city_name, headline, subtitle, body, image_url, image_caption, image_credit, image_source_url, image_license, sources"
    )
    .eq("metro_key", metroKey)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error) {
    if (__DEV__) {
      console.warn("[storyOf:recovery] library lookup failed", {
        metroKey,
        message: error.message,
      });
    }
    return {
      attempted: true,
      recovered: false,
      sections: currentSections,
      metroKey,
      error: error.message,
    };
  }

  if (!data) {
    if (__DEV__) {
      console.log("[storyOf:recovery] no approved article for metro", { metroKey });
    }
    return {
      attempted: true,
      recovered: false,
      sections: currentSections,
      metroKey,
      error: "no_article",
    };
  }

  const storySection = editionSectionFromCityArticle(
    data as CityArticleLibraryRow,
    metroKey
  );

  if (!storySection) {
    return {
      attempted: true,
      recovered: false,
      sections: currentSections,
      metroKey,
      error: "invalid_article",
    };
  }

  const merged = mergeStoryOfSection(currentSections, storySection);

  if (cachedBundle) {
    void saveCachedEdition({
      ...cachedBundle,
      sections: merged,
      cachedAt: Date.now(),
    });
  }

  if (__DEV__) {
    console.log("[storyOf:recovery] client fallback applied", {
      metroKey,
      headline: storySection.headline,
    });
  }

  return {
    attempted: true,
    recovered: true,
    sections: merged,
    headline: storySection.headline,
    metroKey,
    source: "client",
  };
}
