export const ANALYTICS_EVENT_NAMES = [
  "app_open",
  "edition_load_started",
  "edition_load_succeeded",
  "edition_load_failed",
  "section_viewed",
  "article_opened",
  "see_all_tapped",
  "external_link_opened",
  "maps_opened",
  "ticket_link_opened",
  "offer_redeemed",
  "article_shared",
  "cache_cleared",
  "location_changed",
  "generation_error",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export type AnalyticsEventProperties = {
  edition_date?: string | null;
  city?: string | null;
  state?: string | null;
  section_type?: string | null;
  content_id?: string | null;
  content_title?: string | null;
  destination_domain?: string | null;
  load_duration_ms?: number | null;
  error_code?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AnalyticsContext = {
  edition_date?: string | null;
  city?: string | null;
  state?: string | null;
};
