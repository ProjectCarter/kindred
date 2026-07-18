/**
 * The Story of [City Name] recovery — when edition_sections lacks story_of
 * (editions built before the library shipped), hydrate from kindred_city_articles.
 */

import { supabase } from "../supabase";
import type { KindredPlace } from "../location/types";
import { storyOfMetroKeysForLocation } from "../markets/libraryMetroKeys";
import { citiesMatch } from "../location/locationKey";
import type { EditionSection } from "./types";
import {
  editionSectionFromCityArticle,
  isStoryOfSection,
  storyOfSectionMatchesCity,
  storyOfTitle,
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

/** Replace a story_of row built for the wrong city (e.g. Phoenix on a Gilbert edition). */
export function needsStoryOfCityRepair(
  sections: EditionSection[],
  city: string
): boolean {
  const trimmed = city?.trim();
  if (!trimmed || trimmed.toLowerCase() === "your area") return false;
  const story = sections.find((s) => isStoryOfSection(s.section_type));
  if (!story) return false;
  return !storyOfSectionMatchesCity(story, trimmed);
}

async function fetchApprovedCityArticleForPlace(
  place: KindredPlace
): Promise<{ row: CityArticleLibraryRow; metroKey: string } | null> {
  const city = place.city?.trim();
  if (!city) return null;

  const metroKeys = storyOfMetroKeysForLocation({
    city,
    state: place.state ?? null,
    region: place.region ?? null,
    lat: place.lat,
    lon: place.lon,
  });

  for (const metroKey of metroKeys) {
    const { data, error } = await supabase
      .from("kindred_city_articles")
      .select(
        "metro_key, city_name, headline, subtitle, body, image_url, image_caption, image_credit, image_source_url, image_license, sources"
      )
      .eq("metro_key", metroKey)
      .eq("approval_status", "approved")
      .maybeSingle();

    if (error || !data) continue;

    const row = data as CityArticleLibraryRow;
    if (!row.headline?.trim() || !row.body?.trim() || !row.subtitle?.trim()) {
      continue;
    }
    if (!citiesMatch(row.city_name, city)) continue;
    if (row.headline.trim() !== storyOfTitle(row.city_name)) continue;

    return { row, metroKey };
  }

  return null;
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

  const city = place?.city?.trim();
  if (!city || city.toLowerCase() === "your area") {
    return {
      attempted: false,
      recovered: false,
      sections: currentSections,
      error: "no_city",
    };
  }

  const needsRepair = needsStoryOfCityRepair(currentSections, city);
  const needsInsert = needsStoryOfRecovery(currentSections);

  if (!needsInsert && !needsRepair) {
    return {
      attempted: false,
      recovered: false,
      sections: currentSections,
    };
  }

  const metroKeys = storyOfMetroKeysForLocation({
    city,
    state: place?.state ?? null,
    region: place?.region ?? null,
    lat: place?.lat ?? NaN,
    lon: place?.lon ?? NaN,
  });
  const metroKey = metroKeys[0] ?? city.toLowerCase().replace(/\s+/g, "-");

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
  if (!place) {
    return {
      attempted: true,
      recovered: false,
      sections: currentSections,
      metroKey,
      error: "no_place",
    };
  }

  const libraryHit = await fetchApprovedCityArticleForPlace(place);
  if (!libraryHit) {
    if (__DEV__) {
      console.log("[storyOf:recovery] no approved article for city", { city, metroKeys });
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
    libraryHit.row,
    libraryHit.metroKey
  );

  if (!storySection) {
    return {
      attempted: true,
      recovered: false,
      sections: currentSections,
      metroKey: libraryHit.metroKey,
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
      metroKey: libraryHit.metroKey,
      headline: storySection.headline,
      repaired: needsRepair,
    });
  }

  return {
    attempted: true,
    recovered: true,
    sections: merged,
    headline: storySection.headline,
    metroKey: libraryHit.metroKey,
    source: "client",
  };
}
