/**
 * Permanent The Story of... library — load once per edition build, no AI.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { storyOfMetroKeysForLocation } from "../../../../lib/markets/libraryMetroKeys.ts";
import { citiesMatch } from "../../../../lib/location/locationKey.ts";
import { storyOfHeadline, type CityArticleRow, type CityArticleSnapshot } from "./types.ts";

const STORY_OF_SELECT =
  "id, metro_key, city_name, state, region, headline, subtitle, body, image_url, image_caption, image_credit, image_source_url, image_license, sources, verification_notes, word_count, approval_status, published_at";

function rowToSnapshot(row: CityArticleRow): CityArticleSnapshot {
  return {
    metroKey: row.metro_key,
    cityName: row.city_name,
    headline: row.headline,
    subtitle: row.subtitle?.trim() ?? "",
    body: row.body,
    furtherReading: Array.isArray(row.sources) ? row.sources.filter(Boolean) : [],
    image: {
      url: row.image_url,
      caption: row.image_caption,
      credit: row.image_credit,
      sourceUrl: row.image_source_url,
      license: row.image_license,
    },
  };
}

export async function fetchApprovedCityArticle(
  admin: SupabaseClient,
  location: {
    city: string;
    state?: string | null;
    region?: string | null;
    lat?: number;
    lon?: number;
  }
): Promise<CityArticleSnapshot | null> {
  const city = location.city?.trim();
  if (!city || city.toLowerCase() === "your area") return null;

  const metroKeys = storyOfMetroKeysForLocation({
    city,
    state: location.state,
    region: location.region,
    lat: location.lat ?? NaN,
    lon: location.lon ?? NaN,
  });

  for (const metroKey of metroKeys) {
    const { data, error } = await admin
      .from("kindred_city_articles")
      .select(STORY_OF_SELECT)
      .eq("metro_key", metroKey)
      .eq("approval_status", "approved")
      .maybeSingle();

    if (error) {
      console.warn("[storyOf] library lookup failed", {
        metroKey,
        message: error.message,
      });
      continue;
    }

    if (!data?.headline?.trim() || !data?.body?.trim()) {
      continue;
    }

    const snapshot = rowToSnapshot(data as CityArticleRow);
    if (!snapshot.subtitle) {
      console.warn("[storyOf] approved article missing subtitle", { metroKey });
      continue;
    }

    if (!citiesMatch(snapshot.cityName, city)) {
      console.warn("[storyOf] city name mismatch — skipping article", {
        metroKey,
        editionCity: city,
        articleCity: snapshot.cityName,
      });
      continue;
    }

    const expectedHeadline = storyOfHeadline(snapshot.cityName);
    if (snapshot.headline.trim() !== expectedHeadline) {
      console.warn("[storyOf] headline mismatch — expected canonical title", {
        metroKey,
        expected: expectedHeadline,
        got: snapshot.headline.slice(0, 80),
      });
      continue;
    }

    console.log("[storyOf] library hit", {
      metroKey,
      cityName: data.city_name,
      wordCount: data.word_count,
    });

    return snapshot;
  }

  return null;
}
