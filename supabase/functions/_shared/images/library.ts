import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type {
  EditorialImageRecord,
  ImageLibraryRow,
  ImageLibrarySource,
  ImageOrientation,
  StockSearchCandidate,
} from "./types.ts";
import {
  IMAGE_BUCKET,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MIN_IMAGE_DIMENSION,
} from "./types.ts";
import type { ImageCategoryTag } from "./taxonomy.ts";
import {
  computeBaselineQualityScore,
  effectiveSelectionScore,
  isLibraryRowSelectable,
} from "./quality.ts";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function internalIdFrom(source: ImageLibrarySource, providerImageId: string): string {
  return `kindred:img:${source}:${providerImageId}`;
}

function attributionFor(
  source: ImageLibrarySource,
  photographerName: string | null,
  sourcePageUrl: string | null
): string {
  if (source === "pexels" && photographerName) {
    return `Photo by ${photographerName} on Pexels`;
  }
  if (source === "unsplash" && photographerName) {
    return `Photo by ${photographerName} on Unsplash`;
  }
  if (source === "pixabay" && photographerName) {
    return `Image by ${photographerName} on Pixabay`;
  }
  if (source === "wikimedia" && photographerName) {
    return `Image from Wikimedia Commons — ${photographerName}`;
  }
  if (
    photographerName &&
    ["rijksmuseum", "met", "smithsonian", "loc", "national_gallery", "art_institute_chicago"].includes(
      source
    )
  ) {
    return `Image courtesy ${source.replace(/_/g, " ")} — ${photographerName}`;
  }
  return "Kindred editorial photography";
}

export async function findLibraryImageByProvider(
  admin: SupabaseClient,
  source: ImageLibrarySource,
  providerImageId: string
): Promise<ImageLibraryRow | null> {
  const { data } = await admin
    .from("kindred_image_library")
    .select("*")
    .eq("original_source", source)
    .eq("original_source_image_id", providerImageId)
    .eq("approval_status", "approved")
    .maybeSingle();
  return (data as ImageLibraryRow | null) ?? null;
}

/** Reuse a photo previously matched to this exact venue. */
export async function findLibraryImageForVenue(
  admin: SupabaseClient,
  venueTag: string,
  excludeIds: Set<string>
): Promise<ImageLibraryRow | null> {
  const { data } = await admin
    .from("kindred_image_library")
    .select("*")
    .contains("secondary_tags", [venueTag])
    .eq("approval_status", "approved")
    .order("quality_score", { ascending: false })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .limit(8);

  const rows = (data as ImageLibraryRow[] | null) ?? [];
  return rows.find((row) => !excludeIds.has(row.id)) ?? null;
}

export async function findUnusedLibraryMatch(
  admin: SupabaseClient,
  category: ImageCategoryTag,
  excludeIds: Set<string>,
  options?: {
    compositionTag?: string | null;
    avoidCompositions?: Set<string>;
    avoidSubjects?: Set<string>;
    avoidColors?: Set<string>;
  }
): Promise<ImageLibraryRow | null> {
  const { data } = await admin
    .from("kindred_image_library")
    .select("*")
    .eq("primary_category", category)
    .eq("approval_status", "approved")
    .order("quality_score", { ascending: false })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("recent_use_count", { ascending: true })
    .limit(24);

  const rows = (data as ImageLibraryRow[] | null) ?? [];
  const ranked = rows
    .filter((row) => !excludeIds.has(row.id))
    .filter((row) =>
      isLibraryRowSelectable(row.quality_score ?? 50, row.skip_count ?? 0)
    )
    .map((row) => ({
      row,
      effective: effectiveSelectionScore(
        row.quality_score ?? 50,
        row.skip_count ?? 0,
        row.recent_use_count ?? 0
      ),
    }))
    .sort((a, b) => b.effective - a.effective);

  for (const { row } of ranked) {
    if (options?.avoidCompositions?.has(row.composition_tag ?? "")) continue;
    if (options?.avoidSubjects?.has(row.dominant_subject ?? "")) continue;
    if (options?.avoidColors?.has(row.dominant_color ?? "")) continue;
    if (
      options?.compositionTag &&
      row.composition_tag &&
      row.composition_tag !== options.compositionTag
    ) {
      continue;
    }
    return row;
  }

  return ranked[0]?.row ?? null;
}

export async function incrementLibrarySkipCount(
  admin: SupabaseClient,
  libraryId: string
): Promise<void> {
  const { data } = await admin
    .from("kindred_image_library")
    .select("skip_count")
    .eq("id", libraryId)
    .maybeSingle();
  const count = (data?.skip_count as number | undefined) ?? 0;
  await admin
    .from("kindred_image_library")
    .update({ skip_count: count + 1 })
    .eq("id", libraryId);
}

export async function ingestStockImage(
  admin: SupabaseClient,
  candidate: StockSearchCandidate,
  category: ImageCategoryTag,
  secondaryTags: string[] = [],
  environmentTags: string[] = [],
  options?: {
    compositionTag?: string | null;
    inferComposition?: (
      category: ImageCategoryTag,
      tags: string[]
    ) => string | null;
    inferDominantColor?: (tags: string[]) => string | null;
    /** Store venue key for future reuse — e.g. venue:cosmo-dog-park:gilbert */
    venueTag?: string | null;
  }
): Promise<EditorialImageRecord | null> {
  const existing = await findLibraryImageByProvider(
    admin,
    candidate.provider,
    candidate.providerImageId
  );
  if (existing) {
    return rowToRecord(existing);
  }

  let res: Response;
  try {
    res = await fetch(candidate.downloadUrl);
  } catch (err) {
    console.warn("[images:ingest] download failed", err);
    return null;
  }

  if (!res.ok) return null;
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!ALLOWED_MIME.has(mime)) {
    console.warn("[images:ingest] rejected mime", mime);
    return null;
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;

  const contentHash = await sha256(bytes);
  const { data: hashDup } = await admin
    .from("kindred_image_library")
    .select("*")
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (hashDup) return rowToRecord(hashDup as ImageLibraryRow);

  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const internalId = internalIdFrom(candidate.provider, candidate.providerImageId);
  const storagePath = `${category}/${candidate.provider}-${candidate.providerImageId}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mime,
      upsert: true,
    });
  if (uploadError) {
    console.warn("[images:ingest] storage upload failed", uploadError.message);
    return null;
  }

  const { data: publicData } = admin.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(storagePath);
  const hostedUrl = publicData.publicUrl;

  const width = Math.min(candidate.width, MAX_IMAGE_DIMENSION);
  const height = Math.min(candidate.height, MAX_IMAGE_DIMENSION);
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) return null;

  const compositionTag =
    options?.compositionTag ??
    options?.inferComposition?.(category, candidate.tags) ??
    null;
  const dominantColor = options?.inferDominantColor?.(candidate.tags) ?? null;

  const { score: qualityScore, signals: qualitySignals } = computeBaselineQualityScore({
    width,
    height,
    orientation: candidate.orientation,
    compositionTag,
    tags: candidate.tags,
  });

  const row = {
    internal_id: internalId,
    hosted_url: hostedUrl,
    storage_path: storagePath,
    thumbnail_url: candidate.previewUrl,
    original_source: candidate.provider,
    original_source_image_id: candidate.providerImageId,
    photographer_name: candidate.photographerName,
    source_page_url: candidate.sourcePageUrl,
    attribution_text: attributionFor(
      candidate.provider,
      candidate.photographerName,
      candidate.sourcePageUrl
    ),
    primary_category: category,
    secondary_tags: [
      ...secondaryTags,
      ...(options?.venueTag ? [options.venueTag] : []),
    ],
    environment_tags: environmentTags,
    orientation: candidate.orientation,
    dominant_subject: compositionTag ?? category,
    composition_tag: compositionTag,
    dominant_color: dominantColor,
    content_hash: contentHash,
    width,
    height,
    byte_size: bytes.length,
    quality_score: qualityScore,
    quality_signals: qualitySignals,
    approval_status: "approved",
  };

  const { data: inserted, error } = await admin
    .from("kindred_image_library")
    .insert(row)
    .select("*")
    .single();

  if (error || !inserted) {
    console.warn("[images:ingest] db insert failed", error?.message);
    return null;
  }

  return rowToRecord(inserted as ImageLibraryRow);
}

export async function markLibraryImageUsed(
  admin: SupabaseClient,
  libraryId: string
): Promise<void> {
  const { data } = await admin
    .from("kindred_image_library")
    .select("recent_use_count")
    .eq("id", libraryId)
    .maybeSingle();
  const count = (data?.recent_use_count as number | undefined) ?? 0;
  await admin
    .from("kindred_image_library")
    .update({
      last_used_at: new Date().toISOString(),
      recent_use_count: count + 1,
    })
    .eq("id", libraryId);
}

function rowToRecord(row: ImageLibraryRow): EditorialImageRecord {
  return {
    url: row.hosted_url,
    libraryId: row.id,
    source: row.original_source,
    orientation: row.orientation ?? undefined,
    photographerName: row.photographer_name,
    sourcePageUrl: row.source_page_url,
    attributionText: row.attribution_text,
  };
}

export { rowToRecord };
