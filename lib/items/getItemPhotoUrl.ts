import type { SupabaseClient } from "@supabase/supabase-js";

export async function getItemPhotoUrl(
  supabase: SupabaseClient,
  photoPath: string | null
): Promise<string | null> {
  if (!photoPath) {
    return null;
  }

  const { data } = await supabase.storage
    .from("item-photos")
    .createSignedUrl(photoPath, 3600);

  return data?.signedUrl ?? null;
}
