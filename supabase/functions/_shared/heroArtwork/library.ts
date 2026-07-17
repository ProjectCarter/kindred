import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type {
  HeroArtworkEditionSelection,
  HeroArtworkRecord,
  HeroArtworkRow,
  HeroArtworkSelectionContext,
  MasterpieceEditorialSections,
} from "./types.ts";
import type { HeroArtworkCollectionId } from "./collections.ts";
import { isHeroArtworkLicenseSafe } from "./licensing.ts";
import {
  copyMorningHeroFromRecord,
  isCompleteLibraryRecord,
  type MorningHeroExperience,
  type MasterpieceDetail,
} from "./presentation.ts";
import { sanitizeHeroArtworkRecord } from "./sanitizeRecord.ts";
import { computeHeroArtworkValidationStatus } from "./libraryValidation.ts";

function parseEditorialSections(value: unknown): MasterpieceEditorialSections | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<MasterpieceEditorialSections>;
  if (!raw.introduction?.trim()) return null;
  return {
    introduction: raw.introduction.trim(),
    aboutTheArtist: raw.aboutTheArtist?.trim() ?? "",
    storyBehindArtwork: raw.storyBehindArtwork?.trim() ?? "",
    historicalContext: raw.historicalContext?.trim() ?? "",
    legacy: raw.legacy?.trim() ?? "",
    editorialClosing: raw.editorialClosing?.trim() ?? "",
    editorialReflection:
      (raw as { editorialReflection?: string }).editorialReflection?.trim() ??
      raw.editorialClosing?.trim() ??
      "",
  };
}

export function rowToRecord(row: HeroArtworkRow): HeroArtworkRecord {
  return sanitizeHeroArtworkRecord({
    id: row.id,
    internalId: row.internal_id,
    artworkTitle: row.artwork_title,
    artist: row.artist,
    year: row.year,
    sourceInstitution: row.source_institution,
    sourceUrl: row.source_url,
    imageUrl: row.image_url,
    hostedUrl: row.hosted_url,
    storagePath: row.storage_path,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    aspectRatio: row.aspect_ratio != null ? Number(row.aspect_ratio) : null,
    orientation: row.orientation,
    dominantColors: row.dominant_colors ?? [],
    collections: (row.collections ?? []) as HeroArtworkCollectionId[],
    moodTags: row.mood_tags ?? [],
    tags: row.tags ?? [],
    seasons: (row.seasons ?? []) as HeroArtworkRecord["seasons"],
    holidays: (row.holidays ?? []) as HeroArtworkRecord["holidays"],
    license: row.license,
    licenseUrl: row.license_url,
    publicDomainStatus: row.public_domain_status,
    verificationSource: row.verification_source,
    commercialUseConfirmed: row.commercial_use_confirmed ?? false,
    attributionText: row.attribution_text,
    attributionRequired: row.attribution_required,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    sourceProvider: row.source_provider,
    sourceProviderArtworkId: row.source_provider_artwork_id,
    aboutArtworkBody: row.about_artwork_body,
    aboutWordCount: row.about_word_count,
    longStoryBody: row.long_story_body,
    longStoryParagraphCount: row.long_story_paragraph_count,
    editorialSections: parseEditorialSections(row.editorial_sections),
    artistBiography: row.artist_biography,
    lookCloserItems: row.look_closer_items ?? [],
    didYouKnow: row.did_you_know,
    museumName: row.museum_name,
    museumLocation: row.museum_location,
    officialMuseumUrl: row.official_museum_url,
    officialArtworkUrl: row.official_artwork_url,
    sourceReferences: Array.isArray(row.source_references)
      ? (row.source_references as string[])
      : [],
    detailEditorialStatus: row.detail_editorial_status ?? "pending",
    curatorEditorialStatus: row.curator_editorial_status ?? "pending",
    banditMorningNote: null,
    featured: row.featured,
    editorialPriority: row.editorial_priority,
    lastUsedAt: row.last_used_at,
    lastShownDate: row.last_shown_date ?? null,
    useCount: row.use_count,
    approvalStatus: row.approval_status,
    validationStatus: row.validation_status ?? "needs_review",
  });
}

export function isHostedHeroArtwork(row: HeroArtworkRow | HeroArtworkRecord): boolean {
  const hosted =
    "hosted_url" in row ? row.hosted_url : (row as HeroArtworkRecord).hostedUrl;
  const path =
    "storage_path" in row ? row.storage_path : (row as HeroArtworkRecord).storagePath;
  return Boolean(hosted?.trim() && path?.trim());
}

export function isSelectableHeroArtwork(row: HeroArtworkRow): boolean {
  if (!isHostedHeroArtwork(row)) return false;
  // Dimensions are optional — pre-0024 rows and backfill gaps default at presentation.
  if (!row.attribution_text?.trim()) return false;
  return isHeroArtworkLicenseSafe({
    license: row.license,
    publicDomainStatus: row.public_domain_status,
    approvalStatus: row.approval_status,
    verifiedAt: row.verified_at,
    sourceInstitution: row.source_institution,
    attributionRequired: row.attribution_required,
    licenseUrl: row.license_url,
    verificationSource: row.verification_source,
    commercialUseConfirmed: row.commercial_use_confirmed,
    curatorEditorialStatus: row.curator_editorial_status,
  });
}

export async function listApprovedHeroArtwork(
  admin: SupabaseClient
): Promise<HeroArtworkRecord[]> {
  const { data } = await admin
    .from("kindred_hero_artwork")
    .select("*")
    .eq("approval_status", "approved")
    .eq("validation_status", "approved")
    .eq("public_domain_status", "verified")
    .eq("curator_editorial_status", "approved")
    .eq("detail_editorial_status", "approved")
    .eq("commercial_use_confirmed", true)
    .not("hosted_url", "is", null)
    .not("storage_path", "is", null)
    .order("editorial_priority", { ascending: false })
    .order("last_shown_date", { ascending: true, nullsFirst: true });

  const rows = (data as HeroArtworkRow[] | null) ?? [];
  return rows.filter(isSelectableHeroArtwork).map(rowToRecord);
}

/** Permanent library — hosted, verified, editorial-ready artworks for edition selection. */
export async function listReadyHeroArtworkLibrary(
  admin: SupabaseClient
): Promise<HeroArtworkRecord[]> {
  const catalog = await listApprovedHeroArtwork(admin);
  return catalog.filter(isCompleteLibraryRecord);
}

export async function getHeroArtworkById(
  admin: SupabaseClient,
  artworkId: string
): Promise<HeroArtworkRecord | null> {
  const { data } = await admin
    .from("kindred_hero_artwork")
    .select("*")
    .eq("id", artworkId)
    .maybeSingle();
  if (!data) return null;
  const row = data as HeroArtworkRow;
  return isSelectableHeroArtwork(row) ? rowToRecord(row) : null;
}

export async function markHeroArtworkUsed(
  admin: SupabaseClient,
  artworkId: string,
  editionDate: string
): Promise<void> {
  const { data } = await admin
    .from("kindred_hero_artwork")
    .select("use_count")
    .eq("id", artworkId)
    .maybeSingle();
  const count = (data?.use_count as number | undefined) ?? 0;
  await admin
    .from("kindred_hero_artwork")
    .update({
      last_used_at: new Date().toISOString(),
      last_shown_date: editionDate,
      use_count: count + 1,
    })
    .eq("id", artworkId);
}

export async function getFrozenHeroArtworkSelection(
  admin: SupabaseClient,
  editionDate: string
): Promise<HeroArtworkEditionSelection | null> {
  const { data } = await admin
    .from("kindred_hero_artwork_edition_selections")
    .select("*")
    .eq("edition_date", editionDate)
    .maybeSingle();
  if (!data) return null;
  return {
    editionDate: data.edition_date as string,
    artworkId: data.artwork_id as string,
    selectedAt: data.selected_at as string,
    selectionContext: (data.selection_context ??
      {}) as HeroArtworkSelectionContext,
    banditMorningNote: (data.bandit_morning_note as string | null) ?? null,
    presentationSnapshot:
      (data.presentation_snapshot as Record<string, unknown> | null) ?? null,
  };
}

export async function freezeHeroArtworkSelection(
  admin: SupabaseClient,
  editionDate: string,
  artworkId: string,
  options: {
    selectionContext?: HeroArtworkSelectionContext;
    presentation?: MorningHeroExperience;
  } = {}
): Promise<void> {
  await admin.from("kindred_hero_artwork_edition_selections").upsert(
    {
      edition_date: editionDate,
      artwork_id: artworkId,
      selection_context: options.selectionContext ?? {},
      bandit_morning_note: options.presentation?.banditMorningNote ?? null,
      presentation_snapshot: options.presentation ?? {},
      selected_at: new Date().toISOString(),
    },
    { onConflict: "edition_date" }
  );
}

export async function upsertVerifiedHeroArtwork(
  admin: SupabaseClient,
  draft: Omit<HeroArtworkRecord, "id" | "lastUsedAt" | "useCount"> & {
    id?: string;
  }
): Promise<HeroArtworkRecord | null> {
  if (
    !isHeroArtworkLicenseSafe({
      license: draft.license,
      publicDomainStatus: draft.publicDomainStatus,
      approvalStatus: draft.approvalStatus,
      verifiedAt: draft.verifiedAt,
      sourceInstitution: draft.sourceInstitution,
      attributionRequired: draft.attributionRequired,
      licenseUrl: draft.licenseUrl,
      verificationSource: draft.verificationSource,
      commercialUseConfirmed: draft.commercialUseConfirmed,
      curatorEditorialStatus: draft.curatorEditorialStatus,
      aboutArtworkBody: draft.aboutArtworkBody,
    })
  ) {
    console.warn(
      "[heroArtwork] rejected upsert — license or editorial not verified",
      draft.internalId
    );
    return null;
  }

  const clean = sanitizeHeroArtworkRecord({
    ...draft,
    id: draft.id ?? "",
    lastUsedAt: null,
    lastShownDate: null,
    useCount: 0,
    validationStatus: draft.validationStatus ?? "needs_review",
  });

  const validationStatus = computeHeroArtworkValidationStatus(clean);

  const row = {
    internal_id: clean.internalId,
    artwork_title: clean.artworkTitle,
    artist: clean.artist,
    year: clean.year,
    source_institution: draft.sourceInstitution,
    source_url: draft.sourceUrl,
    image_url: draft.imageUrl,
    hosted_url: draft.hostedUrl,
    storage_path: draft.storagePath,
    orientation: draft.orientation,
    dominant_colors: draft.dominantColors,
    collections: draft.collections,
    mood_tags: draft.moodTags,
    tags: clean.tags,
    seasons: draft.seasons,
    holidays: draft.holidays,
    license: draft.license,
    license_url: draft.licenseUrl,
    public_domain_status: draft.publicDomainStatus,
    verification_source: draft.verificationSource,
    commercial_use_confirmed: draft.commercialUseConfirmed,
    attribution_text: clean.attributionText,
    attribution_required: draft.attributionRequired,
    verified_at: draft.verifiedAt,
    verified_by: draft.verifiedBy,
    source_provider: draft.sourceProvider,
    source_provider_artwork_id: draft.sourceProviderArtworkId,
    about_artwork_body: clean.aboutArtworkBody,
    about_word_count: clean.aboutWordCount ?? draft.aboutWordCount,
    long_story_body: clean.longStoryBody,
    long_story_paragraph_count: draft.longStoryParagraphCount,
    editorial_sections: draft.editorialSections,
    artist_biography: clean.artistBiography,
    look_closer_items: draft.lookCloserItems ?? [],
    did_you_know: clean.didYouKnow,
    museum_name: clean.museumName,
    museum_location: clean.museumLocation,
    official_museum_url: draft.officialMuseumUrl,
    official_artwork_url: draft.officialArtworkUrl,
    source_references: draft.sourceReferences ?? [],
    detail_editorial_status: draft.detailEditorialStatus ?? "pending",
    curator_editorial_status: draft.curatorEditorialStatus,
    featured: draft.featured,
    editorial_priority: draft.editorialPriority,
    image_width: draft.imageWidth,
    image_height: draft.imageHeight,
    aspect_ratio: draft.aspectRatio,
    approval_status: draft.approvalStatus,
    validation_status: validationStatus,
  };

  const { data, error } = await admin
    .from("kindred_hero_artwork")
    .upsert(row, { onConflict: "internal_id" })
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[heroArtwork] upsert failed", error?.message);
    return null;
  }

  return rowToRecord(data as HeroArtworkRow);
}

export { copyMorningHeroFromRecord, type MorningHeroExperience, type MasterpieceDetail };
