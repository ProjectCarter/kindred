"use server";

import { requireUser } from "@/lib/auth/requireUser";
import { ensureInsightForItem } from "@/lib/insights/ensureInsightForItem";
import { PHOTO_UPLOAD_WARNING } from "@/lib/insights/constants";
import { redirect } from "next/navigation";

type SaveFirstItemError = { error: string };

type SaveFirstItemSuccess = {
  itemId: string;
  description: string;
  hasPhoto: boolean;
  photoWarning?: string;
};

export type SaveFirstItemResult = SaveFirstItemError | SaveFirstItemSuccess;

export async function saveFirstItem(
  formData: FormData
): Promise<SaveFirstItemResult> {
  const { supabase, user } = await requireUser();

  const description = String(formData.get("description") ?? "").trim();

  if (!description) {
    return { error: "Tell me at least a little about it." };
  }

  const photo = formData.get("photo") as File | null;
  const hasPhoto = !!(photo && photo.size > 0);
  let photoPath: string | null = null;
  let photoWarning: string | undefined;

  if (photo && photo.size > 0) {
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

  return {
    itemId: item.id,
    description,
    hasPhoto,
    photoWarning,
  };
}

type FinishOnboardingParams = {
  itemId: string;
  description: string;
  hasPhoto: boolean;
};

export async function finishOnboardingInsight(
  params: FinishOnboardingParams
): Promise<void> {
  const { supabase, user } = await requireUser();

  await ensureInsightForItem(supabase, {
    userId: user.id,
    itemId: params.itemId,
    description: params.description,
    hasPhoto: params.hasPhoto,
  });

  redirect("/home");
}
