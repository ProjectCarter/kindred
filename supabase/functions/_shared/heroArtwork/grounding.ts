import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  lookupHeroArtworkSubject,
  type KnowledgeLookupResult,
} from "../knowledge/providers/index.ts";

/**
 * Ground hero artwork artist/subject metadata from Wikipedia.
 * Call when a hero artwork is selected for an edition — not during
 * generic local recommendation article generation.
 */
export async function groundHeroArtworkMetadata(
  admin: SupabaseClient,
  input: { artist: string; artworkTitle?: string | null }
): Promise<KnowledgeLookupResult | null> {
  return lookupHeroArtworkSubject(admin, input);
}
