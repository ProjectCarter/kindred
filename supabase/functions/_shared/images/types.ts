/**
 * Editorial discovery image sources. Hero images use a completely separate desk
 * (`lib/edition/hero/*`) and must never share this library or selection path.
 */
export type ImageLibrarySource =
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

export type EditorialImageRecord = {
  url: string;
  libraryId: string;
  source: ImageLibrarySource;
  orientation?: ImageOrientation;
  photographerName?: string | null;
  sourcePageUrl?: string | null;
  attributionText?: string | null;
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
  provider: "pexels" | "pixabay" | ImageLibrarySource;
  providerImageId: string;
  downloadUrl: string;
  previewUrl: string;
  width: number;
  height: number;
  photographerName: string | null;
  sourcePageUrl: string;
  tags: string[];
  orientation: ImageOrientation;
};

export const IMAGE_BUCKET = "kindred-images";
export const MAX_IMAGE_BYTES = 2_500_000;
export const MIN_IMAGE_DIMENSION = 480;
export const MAX_IMAGE_DIMENSION = 2400;
export const SEARCH_CACHE_TTL_HOURS = 24;
export const MAX_IMAGES_PER_CATEGORY_SEED = 5;
