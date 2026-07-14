/**
 * Editorial discovery image sources. Hero images use a completely separate desk
 * (`lib/edition/hero/*`) and must never share this library or selection path.
 */
export type ImageLibrarySource =
  | "unsplash"
  | "pexels"
  | "pixabay"
  | "provider"
  | "kindred"
  | "wikimedia"
  | "rijksmuseum"
  | "met"
  | "smithsonian"
  | "loc"
  | "national_gallery"
  | "art_institute_chicago";

export type ImageOrientation = "portrait" | "landscape" | "square";

export type EditorialImageSelectionReport = {
  provider: string;
  searchTermsAttempted: string[];
  selectedQuery: string;
  searchTier: "venue" | "category" | "broader";
  relevanceScore: number;
  winReason: string;
  breakdown: {
    exactNameMatch: number;
    categoryMatch: number;
    tagMatch: number;
    titleMatch: number;
    descriptionMatch: number;
    visualConfidence: number;
    resolution: number;
    editorialQuality: number;
    tierBonus: number;
  };
};

export type EditorialImageRecord = {
  url: string;
  libraryId: string;
  source: ImageLibrarySource;
  orientation?: ImageOrientation;
  photographerName?: string | null;
  sourcePageUrl?: string | null;
  attributionText?: string | null;
  /** Server-side selection audit trail — not shown in UI. */
  selectionReport?: EditorialImageSelectionReport;
};

export type ImageQualitySignals = {
  resolution?: number;
  sharpness?: number;
  composition?: number;
  lighting?: number;
  editorialAppeal?: number;
  orientationFit?: number;
  cropSuitability?: number;
};

export type ImageLibraryRow = {
  id: string;
  internal_id: string;
  hosted_url: string;
  storage_path: string;
  thumbnail_url: string | null;
  original_source: ImageLibrarySource;
  original_source_image_id: string;
  photographer_name: string | null;
  source_page_url: string | null;
  attribution_text: string | null;
  primary_category: string;
  secondary_tags: string[];
  environment_tags: string[];
  orientation: ImageOrientation | null;
  dominant_subject: string | null;
  composition_tag: string | null;
  dominant_color: string | null;
  content_hash: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  quality_score: number;
  quality_signals: ImageQualitySignals;
  approval_status: "pending" | "approved" | "rejected";
  last_used_at: string | null;
  recent_use_count: number;
  skip_count: number;
  created_at: string;
};

export type StockSearchCandidate = {
  provider: "unsplash" | "pexels" | "pixabay" | ImageLibrarySource;
  providerImageId: string;
  downloadUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  photographerName: string | null;
  sourcePageUrl: string;
  tags: string[];
  orientation: ImageOrientation;
  altDescription?: string | null;
  /** Wikimedia Commons license metadata — preserved for attribution. */
  licenseShortName?: string | null;
  licenseUrl?: string | null;
  /** Full attribution line when provider supplies one (Wikimedia). */
  attributionText?: string | null;
};

export const IMAGE_BUCKET = "kindred-images";
export const MAX_IMAGE_BYTES = 2_500_000;
export const MIN_IMAGE_DIMENSION = 480;
export const MAX_IMAGE_DIMENSION = 2400;
export const SEARCH_CACHE_TTL_HOURS = 24;
export const MAX_IMAGES_PER_CATEGORY_SEED = 5;
