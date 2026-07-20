/**
 * Audit why library rows fail isCompleteLibraryRecord().
 * Uses production validation modules — no weakened gates.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx deno run --allow-env --allow-net --allow-read \
 *     scripts/audit-hero-library-readiness.ts
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { rowToRecord } from "../supabase/functions/_shared/heroArtwork/library.ts";
import { isApprovedMasterpieceLibraryRecord } from "../supabase/functions/_shared/heroArtwork/libraryValidation.ts";
import {
  detailFromApprovedRecord,
  isCompleteLibraryRecord,
} from "../supabase/functions/_shared/heroArtwork/presentation.ts";
import {
  hasLibraryAboutArtworkBody,
  validateAboutArtworkBody,
} from "../supabase/functions/_shared/heroArtwork/editorial.ts";
import {
  validateArtistBiography,
  validateDidYouKnow,
  validateLongStoryBody,
  validateLookCloserItems,
} from "../supabase/functions/_shared/heroArtwork/detailEditorial.ts";
import { isHeroArtworkLicenseSafe } from "../supabase/functions/_shared/heroArtwork/licensing.ts";
import { isHostedHeroArtwork, isSelectableHeroArtwork } from "../supabase/functions/_shared/heroArtwork/library.ts";
import type { HeroArtworkRow } from "../supabase/functions/_shared/heroArtwork/types.ts";
import { masterpieceDetailIsCorrupt } from "../supabase/functions/_shared/heroArtwork/articleValidation.ts";
import { isFrozenDetailComplete } from "../supabase/functions/_shared/heroArtwork/detailTemplate.ts";

async function loadLocalEnv(): Promise<void> {
  try {
    const raw = await Deno.readTextFile(".env.local");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!Deno.env.get(key)) Deno.env.set(key, value);
    }
  } catch {
    /* optional */
  }
}

await loadLocalEnv();
const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL")?.trim() ||
  Deno.env.get("EXPO_PUBLIC_SUPABASE_URL")?.trim() ||
  "https://zdqjeocdsbdzecawumdp.supabase.co";
if (!Deno.env.get("SUPABASE_URL")?.trim()) {
  Deno.env.set("SUPABASE_URL", SUPABASE_URL);
}
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";
if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()) {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type Check = {
  field: string;
  why: string;
  test: (row: HeroArtworkRow, record: ReturnType<typeof rowToRecord>) => boolean;
};

const checks: Check[] = [
  { field: "hosted_url + storage_path", why: "Edition build serves hosted images only — no live Wikimedia fetches", test: (row) => isHostedHeroArtwork(row) },
  { field: "artwork_title", why: "Morning hero headline must name the verified artwork", test: (row) => Boolean(row.artwork_title?.trim()) },
  { field: "artist", why: "Reader and credit line require verified artist attribution", test: (row) => Boolean(row.artist?.trim()) },
  { field: "source_institution", why: "Provenance module cites the holding institution", test: (row) => Boolean(row.source_institution?.trim()) },
  { field: "source_url", why: "Official catalog link for verification and reader modules", test: (row) => Boolean(row.source_url?.trim()) },
  { field: "license", why: "Publication rights gate — Kindred never ships unlicensed art", test: (row) => Boolean(row.license?.trim()) },
  { field: "attribution_text", why: "Credit line on homepage hero and reader", test: (row) => Boolean(row.attribution_text?.trim()) },
  { field: "about_artwork_body (35+ words)", why: "Homepage teaser body for Today's Masterpiece card", test: (row) => hasLibraryAboutArtworkBody(row.about_artwork_body) },
  { field: "about_artwork_body (1–2 sentences, 35–60 words)", why: "Strict homepage teaser editorial standard", test: (row) => validateAboutArtworkBody(row.about_artwork_body).valid },
  { field: "approval_status = approved", why: "Curator gate before daily rotation", test: (row) => row.approval_status === "approved" },
  { field: "detail_editorial_status = approved", why: "Long-form reader article must be editorially approved", test: (row) => row.detail_editorial_status === "approved" },
  { field: "curator_editorial_status = approved", why: "Secondary curator sign-off on library ingest", test: (row) => row.curator_editorial_status === "approved" },
  { field: "public_domain_status = verified", why: "Legal safety for nationwide daily reproduction", test: (row) => row.public_domain_status === "verified" },
  { field: "commercial_use_confirmed", why: "Confirmed OK for app publication", test: (row) => row.commercial_use_confirmed === true },
  { field: "license safety stack", why: "isHeroArtworkLicenseSafe — no ambiguous rights", test: (row, record) => isHeroArtworkLicenseSafe(record) },
  { field: "long_story_body", why: "Full reader article — 6–10 paragraphs, swap/lasting-thought gates", test: (row) => validateLongStoryBody(row.long_story_body).valid },
  { field: "artist_biography", why: "About the Artist module in reader", test: (row) => validateArtistBiography(row.artist_biography).valid },
  { field: "look_closer_items (2–4)", why: "Looking Closer module in reader", test: (row) => validateLookCloserItems(row.look_closer_items).valid },
  { field: "did_you_know", why: "Did You Know module in reader", test: (row) => validateDidYouKnow(row.did_you_know).valid },
  { field: "museum_name", why: "Museum module in reader", test: (row) => Boolean(row.museum_name?.trim()) },
  { field: "museum_location", why: "Museum location line in reader", test: (row) => Boolean(row.museum_location?.trim()) },
  { field: "official_museum_url OR official_artwork_url", why: "Verified outbound museum link", test: (row) => Boolean(row.official_museum_url?.trim() || row.official_artwork_url?.trim()) },
  { field: "detailFromApprovedRecord (sections + frozen detail)", why: "Assembled reader detail must be complete and uncorrupt", test: (row) => {
    const record = rowToRecord(row);
    const detail = detailFromApprovedRecord(record);
    if (!detail) return false;
    return isFrozenDetailComplete(detail) && !masterpieceDetailIsCorrupt(detail);
  }},
  { field: "isApprovedMasterpieceLibraryRecord", why: "Combined ingest gate used at selection time", test: (row) => isApprovedMasterpieceLibraryRecord(rowToRecord(row)) },
  { field: "isCompleteLibraryRecord", why: "Production-ready — eligible for listReadyHeroArtworkLibrary()", test: (row) => isCompleteLibraryRecord(rowToRecord(row)) },
];

const { data: rows, error } = await admin
  .from("kindred_hero_artwork")
  .select("*")
  .eq("approval_status", "approved")
  .eq("validation_status", "approved")
  .eq("public_domain_status", "verified")
  .eq("curator_editorial_status", "approved")
  .eq("detail_editorial_status", "approved")
  .eq("commercial_use_confirmed", true)
  .not("hosted_url", "is", null)
  .not("storage_path", "is", null);

if (error) {
  console.error(error.message);
  Deno.exit(1);
}

const catalog = (rows ?? []).filter((row) => isSelectableHeroArtwork(row as HeroArtworkRow));
console.log(JSON.stringify({ catalogSize: catalog.length }, null, 2));

type RowResult = { id: string; title: string; failures: string[] };

const results: RowResult[] = catalog.map((row) => {
  const r = row as HeroArtworkRow;
  const record = rowToRecord(r);
  const failures: string[] = [];
  for (const check of checks) {
    if (!check.test(r, record)) failures.push(check.field);
  }
  return {
    id: r.id,
    title: r.artwork_title?.slice(0, 48) ?? "",
    failures,
  };
});

const summary = checks.map((check) => {
  const missing = results.filter((r) => r.failures.includes(check.field));
  const example = missing[0];
  return {
    requiredField: check.field,
    missingCount: missing.length,
    exampleArtwork: example ? `${example.title} (${example.id.slice(0, 8)}…)` : "—",
    whyRequired: check.why,
  };
});

const readyCount = results.filter((r) => r.failures.length === 0).length;

console.log(
  JSON.stringify(
    {
      readyCount,
      catalogSize: catalog.length,
      summary,
      sampleFailures: results.slice(0, 5).map((r) => ({
        title: r.title,
        failures: r.failures,
        longStoryReason: validateLongStoryBody(
          (rows!.find((x) => x.id === r.id) as HeroArtworkRow).long_story_body
        ).reason,
        aboutReason: validateAboutArtworkBody(
          (rows!.find((x) => x.id === r.id) as HeroArtworkRow).about_artwork_body
        ).reason,
      })),
    },
    null,
    2
  )
);
