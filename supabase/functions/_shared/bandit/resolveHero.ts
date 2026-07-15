/**
 * Resolve a topic-specific hero for Bandit's Pick at edition build time.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { EditionImageRegistry } from "../images/editionRegistry.ts";
import { selectEditorialImage } from "../images/select.ts";
import type { EditorialImageRecord } from "../images/types.ts";
import type { BanditsPickStory } from "./selectPick.ts";
import {
  heroSubjectForHeadline,
  heroSubjectForMoment,
  momentIdFromBanditPickId,
} from "./heroSubject.ts";

export async function resolveBanditsPickHeroImage(
  admin: SupabaseClient,
  story: BanditsPickStory,
  location: { city?: string | null; state?: string | null },
  registry: EditionImageRegistry
): Promise<EditorialImageRecord | null> {
  if (story.imageUrl?.trim()) return null;

  const momentId = momentIdFromBanditPickId(story.id);
  const subject =
    (momentId ? heroSubjectForMoment(momentId) : null) ??
    heroSubjectForHeadline(story.headline);

  if (!subject) {
    console.log("[bandit:hero] no subject match", {
      id: story.id,
      headline: story.headline.slice(0, 60),
    });
    return null;
  }

  if (subject.genericOk) {
    console.log("[bandit:hero] generic topic — caller may use seasonal mood asset", {
      momentId: subject.momentId,
    });
    return null;
  }

  const image = await selectEditorialImage(
    admin,
    {
      title: subject.searchTitle,
      dek: subject.searchDek,
      discoveryCategory: "experiences",
      city: location.city ?? null,
      environment: location.state ?? null,
      orientation: "landscape",
    },
    registry
  );

  if (image?.url) {
    console.log("[bandit:hero] resolved", {
      momentId: subject.momentId,
      headline: story.headline.slice(0, 60),
      libraryId: image.libraryId,
    });
    return image;
  }

  if (subject.verifiedImageUrl?.trim()) {
    console.log("[bandit:hero] verified fallback", {
      momentId: subject.momentId,
      headline: story.headline.slice(0, 60),
    });
    return {
      url: subject.verifiedImageUrl.trim(),
      libraryId: `bandit-verified-${subject.momentId}`,
      attributionText: "Pexels",
      source: "pexels",
      orientation: "landscape",
    };
  }

  return null;
}
