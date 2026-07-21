#!/usr/bin/env node
/**
 * Food & Drinks editorial audit — verified editorial notes, not map listings.
 * Usage: npx --yes tsx scripts/audit-gilbert-food-drinks-today.mjs [edition_id]
 */
import { createClient } from "@supabase/supabase-js";
import { allocateDiscoverySections } from "../lib/edition/sectionAllocator.ts";
import { selectHomepageRecommendationCards } from "../lib/edition/recommendations.ts";
import { isAddressStyleFoodCopy } from "../lib/edition/foodDrinkPresentation.ts";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const EDITION_ID =
  process.argv[2] ?? "caf63870-2525-480a-833c-818c572391cd";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: edition, error } = await admin
  .from("editions")
  .select("discovery, edition_date")
  .eq("id", EDITION_ID)
  .maybeSingle();

if (error || !edition?.discovery) {
  console.error("Failed to load edition discovery", error?.message ?? "missing");
  process.exit(1);
}

const allocation = allocateDiscoverySections(edition.discovery);
const cards = selectHomepageRecommendationCards(allocation.recommendations, {
  city: "Gilbert",
  editionDate: edition.edition_date ?? null,
});

const issues = [];
const warnings = [];

console.log(`Food & Drinks audit — edition ${EDITION_ID}`);
console.log(`Verified pool: ${allocation.recommendations.length}`);
console.log(`Homepage cards (${cards.length}):`);
console.log("");

for (const card of cards) {
  console.log(`  - ${card.title}`);
  console.log(`    subtitle: ${card.subtitle ?? "(none)"}`);
  console.log(`    note: ${card.note ?? "(none)"}`);

  if (!card.note?.trim()) {
    issues.push(`missing editorial note: ${card.title}`);
  } else if (isAddressStyleFoodCopy(card.note)) {
    issues.push(`address-style note: ${card.title}`);
  } else if (card.note.trim().length < 18) {
    issues.push(`note too thin: ${card.title}`);
  }

  if (card.subtitle && card.note && card.subtitle.trim() === card.note.trim()) {
    issues.push(`note duplicates subtitle: ${card.title}`);
  }

  const sentenceCount = card.note?.split(/[.!?]+/).filter((s) => s.trim()).length ?? 0;
  if (card.note && sentenceCount > 2) {
    warnings.push(`note longer than two sentences: ${card.title}`);
  }
}

if (cards.length < 8) {
  warnings.push(`homepage shows ${cards.length} cards, expected up to 8`);
}

console.log("");
console.log("Critical:", issues.length ? issues : "none");
console.log("Warnings:", warnings.length ? warnings : "none");
console.log(
  "Editorial status:",
  issues.length === 0 ? "PASS (Food & Drinks editorial notes)" : "FAIL"
);

process.exit(issues.length ? 1 : 0);
