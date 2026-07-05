"use server";

import { createClient } from "@/lib/supabase/server";
import { ensureInsightForItem } from "@/lib/insights/ensureInsightForItem";
import { redirect } from "next/navigation";

type ActionResult = { error: string } | void;

export async function submitFirstItem(
  formData: FormData
): Promise<ActionResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const description = String(formData.get("description") ?? "").trim();

  if (!description) {
    return { error: "Tell me at least a little about it." };
  }

  const photo = formData.get("photo") as File | null;
  const hasPhoto = !!(photo && photo.size > 0);
  let photoPath: string | null = null;

  if (photo && photo.size > 0) {
    const fileExt = photo.name.split(".").pop() || "jpg";
    const path = `${user!.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(path, photo);

    if (!uploadError) {
      photoPath = path;
    }
    // If the photo upload fails, we still save the description below.
    // A missing photo is not worth blocking someone's first interaction with Kindred.
  }

  const { data: item, error: insertError } = await supabase
    .from("items")
    .insert({
      user_id: user!.id,
      description,
      photo_path: photoPath,
    })
    .select("id")
    .single();

  if (insertError || !item) {
    return { error: "Something went wrong saving that — try again." };
  }

  await ensureInsightForItem(supabase, {
    userId: user.id,
    itemId: item.id,
    description,
    hasPhoto,
  });

  redirect("/home");
}
