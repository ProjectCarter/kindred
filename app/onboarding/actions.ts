"use server";

import { requireUser } from "@/lib/auth/requireUser";
import { enqueueInsightJob } from "@/lib/insights/enqueueInsightJob";
import { PHOTO_UPLOAD_WARNING } from "@/lib/insights/constants";
import { validatePhoto } from "@/lib/uploads/validatePhoto";
import { redirect } from "next/navigation";

type SaveFirstItemError = { error: string };

export type SaveFirstItemResult = SaveFirstItemError | void;

export async function saveFirstItem(
  formData: FormData
): Promise<SaveFirstItemResult> {
  const { supabase, user } = await requireUser();

  const description = String(formData.get("description") ?? "").trim();

  if (!description) {
    return { error: "Tell me at least a little about it." };
  }

  const photo = formData.get("photo") as File | null;
  let photoPath: string | null = null;
  let photoWarning: string | undefined;

  if (photo && photo.size > 0) {
    const validation = await validatePhoto(photo);

    if (!validation.ok) {
      return { error: validation.error };
    }

    const fileExt = photo.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("item-photos")
      .upload(path, photo);

    if (!uploadError) {
      photoPath = path;
    } else {
      photoWarning = PHOTO_UPLOAD_WARNING;
    }
  }

  const { data: item, error: insertError } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      description,
      photo_path: photoPath,
    })
    .select("id")
    .single();

  if (insertError || !item) {
    return { error: "Something went wrong saving that — try again." };
  }

  await enqueueInsightJob(supabase, {
    userId: user.id,
    itemId: item.id,
  });

  if (photoWarning) {
    redirect(`/home?photoWarning=1`);
  }

  redirect("/home");
}
