import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInsight } from "@/lib/ai/generateInsight";

type EnsureInsightParams = {
  userId: string;
  itemId: string;
  description: string;
  hasPhoto: boolean;
};

export type EnsureInsightResult = {
  body: string | null;
};

export async function ensureInsightForItem(
  supabase: SupabaseClient,
  params: EnsureInsightParams
): Promise<EnsureInsightResult> {
  const { userId, itemId, description, hasPhoto } = params;

  const { data: existing } = await supabase
    .from("insights")
    .select("body")
    .eq("item_id", itemId)
    .maybeSingle();

  if (existing?.body) {
    return { body: existing.body };
  }

  const generated = await generateInsight({ description, hasPhoto });

  if (!generated.ok) {
    return { body: null };
  }

  const { error: insertError } = await supabase.from("insights").insert({
    user_id: userId,
    item_id: itemId,
    body: generated.body,
  });

  if (insertError) {
    const { data: raced } = await supabase
      .from("insights")
      .select("body")
      .eq("item_id", itemId)
      .maybeSingle();

    if (raced?.body) {
      return { body: raced.body };
    }

    console.error("Failed to save insight:", insertError.message);
    return { body: null };
  }

  return { body: generated.body };
}
