import type { HeroArtworkHoliday, HeroArtworkSeason, HeroArtworkSourceProvider } from "./types";

/**
 * Curator plan metadata — keep in sync with
 * supabase/functions/_shared/heroArtwork/initialLibraryPlan.ts
 */
export type PlannedHeroArtwork = {
  planId: string;
  artworkTitle: string;
  artist: string;
  year: string;
  sourceInstitution: string;
  sourceProvider: HeroArtworkSourceProvider;
  providerArtworkId: string | null;
  tags: string[];
  seasons: HeroArtworkSeason[];
  holidays?: HeroArtworkHoliday[];
  notes?: string;
  status: "planned";
};

/** Count only on client — full plan lives in the server module until population. */
export const INITIAL_HERO_ARTWORK_PLAN_COUNT = 54;
