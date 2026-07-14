/**
 * Hero Artwork desk — public-domain artwork for the morning masthead.
 *
 * This module is intentionally separate from `_shared/images/*` (editorial
 * photography for Events, Activities, Recommendations). Never import across desks.
 */

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

/**
 * Museum and archive providers — register new adapters in providers.ts without
 * redesigning selection or storage.
 */
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
  orientation: HeroArtworkOrientation | null;
  dominantColors: string[];
  tags: string[];
  seasons: HeroArtworkSeason[];
  holidays: HeroArtworkHoliday[];
  license: HeroArtworkLicense | string;
  publicDomainStatus: HeroArtworkPublicDomainStatus;
  attributionText: string | null;
  attributionRequired: boolean;
  verifiedAt: string | null;
  verifiedBy: string | null;
  sourceProvider: HeroArtworkSourceProvider;
  sourceProviderArtworkId: string;
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
  orientation: HeroArtworkOrientation | null;
  dominant_colors: string[];
  tags: string[];
  seasons: string[];
  holidays: string[];
  license: string;
  public_domain_status: HeroArtworkPublicDomainStatus;
  attribution_text: string | null;
  attribution_required: boolean;
  verified_at: string | null;
  verified_by: string | null;
  verification_notes: string | null;
  source_provider: HeroArtworkSourceProvider;
  source_provider_artwork_id: string;
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
};

export const HERO_ARTWORK_BUCKET = "kindred-hero-artwork";

/** Planned initial library size — architecture supports scaling to thousands. */
export const INITIAL_HERO_ARTWORK_TARGET_COUNT = 50;
