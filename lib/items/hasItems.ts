import type { SupabaseClient } from "@supabase/supabase-js";

export async function userHasItems(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("items")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  return (data?.length ?? 0) > 0;
}
