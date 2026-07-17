/**
 * Full Masterpiece Library audit — run before/after migration 0039.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-masterpiece-library.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-masterpiece-library.mjs --verify-images
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

const verifyImages = process.argv.includes("--verify-images");
const EDITION_DATE =
  process.env.EDITION_DATE ?? new Date().toISOString().slice(0, 10);

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WIKIDATA_RE = /QS:|(?:^|\s)P\d{5,}|wikibase/i;

function hasCorruptMetadata(row) {
  const fields = [
    row.artwork_title,
    row.artist,
    row.year,
    row.about_artwork_body,
    row.long_story_body,
    row.attribution_text,
  ];
  return fields.some((f) => typeof f === "string" && WIKIDATA_RE.test(f));
}

function missingYear(row) {
  return !row.year?.trim();
}

function storyReady(row) {
  return (
    row.detail_editorial_status === "approved" &&
    row.long_story_body?.trim() &&
    row.artist_biography?.trim() &&
    Array.isArray(row.look_closer_items) &&
    row.look_closer_items.length >= 2 &&
    row.did_you_know?.trim() &&
    row.museum_name?.trim() &&
    row.museum_location?.trim() &&
    (row.official_museum_url?.trim() || row.official_artwork_url?.trim())
  );
}

function fullyApproved(row) {
  return (
    row.validation_status === "approved" &&
    row.approval_status === "approved" &&
    row.detail_editorial_status === "approved" &&
    row.curator_editorial_status === "approved" &&
    row.public_domain_status === "verified" &&
    row.commercial_use_confirmed === true &&
    row.hosted_url?.trim() &&
    row.storage_path?.trim() &&
    row.artwork_title?.trim() &&
    row.artist?.trim() &&
    !missingYear(row) &&
    row.source_institution?.trim() &&
    row.license?.trim() &&
    row.attribution_text?.trim() &&
    row.about_artwork_body?.trim() &&
    storyReady(row) &&
    !hasCorruptMetadata(row)
  );
}

async function verifyImage(url) {
  if (!url?.trim()) return { ok: false, status: 0 };
  try {
    const res = await fetch(url.trim(), { method: "HEAD", redirect: "follow" });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function main() {
  const schemaProbe = await admin
    .from("kindred_hero_artwork")
    .select("validation_status, last_shown_date")
    .limit(1);

  const migrationApplied = !schemaProbe.error?.message?.includes(
    "validation_status"
  );

  const { data: rows, error } = await admin
    .from("kindred_hero_artwork")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Library query failed:", error.message);
    process.exit(1);
  }

  const all = rows ?? [];
  const byInternal = new Map();
  const byProvider = new Map();
  const duplicates = [];

  for (const row of all) {
    const ik = row.internal_id?.trim();
    if (ik) {
      if (byInternal.has(ik)) duplicates.push({ kind: "internal_id", id: ik });
      else byInternal.set(ik, row.id);
    }
    const pk = `${row.source_provider}:${row.source_provider_artwork_id}`;
    if (byProvider.has(pk)) duplicates.push({ kind: "provider", id: pk });
    else byProvider.set(pk, row.id);
  }

  const report = {
    auditedAt: new Date().toISOString(),
    migration0039Applied: migrationApplied,
    totals: {
      records: all.length,
      validationApproved: all.filter((r) => r.validation_status === "approved")
        .length,
      validationNeedsReview: all.filter(
        (r) => (r.validation_status ?? "needs_review") === "needs_review"
      ).length,
      validationRejected: all.filter((r) => r.validation_status === "rejected")
        .length,
      approvalApproved: all.filter((r) => r.approval_status === "approved")
        .length,
      fullyArticleReady: all.filter(storyReady).length,
      fullyApprovedStrict: all.filter(fullyApproved).length,
    },
    issues: {
      corruptMetadata: all.filter(hasCorruptMetadata).map((r) => ({
        id: r.id,
        title: r.artwork_title,
      })),
      missingTitle: all.filter((r) => !r.artwork_title?.trim()).length,
      missingArtist: all.filter((r) => !r.artist?.trim()).length,
      missingYear: all.filter(missingYear).length,
      missingMuseum: all.filter((r) => !r.museum_name?.trim()).length,
      missingImage: all.filter((r) => !r.hosted_url?.trim()).length,
      missingLicense: all.filter((r) => !r.license?.trim()).length,
      missingTeaser: all.filter((r) => !r.about_artwork_body?.trim()).length,
      missingArticle: all.filter((r) => !r.long_story_body?.trim()).length,
      duplicateKeys: duplicates,
    },
    rotation: {
      withLastShownDate: all.filter((r) => r.last_shown_date).length,
      withUseCount: all.filter((r) => (r.use_count ?? 0) > 0).length,
      maxUseCount: Math.max(0, ...all.map((r) => r.use_count ?? 0)),
    },
  };

  if (verifyImages) {
    const imageResults = [];
    for (const row of all.filter((r) => r.hosted_url?.trim())) {
      const result = await verifyImage(row.hosted_url);
      if (!result.ok) {
        imageResults.push({
          id: row.id,
          title: row.artwork_title,
          status: result.status,
        });
      }
    }
    report.imageVerification = {
      checked: all.filter((r) => r.hosted_url?.trim()).length,
      failed: imageResults.length,
      failures: imageResults.slice(0, 20),
    };
  }

  const { data: selection } = await admin
    .from("kindred_hero_artwork_edition_selections")
    .select("edition_date, artwork_id, presentation_snapshot")
    .eq("edition_date", EDITION_DATE)
    .maybeSingle();

  report.todayFreeze = selection
    ? {
        editionDate: EDITION_DATE,
        artworkId: selection.artwork_id,
        hasSnapshot: Boolean(selection.presentation_snapshot?.hostedUrl),
        title: selection.presentation_snapshot?.artworkTitle ?? null,
        snapshotCorrupt: selection.presentation_snapshot
          ? hasCorruptMetadata({
              artwork_title: selection.presentation_snapshot.artworkTitle,
              artist: selection.presentation_snapshot.artist,
              about_artwork_body: selection.presentation_snapshot.aboutArtworkBody,
            })
          : false,
      }
    : null;

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
