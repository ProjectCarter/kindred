import { supabase } from "../supabase";
import type { KindredArticle } from "./article";
import type { SaveTarget } from "./saveTarget";

/**
 * A private "show me more like this" signal — no counts, no profiles, no
 * feed: the only reader of a like is this same person's own future editions,
 * via the reading-signal personalization pipeline (see `trackReadingSignal`
 * calls at the call site, aggregated server-side in
 * supabase/functions/_shared/personalization/aggregate.ts).
 */

export async function checkLiked(
  userId: string,
  likeKey: string
): Promise<boolean> {
  const { data } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", userId)
    .eq("like_key", likeKey)
    .maybeSingle();
  return Boolean(data);
}

export type SaveLikeResult = {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
};

export async function saveLike(
  userId: string,
  target: SaveTarget,
  article: KindredArticle
): Promise<SaveLikeResult> {
  const { error } = await supabase.from("likes").insert({
    user_id: userId,
    content_type: target.contentType,
    like_key: target.clipKey,
    // The resolved Content-System desk (e.g. "hiking", "museum", "coffee")
    // — the one field the recommendation engine cares about.
    category: article.contentType ?? null,
    headline: article.headline.slice(0, 240),
  });

  if (!error) return { ok: true };

  const duplicate =
    error.code === "23505" || /duplicate|unique/i.test(error.message ?? "");
  if (duplicate) return { ok: true, duplicate: true };
  return { ok: false, error: error.message };
}

export async function removeLike(
  userId: string,
  likeKey: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("user_id", userId)
    .eq("like_key", likeKey);
  return error ? { ok: false, error: error.message } : { ok: true };
}
