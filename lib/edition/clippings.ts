/**
 * Saved & Clippings — unified persistence for everything a reader can save:
 * Articles, Local Events, Activities, and Recommendations.
 *
 * Articles backed by a real `edition_sections` row are still linked by
 * `section_id`. Everything else (events/activities/recommendations are
 * ephemeral discovery data, regenerated daily with no durable row of their
 * own) is saved as a self-contained snapshot — like tearing a clipping out
 * of the paper rather than bookmarking a live link that may not exist
 * tomorrow. The full `KindredArticle` is stored as `payload` so the saved
 * item reopens in the native reader exactly as it looked when saved.
 */
import type { ImageSourcePropType } from "react-native";
import { supabase } from "../supabase";
import { isClippableSectionId, type KindredArticle } from "./article";
import {
  CLIPPING_TYPE_LABEL,
  type ClippingContentType,
} from "./clippingTypes";
import { isEventExpired, resolveEventEndsAt } from "./eventExpiry";

export type ClipTarget = {
  contentType: ClippingContentType;
  clipKey: string;
  sectionId: string | null;
};

/** Best-effort bucket when an adapter didn't explicitly tag `savedContentType`. */
export function inferClipContentType(
  article: KindredArticle
): ClippingContentType {
  if (article.savedContentType) return article.savedContentType;
  if (article.section === "local_events") return "event";
  if (article.section === "discovery" || article.section === "bandits_pick") {
    return "recommendation";
  }
  return "article";
}

/**
 * Resolves whether — and how — an article can be saved. Mirrors the
 * historical `clipSectionIdForArticle` rule for real news articles (the
 * Lead and Kindred-authored discovery/knowledge briefs never had a
 * "Save for later" button); every other content type is now saveable.
 */
export function resolveClipTarget(article: KindredArticle): ClipTarget | null {
  const contentType = inferClipContentType(article);

  if (contentType === "article") {
    if (
      article.section === "lead" ||
      article.section === "discovery" ||
      article.section === "knowledge"
    ) {
      return null;
    }
    if (!isClippableSectionId(article.id)) return null;
    return {
      contentType,
      clipKey: `article:${article.id}`,
      sectionId: article.id,
    };
  }

  if (!article.id) return null;
  return {
    contentType,
    clipKey: `${contentType}:${article.id}`,
    sectionId: null,
  };
}

function summaryFor(article: KindredArticle): string | null {
  const dek = article.dek?.trim();
  if (dek) return dek.slice(0, 240);
  const firstParagraph = article.body?.find((p) => p.trim().length > 0);
  return firstParagraph ? firstParagraph.trim().slice(0, 240) : null;
}

export async function checkClipped(
  userId: string,
  clipKey: string
): Promise<boolean> {
  const { data } = await supabase
    .from("clippings")
    .select("id")
    .eq("user_id", userId)
    .eq("clip_key", clipKey)
    .maybeSingle();
  return Boolean(data);
}

export type SaveClippingResult = {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
};

export async function saveClipping(
  userId: string,
  target: ClipTarget,
  article: KindredArticle
): Promise<SaveClippingResult> {
  const { error } = await supabase.from("clippings").insert({
    user_id: userId,
    section_id: target.sectionId,
    content_type: target.contentType,
    clip_key: target.clipKey,
    headline: article.headline.slice(0, 240),
    summary: summaryFor(article),
    source: article.source ?? null,
    image_url: article.heroImage?.uri ?? null,
    location: article.savedLocation ?? null,
    event_time: article.savedEventTime ?? null,
    event_ends_at:
      target.contentType === "event" ? article.savedEventEndsAt ?? null : null,
    payload: article,
  });

  if (!error) return { ok: true };

  const duplicate =
    error.code === "23505" || /duplicate|unique/i.test(error.message ?? "");
  if (duplicate) return { ok: true, duplicate: true };
  return { ok: false, error: error.message };
}

export async function removeClipping(
  userId: string,
  clipKey: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("clippings")
    .delete()
    .eq("user_id", userId)
    .eq("clip_key", clipKey);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export type ClippingListRow = {
  id: string;
  createdAt: string;
  contentType: ClippingContentType;
  clipKey: string;
  headline: string;
  summary: string | null;
  source: string | null;
  /** Prefer this for display — falls back to the snapshot's own hero photo. */
  imageUrl: string | null;
  /** Bundled local asset (e.g. category fallback art) when there's no remote photo. */
  imageSource: ImageSourcePropType | null;
  location: string | null;
  eventTime: string | null;
  /** ISO end timestamp for `contentType === "event"`; null otherwise or unresolvable. */
  eventEndsAt: string | null;
  /** Full snapshot — reopens the item exactly as saved. Null only if corrupted. */
  article: KindredArticle | null;
};

type ClippingDbRow = {
  id: string;
  created_at: string;
  content_type: ClippingContentType | null;
  clip_key: string;
  headline: string | null;
  summary: string | null;
  source: string | null;
  image_url: string | null;
  location: string | null;
  event_time: string | null;
  event_ends_at: string | null;
  payload: KindredArticle | null;
};

export async function listClippings(
  userId: string
): Promise<ClippingListRow[]> {
  const { data, error } = await supabase
    .from("clippings")
    .select(
      "id, created_at, content_type, clip_key, headline, summary, source, image_url, location, event_time, event_ends_at, payload"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as ClippingDbRow[])
    .filter((row) => Boolean(row.headline || row.payload))
    .map((row) => {
      const article = row.payload ?? null;
      return {
        id: row.id,
        createdAt: row.created_at,
        contentType: row.content_type ?? "article",
        clipKey: row.clip_key,
        headline: row.headline?.trim() || article?.headline || "Saved item",
        summary: row.summary ?? article?.dek ?? null,
        source: row.source ?? article?.source ?? null,
        imageUrl: row.image_url ?? article?.heroImage?.uri ?? null,
        imageSource: article?.heroImage?.source ?? null,
        location: row.location,
        eventTime: row.event_time,
        eventEndsAt: row.event_ends_at ?? article?.savedEventEndsAt ?? null,
        article,
      };
    });
}

/**
 * Quietly removes event clippings whose 30-day post-event grace period
 * has fully elapsed. Never touches Articles, Activities, or
 * Recommendations — scoped to `content_type = 'event'` throughout.
 *
 * Safe to call often (My Clippings load, pull-to-refresh, app focus) —
 * it's a no-op read plus, at most, a small batched delete. Legacy rows
 * saved before `event_ends_at` existed fall back to parsing the display
 * string (`event_time`) so pre-existing pins still expire correctly.
 *
 * Returns the number of clippings removed, purely for logging/testing.
 */
export async function sweepExpiredEventClippings(
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("clippings")
    .select("id, event_time, event_ends_at, payload")
    .eq("user_id", userId)
    .eq("content_type", "event");

  if (error || !data || data.length === 0) return 0;

  const now = new Date();
  const expiredIds: string[] = [];

  for (const row of data as Array<
    Pick<ClippingDbRow, "id" | "event_time" | "event_ends_at" | "payload">
  >) {
    let endsAt = row.event_ends_at ?? row.payload?.savedEventEndsAt ?? null;
    if (!endsAt && row.event_time) {
      // Pre-dates this migration — best-effort backfill from the display
      // string ("Sat, Jul 12 · 7 – 9 PM") rather than leaving it stuck.
      const [datePart, timePart] = row.event_time.split("·").map((p) => p.trim());
      endsAt = resolveEventEndsAt(datePart, timePart, now);
    }
    if (isEventExpired(endsAt, now)) expiredIds.push(row.id);
  }

  if (expiredIds.length === 0) return 0;

  const { error: deleteError } = await supabase
    .from("clippings")
    .delete()
    .eq("user_id", userId)
    .in("id", expiredIds);

  return deleteError ? 0 : expiredIds.length;
}

export function clippingTypeLabel(type: ClippingContentType): string {
  return CLIPPING_TYPE_LABEL[type];
}
