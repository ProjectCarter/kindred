import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type {
  HeroArtworkEditionSelection,
  HeroArtworkRecord,
  HeroArtworkRow,
  HeroArtworkSelectionContext,
} from "./types.ts";
import { isHeroArtworkLicenseSafe } from "./licensing.ts";

export function rowToRecord(row: HeroArtworkRow): HeroArtworkRecord {
  return {
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
    orientation: row.orientation,
    dominantColors: row.dominant_colors ?? [],
    tags: row.tags ?? [],
    seasons: (row.seasons ?? []) as HeroArtworkRecord["seasons"],
    holidays: (row.holidays ?? []) as HeroArtworkRecord["holidays"],
    license: row.license,
    publicDomainStatus: row.public_domain_status,
    attributionText: row.attribution_text,
    attributionRequired: row.attribution_required,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by,
    sourceProvider: row.source_provider,
    sourceProviderArtworkId: row.source_provider_artwork_id,
    featured: row.featured,
    editorialPriority: row.editorial_priority,
    lastUsedAt: row.last_used_at,
    useCount: row.use_count,
    approvalStatus: row.approval_status,
  };
}

export function isSelectableHeroArtwork(row: HeroArtworkRow): boolean {
  return isHeroArtworkLicenseSafe({
    license: row.license,
    publicDomainStatus: row.public_domain_status,
    approvalStatus: row.approval_status,
    verifiedAt: row.verified_at,
    sourceInstitution: row.source_institution,
    attributionRequired: row.attribution_required,
  });
}

export async function listApprovedHeroArtwork(
  admin: SupabaseClient
): Promise<HeroArtworkRecord[]> {
  const { data } = await admin
    .from("kindred_hero_artwork")
    .select("*")
    .eq("approval_status", "approved")
    .eq("public_domain_status", "verified")
    .order("editorial_priority", { ascending: false })
    .order("last_used_at", { ascending: true, nullsFirst: true });

  const rows = (data as HeroArtworkRow[] | null) ?? [];
  return rows.filter(isSelectableHeroArtwork).map(rowToRecord);
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
  artworkId: string
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
  };
}

export async function freezeHeroArtworkSelection(
  admin: SupabaseClient,
  editionDate: string,
  artworkId: string,
  selectionContext: HeroArtworkSelectionContext = {}
): Promise<void> {
  await admin.from("kindred_hero_artwork_edition_selections").upsert(
    {
      edition_date: editionDate,
      artwork_id: artworkId,
      selection_context: selectionContext,
      selected_at: new Date().toISOString(),
    },
    { onConflict: "edition_date" }
  );
}

/**
 * Insert or update a curated artwork record after manual license verification.
 * Binary ingestion is a separate future step — this stores metadata only.
 */
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
    })
  ) {
    console.warn(
      "[heroArtwork] rejected upsert — license not verified",
      draft.internalId
    );
    return null;
  }

  const row = {
    internal_id: draft.internalId,
    artwork_title: draft.artworkTitle,
    artist: draft.artist,
    year: draft.year,
    source_institution: draft.sourceInstitution,
    source_url: draft.sourceUrl,
    image_url: draft.imageUrl,
    hosted_url: draft.hostedUrl,
    storage_path: draft.storagePath,
    orientation: draft.orientation,
    dominant_colors: draft.dominantColors,
    tags: draft.tags,
    seasons: draft.seasons,
    holidays: draft.holidays,
    license: draft.license,
    public_domain_status: draft.publicDomainStatus,
    attribution_text: draft.attributionText,
    attribution_required: draft.attributionRequired,
    verified_at: draft.verifiedAt,
    verified_by: draft.verifiedBy,
    source_provider: draft.sourceProvider,
    source_provider_artwork_id: draft.sourceProviderArtworkId,
    featured: draft.featured,
    editorial_priority: draft.editorialPriority,
    approval_status: draft.approvalStatus,
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
