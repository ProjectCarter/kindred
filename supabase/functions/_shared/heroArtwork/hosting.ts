import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { HERO_ARTWORK_BUCKET } from "./types.ts";
import {
  computeHeroDisplayDimensions,
  HERO_TARGET_WIDTH_DEFAULT,
} from "./imageSpec.ts";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type HostHeroArtworkImageInput = {
  downloadUrl: string;
  storagePath: string;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  preferWebp?: boolean;
};

export type HostHeroArtworkImageResult = {
  hostedUrl: string;
  storagePath: string;
  byteSize: number;
  contentType: string;
  imageWidth: number;
  imageHeight: number;
  aspectRatio: number;
};

/**
 * Download a mobile-optimized artwork image and store it in kindred-hero-artwork.
 * Edition builds never call this — only background ingestion does.
 */
export async function hostHeroArtworkImage(
  admin: SupabaseClient,
  input: HostHeroArtworkImageInput
): Promise<HostHeroArtworkImageResult | null> {
  let res: Response;
  try {
    res = await fetch(input.downloadUrl);
  } catch (err) {
    console.warn("[heroArtwork:host] download failed", err);
    return null;
  }

  if (!res.ok) {
    console.warn("[heroArtwork:host] download not ok", res.status);
    return null;
  }

  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_MIME.has(mime)) {
    console.warn("[heroArtwork:host] rejected mime", mime);
    return null;
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    console.warn("[heroArtwork:host] rejected size", bytes.length);
    return null;
  }

  const sourceWidth = input.sourceWidth ?? 0;
  const sourceHeight = input.sourceHeight ?? 0;
  const dims =
    sourceWidth > 0 && sourceHeight > 0
      ? computeHeroDisplayDimensions(sourceWidth, sourceHeight)
      : null;
  if (!dims) {
    console.warn("[heroArtwork:host] rejected dimensions", {
      sourceWidth,
      sourceHeight,
    });
    return null;
  }

  const ext =
    input.preferWebp && mime === "image/webp"
      ? "webp"
      : mime === "image/png"
        ? "png"
        : "jpg";
  const storagePath = input.storagePath.replace(/\.(jpe?g|png|webp)$/i, `.${ext}`);

  const { error: uploadError } = await admin.storage
    .from(HERO_ARTWORK_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mime,
      upsert: true,
    });

  if (uploadError) {
    console.warn("[heroArtwork:host] storage upload failed", uploadError.message);
    return null;
  }

  const { data: publicData } = admin.storage
    .from(HERO_ARTWORK_BUCKET)
    .getPublicUrl(storagePath);

  return {
    hostedUrl: publicData.publicUrl,
    storagePath,
    byteSize: bytes.length,
    contentType: mime,
    imageWidth: dims.imageWidth,
    imageHeight: dims.imageHeight,
    aspectRatio: dims.aspectRatio,
  };
}

export { HERO_TARGET_WIDTH_DEFAULT };
