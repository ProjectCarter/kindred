/**
 * Centralized sharing utility for Kindred.
 *
 * One helper builds the branded share message, opens the native iOS/Android
 * share sheet, and records analytics for every desk. Screens pass structured
 * content (never a hardcoded message string) so the D.R.O.P. voice stays
 * consistent as more desks add sharing.
 *
 * Supported today: Masterpiece. The type union and URL map are ready for
 * Events, Activities, Food & Drinks, Deals, Story of Your City, Today in
 * History, and History Around Town as those screens adopt the helper.
 */
import { Share } from "react-native";
import * as Linking from "expo-linking";
import { trackArticleShared } from "../analytics";

export type ShareableContentType =
  | "masterpiece"
  | "event"
  | "activity"
  | "food_drink"
  | "deal"
  | "story_of_your_city"
  | "today_in_history"
  | "history_around_town";

export type ShareContentInput = {
  contentType: ShareableContentType;
  /** Primary display title, e.g. an artwork name. */
  title: string;
  /** Author/creator rendered as "by {creator}" — e.g. the artist. */
  creator?: string | null;
  /** Optional secondary descriptor (venue, city) for future desks. */
  subtitle?: string | null;
  /** Year or date qualifier shown in parentheses after the creator. */
  year?: string | null;
  /** Stable content id — used to build the share link and for analytics. */
  contentId?: string | null;
  /** Fully-resolved shareable link. When omitted, built from contentType + contentId. */
  shareUrl?: string | null;
};

export type ShareContentResult =
  | { status: "shared" }
  | { status: "dismissed" }
  | { status: "error"; error: unknown };

const BRAND = "D.R.O.P.";
const TAGLINE = "Discover More. Spend Less.";

/**
 * expo-router path segment for each desk's detail screen. Only routes that
 * exist today are mapped; the rest are added as those screens adopt sharing.
 */
const SHARE_ROUTE_BY_TYPE: Partial<Record<ShareableContentType, string>> = {
  masterpiece: "masterpiece",
  event: "event",
  deal: "deal",
};

/**
 * Best-effort deep link to a desk's detail screen using the app's existing
 * expo-router + "kindred" scheme system. Opens the exact page when the app is
 * installed. Returns null when the desk has no mapped route or no id.
 */
export function buildShareUrl(
  contentType: ShareableContentType,
  contentId: string | null | undefined
): string | null {
  const base = SHARE_ROUTE_BY_TYPE[contentType];
  const id = contentId?.trim();
  if (!base || !id) return null;
  return Linking.createURL(`${base}/${encodeURIComponent(id)}`);
}

/** Build the branded, multi-line share message for any desk. */
export function buildShareMessage(input: ShareContentInput): string {
  const title = input.title.trim();
  const creator = input.creator?.trim();
  const year = input.year?.trim();

  let headline = `Check out \u201C${title}\u201D`;
  if (creator) headline += ` by ${creator}`;
  if (year) headline += ` (${year})`;
  headline += ` on ${BRAND}`;

  const lines = [headline, TAGLINE];

  const url =
    input.shareUrl?.trim() ||
    buildShareUrl(input.contentType, input.contentId) ||
    "";
  if (url) lines.push(url);

  return lines.join("\n");
}

/**
 * Open the native share sheet for a piece of content and record analytics.
 * Never throws — sharing failures resolve to an "error" result so callers can
 * keep the screen responsive.
 */
export async function shareContent(
  input: ShareContentInput
): Promise<ShareContentResult> {
  const title = input.title.trim();
  const message = buildShareMessage(input);

  try {
    const result = await Share.share(
      { message, title },
      { subject: title }
    );

    // Sheet was presented — record the share (recipient/app intentionally omitted).
    trackArticleShared({
      contentId: input.contentId ?? title,
      contentTitle: title,
      sectionType: input.contentType,
    });

    if (result.action === Share.dismissedAction) {
      return { status: "dismissed" };
    }
    return { status: "shared" };
  } catch (error) {
    return { status: "error", error };
  }
}
