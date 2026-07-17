/**
 * Verify History Around Town image URLs with retry + rate-limit handling.
 * Optionally writes image_verification_status back to the library.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-history-around-town-images.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-history-around-town-images.mjs --metro gilbert-az --write
 */
import { createClient } from "@supabase/supabase-js";
import {
  verifyHistoryPlaceImages,
  summarizeImageVerification,
  findDuplicateImageUrls,
  IMAGE_VERIFICATION_STATUS,
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
const writeStatus = args.includes("--write");

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function printGroup(label, items) {
  console.log(`\n${label}: ${items.length}`);
  for (const r of items) {
    const http = r.httpStatus ? ` HTTP ${r.httpStatus}` : "";
    const attempts = r.attempts ? ` (${r.attempts} attempt${r.attempts > 1 ? "s" : ""})` : "";
    console.log(`  • ${r.slug}${http}${attempts}`);
  }
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
  console.log("History Around Town — Image Verification");
  console.log("========================================");
  console.log(`Places checked: ${rows.length}${metroArg ? ` (${metroArg})` : ""}`);

  const duplicates = findDuplicateImageUrls(rows);
  console.log(`\nDuplicate images: ${duplicates.length}`);
  for (const dup of duplicates) {
    console.log(`  • ${dup.url.slice(-60)}`);
    for (const p of dup.places) {
      console.log(`      ${p.metro_key}/${p.slug}`);
    }
  }

  const results = await verifyHistoryPlaceImages(rows, { interRequestDelayMs: 400 });
  const summary = summarizeImageVerification(results);

  printGroup("Verified images", summary.verified);
  printGroup(
    "Verification pending (rate limited)",
    summary.verification_pending_rate_limit
  );
  printGroup(
    "Verification pending (transient)",
    summary.verification_pending_transient
  );
  printGroup("Failed images", summary.failed);
  printGroup("Missing image URL", summary.missing_url);

  const broken = summary.failed.filter((r) =>
    [404, 410].includes(r.httpStatus)
  );
  console.log(`\nBroken image URLs (404/410): ${broken.length}`);
  for (const r of broken) {
    console.log(`  • ${r.slug} HTTP ${r.httpStatus}`);
  }

  if (writeStatus) {
    const now = new Date().toISOString();
    console.log("\nWriting image_verification_status to library...");
    for (const r of results) {
      const patch = {
        image_verification_status: r.url ? r.status : IMAGE_VERIFICATION_STATUS.FAILED,
        image_verification_http_status: r.httpStatus || null,
        image_verification_checked_at: now,
        image_verified_at:
          r.status === IMAGE_VERIFICATION_STATUS.VERIFIED ? now : null,
        updated_at: now,
      };
      const { error: updateError } = await admin
        .from("kindred_history_places")
        .update(patch)
        .eq("id", r.id);
      if (updateError) {
        console.error(`  failed ${r.slug}:`, updateError.message);
        process.exit(1);
      }
    }
    console.log(`  updated ${results.length} rows`);
  }

  console.log("\nSummary:");
  console.log(
    JSON.stringify(
      {
        verified: summary.verified.length,
        verification_pending_rate_limit:
          summary.verification_pending_rate_limit.length,
        verification_pending_transient:
          summary.verification_pending_transient.length,
        failed: summary.failed.length,
        missing_url: summary.missing_url.length,
        duplicate_images: duplicates.length,
        broken_urls: broken.length,
      },
      null,
      2
    )
  );

  if (summary.failed.length > 0 || summary.missing_url.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
