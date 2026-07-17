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

export type MasterpieceArticleSection = {
  heading: string;
  paragraphs: string[];
};

export type MasterpieceDetail = {
  sections: MasterpieceArticleSection[];
  lookingCloser: string[];
  didYouKnow: string;
  museumName: string;
  museumLocation: string;
  officialMuseumUrl: string | null;
  officialArtworkUrl: string | null;
  sourceReferences: string[];
  /** Legacy flat story — ignored when sections are present. */
  longStoryBody?: string;
  longStoryParagraphs?: string[];
  artistBiography?: string;
  lookCloserItems?: string[];
};

export type MorningHeroExperience = {
  editionDate: string;
  artworkId: string;
  artworkTitle: string;
  artist: string;
  year: string | null;
  sourceInstitution: string;
  sourceUrl: string;
  license: string;
  licenseUrl?: string | null;
  /** Mobile-optimized hosted asset — never museum full resolution. */
  hostedUrl: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  aspectRatio: number;
  /** Pre-authored full credit line. */
  creditLine: string;
  /** Legacy alias — older editions may only have attributionText. */
  attributionText?: string;
  collections: HeroArtworkCollectionId[];
  /** 1–2 sentence homepage teaser — pre-authored at ingest. */
  aboutArtworkBody: string;
  aboutWordCount: number;
  /** Full detail article — loaded on tap only; never rendered on homepage. */
  detail?: MasterpieceDetail | null;
  /** Legacy fields — ignored by current hero UI. */
  aboutArtworkHeading?: "About Today's Artwork";
  banditMorningNote?: string;
};

export type { HeroArtworkCollectionId };
