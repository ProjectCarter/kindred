import { isSupabaseConfigured, supabase } from "../supabase";
import { getAnalyticsContext } from "./context";
import { shouldEmitOnce } from "./dedupe";
import {
  getAnalyticsPlatform,
  getAnalyticsSessionId,
  getAnonymousUserId,
  getAppVersion,
} from "./identity";
import { sanitizeEventProperties, sanitizeForDevLog } from "./sanitize";
import type { AnalyticsEventName, AnalyticsEventProperties } from "./types";

type TrackOptions = {
  /** When set, skip if this key was already emitted this session. */
  dedupeKey?: string | null;
};

let insertQueue: Promise<void> = Promise.resolve();

function enqueueInsert(task: () => Promise<void>): void {
  insertQueue = insertQueue
    .then(task)
    .catch(() => {
      /* never block callers */
    });
}

/**
 * Fire-and-forget product analytics. Never blocks UI or navigation.
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  properties: AnalyticsEventProperties = {},
  options: TrackOptions = {}
): void {
  if (options.dedupeKey && !shouldEmitOnce(options.dedupeKey)) {
    return;
  }

  enqueueInsert(async () => {
    try {
      if (!isSupabaseConfigured) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const context = getAnalyticsContext();
      const sanitized = sanitizeEventProperties({
        edition_date: properties.edition_date ?? context.edition_date ?? null,
        city: properties.city ?? context.city ?? null,
        state: properties.state ?? context.state ?? null,
        section_type: properties.section_type ?? null,
        content_id: properties.content_id ?? null,
        content_title: properties.content_title ?? null,
        destination_domain: properties.destination_domain ?? null,
        load_duration_ms: properties.load_duration_ms ?? null,
        error_code: properties.error_code ?? null,
        metadata: properties.metadata ?? null,
      });

      const anonymousUserId = await getAnonymousUserId();
      const row = {
        user_id: user.id,
        anonymous_user_id: anonymousUserId,
        session_id: getAnalyticsSessionId(),
        event_name: eventName,
        event_timestamp: new Date().toISOString(),
        edition_date: sanitized.edition_date,
        city: sanitized.city,
        state: sanitized.state,
        section_type: sanitized.section_type,
        content_id: sanitized.content_id,
        content_title: sanitized.content_title,
        destination_domain: sanitized.destination_domain,
        load_duration_ms: sanitized.load_duration_ms,
        app_version: getAppVersion(),
        platform: getAnalyticsPlatform(),
        error_code: sanitized.error_code,
        metadata: sanitized.metadata ?? {},
      };

      if (__DEV__) {
        console.log(
          "[analytics]",
          eventName,
          sanitizeForDevLog(row as unknown as Record<string, unknown>)
        );
      }

      const { error } = await supabase.from("analytics_events").insert(row);
      if (error && __DEV__) {
        console.log("[analytics] insert skipped", error.message);
      }
    } catch (err) {
      if (__DEV__) {
        console.log(
          "[analytics] error",
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  });
}

export function trackSectionViewedOnce(sectionType: string): void {
  const context = getAnalyticsContext();
  const editionDate = context.edition_date ?? "unknown";
  trackEvent(
    "section_viewed",
    { section_type: sectionType },
    { dedupeKey: `section_viewed:${editionDate}:${sectionType}` }
  );
}

export function trackArticleOpenedOnce(input: {
  contentId: string;
  contentTitle?: string | null;
  sectionType?: string | null;
}): void {
  const id = input.contentId.trim();
  if (!id) return;
  trackEvent(
    "article_opened",
    {
      content_id: id,
      content_title: input.contentTitle ?? null,
      section_type: input.sectionType ?? null,
    },
    { dedupeKey: `article_opened:${getAnalyticsSessionId()}:${id}` }
  );
}

export function trackSeeAllTapped(sectionType: string): void {
  trackEvent("see_all_tapped", { section_type: sectionType });
}

export function trackArticleSaved(input: {
  contentId: string;
  contentTitle?: string | null;
  sectionType?: string | null;
}): void {
  trackEvent("article_saved", {
    content_id: input.contentId,
    content_title: input.contentTitle ?? null,
    section_type: input.sectionType ?? null,
  });
}

export function trackArticleShared(input: {
  contentId: string;
  contentTitle?: string | null;
  sectionType?: string | null;
}): void {
  trackEvent("article_shared", {
    content_id: input.contentId,
    content_title: input.contentTitle ?? null,
    section_type: input.sectionType ?? null,
  });
}

export function trackCacheCleared(metadata?: Record<string, unknown>): void {
  trackEvent("cache_cleared", { metadata: metadata ?? {} });
}

export function trackLocationChanged(input: {
  city?: string | null;
  state?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  trackEvent("location_changed", {
    city: input.city ?? null,
    state: input.state ?? null,
    metadata: input.metadata ?? {},
  });
}

export function trackGenerationError(
  errorCode: string,
  metadata?: Record<string, unknown>
): void {
  trackEvent("generation_error", {
    error_code: errorCode,
    metadata: metadata ?? {},
  });
}

export function trackAppOpen(): void {
  trackEvent("app_open");
}
