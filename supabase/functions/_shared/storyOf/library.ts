/**
 * Permanent The Story of... library — load once per edition build, no AI.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { metroKeyFromLocation } from "./metroKey.ts";
import { storyOfHeadline, type CityArticleRow, type CityArticleSnapshot } from "./types.ts";

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
  location: { city: string; state?: string | null; region?: string | null }
): Promise<CityArticleSnapshot | null> {
  const city = location.city?.trim();
  if (!city || city.toLowerCase() === "your area") return null;

  const metroKey = metroKeyFromLocation(location);

  const { data, error } = await admin
    .from("kindred_city_articles")
    .select(
      "id, metro_key, city_name, state, region, headline, subtitle, body, image_url, image_caption, image_credit, image_source_url, image_license, sources, verification_notes, word_count, approval_status, published_at"
    )
    .eq("metro_key", metroKey)
    .eq("approval_status", "approved")
    .maybeSingle();

  if (error) {
    console.warn("[storyOf] library lookup failed", {
      metroKey,
      message: error.message,
    });
    return null;
  }

  if (!data?.headline?.trim() || !data?.body?.trim()) {
    return null;
  }

  const snapshot = rowToSnapshot(data as CityArticleRow);
  if (!snapshot.subtitle) {
    console.warn("[storyOf] approved article missing subtitle", { metroKey });
    return null;
  }

  const expectedHeadline = storyOfHeadline(snapshot.cityName);
  if (snapshot.headline.trim() !== expectedHeadline) {
    console.warn("[storyOf] headline mismatch — expected canonical title", {
      metroKey,
      expected: expectedHeadline,
      got: snapshot.headline.slice(0, 80),
    });
    return null;
  }

  console.log("[storyOf] library hit", {
    metroKey,
    cityName: data.city_name,
    wordCount: data.word_count,
  });

  return snapshot;
}
