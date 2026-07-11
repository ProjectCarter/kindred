import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  aggregateReadingSignals,
  mergeSourceLists,
  mergeTopicLists,
} from "./aggregate.ts";
import type {
  PersonalizationProfile,
  ReadingSignalRow,
} from "./types.ts";

type LocationHint = {
  city?: string | null;
  region?: string | null;
  state?: string | null;
  lat?: number | null;
  lon?: number | null;
};

/**
 * Load a reusable PersonalizationProfile for ranking.
 * Merges onboarding interests, derived affinities, clippings, and location.
 */
export async function loadPersonalizationProfile(
  supabaseAdmin: SupabaseClient,
  userId: string,
  locationHint?: LocationHint
): Promise<PersonalizationProfile> {
  const since = new Date();
  since.setDate(since.getDate() - 45);

  const [profileRes, signalsRes, clipsRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select(
        "interests, followed_topics, favorite_sources, skipped_topics, location"
      )
      .eq("id", userId)
      .single(),
    supabaseAdmin
      .from("user_reading_signals")
      .select(
        "signal_type, story_key, section_type, source, topic, payload, created_at"
      )
      .eq("user_id", userId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(400),
    supabaseAdmin
      .from("clippings")
      .select("story_key, section_type, source, headline, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const profile = profileRes.data as {
    interests?: string[] | null;
    followed_topics?: string[] | null;
    favorite_sources?: string[] | null;
    skipped_topics?: string[] | null;
    location?: LocationHint | null;
  } | null;

  // If new columns aren't migrated yet, interests-only still works.
  const interests: string[] = profile?.interests ?? [];
  const followedFromProfile: string[] = profile?.followed_topics ?? [];
  const favoritesFromProfile: string[] = profile?.favorite_sources ?? [];
  const skippedFromProfile: string[] = profile?.skipped_topics ?? [];

  const signalRows = (signalsRes.data ?? []) as ReadingSignalRow[];
  // Treat missing table as empty — edition build must not fail.
  if (signalsRes.error) {
    console.log("[personalization] signals load", {
      error: signalsRes.error.message,
    });
  }
  if (clipsRes.error) {
    console.log("[personalization] clippings load", {
      error: clipsRes.error.message,
    });
  }

  const affinities = aggregateReadingSignals(signalRows);

  // Clippings reinforce topic/source even if signal insert lagged.
  for (const clip of clipsRes.data ?? []) {
    const row = clip as {
      story_key?: string | null;
      section_type?: string | null;
      source?: string | null;
      headline?: string | null;
    };
    if (row.story_key) affinities.clippedStoryKeys.push(row.story_key);
    if (row.headline) {
      affinities.engagedStoryKeys.push(row.headline);
    }
  }
  affinities.clippedStoryKeys = Array.from(
    new Set(affinities.clippedStoryKeys)
  ).slice(0, 40);
  affinities.engagedStoryKeys = Array.from(
    new Set(affinities.engagedStoryKeys)
  ).slice(0, 40);

  const followedTopics = mergeTopicLists(
    [...followedFromProfile, ...interests],
    affinities.followedTopics
  );
  const favoriteSources = mergeSourceLists(
    favoritesFromProfile,
    affinities.favoriteSources
  );
  const skippedTopics = mergeTopicLists(
    skippedFromProfile,
    affinities.skippedTopics
  );

  const storedLoc = profile?.location ?? null;
  const city =
    locationHint?.city && locationHint.city !== "your area"
      ? locationHint.city
      : storedLoc?.city && storedLoc.city !== "your area"
      ? storedLoc.city
      : null;
  const region = locationHint?.region ?? storedLoc?.region ?? null;
  const state = locationHint?.state ?? storedLoc?.state ?? null;

  // Quietly persist derived prefs + location for overnight builds.
  void syncDerivedPreferences(supabaseAdmin, userId, {
    followedTopics,
    favoriteSources,
    skippedTopics,
    location:
      city || locationHint?.lat != null
        ? {
            city,
            region,
            state,
            lat: locationHint?.lat ?? storedLoc?.lat ?? null,
            lon: locationHint?.lon ?? storedLoc?.lon ?? null,
          }
        : storedLoc,
  });

  console.log("[personalization] profile loaded", {
    interestCount: interests.length,
    signalCount: signalRows.length,
    favoriteSources: favoriteSources.slice(0, 4),
    followedTopics: followedTopics.slice(0, 4),
    skippedTopics: skippedTopics.slice(0, 3),
    confidence: affinities.confidence,
    city,
  });

  return {
    interests,
    followedTopics,
    favoriteSources,
    skippedTopics,
    city,
    region,
    state,
    lat: locationHint?.lat ?? storedLoc?.lat ?? null,
    lon: locationHint?.lon ?? storedLoc?.lon ?? null,
    affinities,
  };
}

async function syncDerivedPreferences(
  supabaseAdmin: SupabaseClient,
  userId: string,
  derived: {
    followedTopics: string[];
    favoriteSources: string[];
    skippedTopics: string[];
    location: LocationHint | null;
  }
): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        followed_topics: derived.followedTopics.slice(0, 12),
        favorite_sources: derived.favoriteSources.slice(0, 10),
        skipped_topics: derived.skippedTopics.slice(0, 8),
        location: derived.location,
      })
      .eq("id", userId);
    if (error) {
      console.log("[personalization] sync prefs", { error: error.message });
    }
  } catch (err) {
    console.log("[personalization] sync prefs failed", String(err));
  }
}
