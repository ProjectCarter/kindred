/**
 * History Around Town Library audit.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-history-around-town-library.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-history-around-town-library.mjs --metro gilbert-az
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-history-around-town-library.mjs --verify-images
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/audit-history-around-town-library.mjs --verify-images --write-image-status
 */
import { createClient } from "@supabase/supabase-js";
import { isApprovedHistoryPlace } from "./lib/historyPlaceValidation.mjs";
import {
  verifyHistoryPlaceImages,
  summarizeImageVerification,
  findDuplicateImageUrls,
} from "./lib/historyPlaceImageVerification.mjs";

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

const args = process.argv.slice(2);
const metroArg =
  args.find((a) => a.startsWith("--metro="))?.split("=")[1] ??
  (args.includes("--metro") ? args[args.indexOf("--metro") + 1] : null);
const verifyImages = args.includes("--verify-images");
const writeImageStatus = args.includes("--write-image-status");

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function countWords(text) {
  return text?.trim().split(/\s+/).filter(Boolean).length ?? 0;
}

async function main() {
  let query = admin.from("kindred_history_places").select("*");
  if (metroArg) query = query.eq("metro_key", metroArg);

  const { data, error } = await query.order("metro_key").order("place_name");
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  const byMetro = new Map();
  for (const row of rows) {
    const list = byMetro.get(row.metro_key) ?? [];
    list.push(row);
    byMetro.set(row.metro_key, list);
  }

  console.log("History Around Town Library audit");
  console.log("=================================");
  console.log(`Total rows: ${rows.length}`);

  for (const [metro, places] of [...byMetro.entries()].sort()) {
    const approved = places.filter((p) => p.validation_status === "approved");
    const needsReview = places.filter((p) => p.validation_status === "needs_review");
    const rejected = places.filter((p) => p.validation_status === "rejected");
    const gateApproved = places.filter((p) => isApprovedHistoryPlace(p));

    console.log(`\n${metro}`);
    console.log(`  approved (status): ${approved.length}`);
    console.log(`  approved (gate):   ${gateApproved.length}`);
    console.log(`  needs_review:      ${needsReview.length}`);
    console.log(`  rejected:          ${rejected.length}`);

    const shortBody = places.filter((p) => countWords(p.story_body) < 120);
    const missingImage = places.filter(
      (p) => !p.hosted_url?.trim() && !p.image_url?.trim()
    );
    const missingCoords = places.filter((p) => p.lat == null || p.lon == null);

    if (shortBody.length) {
      console.log(`  ⚠ short story_body: ${shortBody.map((p) => p.slug).join(", ")}`);
    }
    if (missingImage.length) {
      console.log(`  ⚠ missing image: ${missingImage.map((p) => p.slug).join(", ")}`);
    }
    if (missingCoords.length) {
      console.log(`  ⚠ missing coords: ${missingCoords.map((p) => p.slug).join(", ")}`);
    }

    const categories = new Map();
    for (const p of approved) {
      categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
    }
    if (categories.size) {
      console.log(
        "  categories:",
        [...categories.entries()].map(([k, v]) => `${k}:${v}`).join(", ")
      );
    }
  }

  const { count: editionCount } = await admin
    .from("editions")
    .select("*", { count: "exact", head: true })
    .not("history_around_town", "is", null);

  console.log(`\nEditions with frozen snapshot: ${editionCount ?? 0}`);

  if (verifyImages) {
    const duplicates = findDuplicateImageUrls(rows);
    console.log("\n--- Image verification ---");
    console.log(`Duplicate images: ${duplicates.length}`);
    for (const dup of duplicates) {
      console.log(`  ${dup.places.map((p) => p.slug).join(", ")}`);
    }

    const results = await verifyHistoryPlaceImages(rows, { interRequestDelayMs: 400 });
    const summary = summarizeImageVerification(results);

    console.log(`\nVerified images: ${summary.verified.length}`);
    console.log(
      `Verification pending (rate limited): ${summary.verification_pending_rate_limit.length}`
    );
    console.log(
      `Verification pending (transient): ${summary.verification_pending_transient.length}`
    );
    console.log(`Failed images: ${summary.failed.length}`);
    console.log(`Missing image URL: ${summary.missing_url.length}`);

    const broken = summary.failed.filter((r) =>
      [404, 410].includes(r.httpStatus)
    );
    console.log(`Broken image URLs (404/410): ${broken.length}`);

    for (const r of summary.verified) {
      console.log(`  ✓ ${r.slug} HTTP ${r.httpStatus}`);
    }
    for (const r of summary.verification_pending_rate_limit) {
      console.log(
        `  ⏳ ${r.slug} HTTP ${r.httpStatus} (rate limited — not rejected)`
      );
    }
    for (const r of summary.verification_pending_transient) {
      console.log(`  ⏳ ${r.slug} HTTP ${r.httpStatus || "network"} (transient)`);
    }
    for (const r of summary.failed) {
      console.log(`  ✗ ${r.slug} HTTP ${r.httpStatus || "invalid"}`);
    }

    if (writeImageStatus) {
      const now = new Date().toISOString();
      for (const r of results) {
        await admin
          .from("kindred_history_places")
          .update({
            image_verification_status: r.status,
            image_verification_http_status: r.httpStatus || null,
            image_verification_checked_at: now,
            image_verified_at:
              r.status === "verified" ? now : null,
            updated_at: now,
          })
          .eq("id", r.id);
      }
      console.log("\nWrote image_verification_status for all rows.");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
