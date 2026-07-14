/**
 * Client mirror of supabase/functions/_shared/heroArtwork/types.ts — keep in sync.
 * Hero Artwork is a separate desk from editorial photography (_shared/images/*).
 */

import type { HeroArtworkCollectionId } from "./collections";

export type HeroArtworkOrientation = "portrait" | "landscape" | "square";

export type HeroArtworkSeason = "spring" | "summer" | "autumn" | "winter";

export type HeroArtworkHoliday =
  | "new_year"
  | "valentines"
  | "st_patricks"
  | "easter"
  | "memorial_day"
  | "independence_day"
  | "labor_day"
  | "halloween"
  | "thanksgiving"
  | "christmas"
  | "new_years_eve";

export type HeroArtworkPublicDomainStatus = "pending" | "verified" | "rejected";

export type HeroArtworkApprovalStatus = "pending" | "approved" | "rejected";

export type HeroArtworkCuratorEditorialStatus = "pending" | "approved" | "rejected";

export type HeroArtworkSourceProvider =
  | "met"
  | "national_gallery_art"
  | "rijksmuseum"
  | "smithsonian"
  | "loc"
  | "wikimedia"
  | "nasa"
  | "national_archives"
  | "art_institute_chicago"
  | "kindred_curated";

export type HeroArtworkLicense =
  | "public_domain"
  | "cc0"
  | "museum_open_access"
  | "government_work";

export type HeroArtworkAsset = {
  id: string;
  internalId: string;
  artworkTitle: string;
  artist: string;
  year: string | null;
  sourceInstitution: string;
  sourceUrl: string;
  imageSource: { uri: string } | null;
  orientation: HeroArtworkOrientation | null;
  dominantColors: string[];
  collections: HeroArtworkCollectionId[];
  moodTags: string[];
  tags: string[];
  seasons: HeroArtworkSeason[];
  holidays: HeroArtworkHoliday[];
  license: HeroArtworkLicense | string;
  licenseUrl: string | null;
  publicDomainStatus: HeroArtworkPublicDomainStatus;
  verificationSource: string | null;
  commercialUseConfirmed: boolean;
  approvalStatus: HeroArtworkApprovalStatus;
  verifiedAt: string | null;
  aboutArtworkBody: string | null;
  curatorEditorialStatus: HeroArtworkCuratorEditorialStatus;
  banditMorningNote: string | null;
  attributionText: string | null;
  attributionRequired: boolean;
  featured: boolean;
  editorialPriority: number;
};

export type HeroArtworkContext = {
  date?: Date | string | null;
  season?: HeroArtworkSeason | null;
  holiday?: HeroArtworkHoliday | null;
  recentArtworkIds?: string[] | null;
  recentCollectionIds?: HeroArtworkCollectionId[] | null;
  weatherHint?: "hot" | "cold" | "rain" | "clear" | null;
};

export type ScoredHeroArtwork = {
  asset: HeroArtworkAsset;
  score: number;
  reasons: string[];
};

export type MorningHeroExperience = {
  editionDate: string;
  artworkId: string;
  artworkTitle: string;
  artist: string;
  year: string | null;
  sourceInstitution: string;
  sourceUrl: string;
  imageUrl: string | null;
  hostedUrl: string | null;
  attributionText: string;
  collections: HeroArtworkCollectionId[];
  aboutArtworkHeading: "About Today's Artwork";
  aboutArtworkBody: string;
  aboutWordCount: number;
  banditMorningNote: string;
};

export type { HeroArtworkCollectionId };
