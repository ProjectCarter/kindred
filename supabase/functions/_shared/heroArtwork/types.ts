/**
 * Hero Artwork desk — public-domain artwork for the morning masthead.
 *
 * This module is intentionally separate from `_shared/images/*` (editorial
 * photography for Events, Activities, Recommendations). Never import across desks.
 */

import type { HeroArtworkCollectionId } from "./collections.ts";

export type HeroArtworkOrientation = "portrait" | "landscape" | "square";

export type MasterpieceEditorialSections = {
  introduction: string;
  aboutTheArtist: string;
  storyBehindArtwork: string;
  historicalContext: string;
  legacy: string;
  editorialClosing: string;
};

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

export type HeroArtworkRecord = {
  id: string;
  internalId: string;
  artworkTitle: string;
  artist: string;
  year: string | null;
  sourceInstitution: string;
  sourceUrl: string;
  imageUrl: string | null;
  hostedUrl: string | null;
  storagePath: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  aspectRatio: number | null;
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
  attributionText: string | null;
  attributionRequired: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  sourceProvider: HeroArtworkSourceProvider;
  sourceProviderArtworkId: string;
  aboutArtworkBody: string | null;
  aboutWordCount: number | null;
  longStoryBody: string | null;
  longStoryParagraphCount: number | null;
  editorialSections: MasterpieceEditorialSections | null;
  artistBiography: string | null;
  lookCloserItems: string[];
  didYouKnow: string | null;
  museumName: string | null;
  museumLocation: string | null;
  officialMuseumUrl: string | null;
  officialArtworkUrl: string | null;
  sourceReferences: string[];
  detailEditorialStatus: HeroArtworkCuratorEditorialStatus;
  curatorEditorialStatus: HeroArtworkCuratorEditorialStatus;
  banditMorningNote: string | null;
  featured: boolean;
  editorialPriority: number;
  lastUsedAt: string | null;
  useCount: number;
  approvalStatus: HeroArtworkApprovalStatus;
};

export type HeroArtworkRow = {
  id: string;
  internal_id: string;
  artwork_title: string;
  artist: string;
  year: string | null;
  source_institution: string;
  source_url: string;
  image_url: string | null;
  hosted_url: string | null;
  storage_path: string | null;
  image_width: number | null;
  image_height: number | null;
  aspect_ratio: number | null;
  orientation: HeroArtworkOrientation | null;
  dominant_colors: string[];
  collections: string[];
  mood_tags: string[];
  tags: string[];
  seasons: string[];
  holidays: string[];
  license: string;
  license_url: string | null;
  public_domain_status: HeroArtworkPublicDomainStatus;
  verification_source: string | null;
  commercial_use_confirmed: boolean;
  attribution_text: string | null;
  attribution_required: boolean;
  verified_at: string | null;
  verified_by: string | null;
  verification_notes: string | null;
  source_provider: HeroArtworkSourceProvider;
  source_provider_artwork_id: string;
  about_artwork_body: string | null;
  about_word_count: number | null;
  long_story_body: string | null;
  long_story_paragraph_count: number | null;
  editorial_sections: unknown;
  artist_biography: string | null;
  look_closer_items: string[];
  did_you_know: string | null;
  museum_name: string | null;
  museum_location: string | null;
  official_museum_url: string | null;
  official_artwork_url: string | null;
  source_references: unknown;
  detail_editorial_status: HeroArtworkCuratorEditorialStatus;
  curator_editorial_status: HeroArtworkCuratorEditorialStatus;
  bandit_morning_note: string | null;
  featured: boolean;
  editorial_priority: number;
  last_used_at: string | null;
  use_count: number;
  approval_status: HeroArtworkApprovalStatus;
  created_at: string;
};

export type HeroArtworkSelectionContext = {
  date?: Date | string | null;
  season?: HeroArtworkSeason | null;
  holiday?: HeroArtworkHoliday | null;
  recentArtworkIds?: string[];
  recentCollectionIds?: HeroArtworkCollectionId[];
  weatherHint?: "hot" | "cold" | "rain" | "clear" | null;
};

export type ScoredHeroArtwork = {
  artwork: HeroArtworkRecord;
  score: number;
  reasons: string[];
};

export type HeroArtworkEditionSelection = {
  editionDate: string;
  artworkId: string;
  selectedAt: string;
  selectionContext: HeroArtworkSelectionContext;
  banditMorningNote: string | null;
  presentationSnapshot: Record<string, unknown> | null;
};

export const HERO_ARTWORK_BUCKET = "kindred-hero-artwork";

export type { HeroArtworkCollectionId } from "./collections.ts";
