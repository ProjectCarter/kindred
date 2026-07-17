/**
 * Seed permanent "The Story of..." articles from content/city-articles/*.json
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-city-articles.mjs
 *   node scripts/seed-city-articles.mjs --dry-run
 *   node scripts/seed-city-articles.mjs --file seattle-wa.json
 */
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  paragraphCount,
  validateStoryOfArticle,
} from "./lib/storyOfEditorial.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, "..", "content", "city-articles");

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1]
  ?? (args.includes("--file") ? args[args.indexOf("--file") + 1] : null);

function wordCount(text) {
  return text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

async function loadArticles() {
  const files = fileArg
    ? [fileArg.endsWith(".json") ? fileArg : `${fileArg}.json`]
    : (await readdir(CONTENT_DIR)).filter((f) => f.endsWith(".json"));

  const articles = [];
  for (const file of files) {
    const fullPath = path.join(CONTENT_DIR, file);
    const raw = JSON.parse(await readFile(fullPath, "utf8"));
    validateStoryOfArticle(raw);
    articles.push({ file, raw });
  }
  return articles;
}

async function main() {
  if (!dryRun && (!SUPABASE_URL || !SERVICE_KEY)) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const articles = await loadArticles();
  console.log(`Found ${articles.length} Story of… article(s) to seed`);

  const supabase =
    dryRun ? null : createClient(SUPABASE_URL, SERVICE_KEY);

  for (const { file, raw } of articles) {
    const row = {
      metro_key: raw.metroKey,
      city_name: raw.cityName,
      state: raw.state ?? null,
      region: raw.region ?? null,
      headline: raw.headline.trim(),
      subtitle: raw.subtitle.trim(),
      body: raw.body.trim(),
      image_url: raw.image.url.trim(),
      image_caption: raw.image.caption.trim(),
      image_credit: raw.image.credit.trim(),
      image_source_url: raw.image.sourceUrl.trim(),
      image_license: raw.image.license?.trim() ?? "public_domain",
      sources: raw.furtherReading ?? [],
      verification_notes: raw.verificationNotes ?? null,
      word_count: wordCount(raw.body),
      approval_status: raw.approvalStatus ?? "approved",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log(
      `→ ${file}: ${row.metro_key} (${row.word_count} words, ${paragraphCount(row.body)} paragraphs)`
    );

    if (dryRun) continue;

    const { error } = await supabase.from("kindred_city_articles").upsert(row, {
      onConflict: "metro_key",
    });

    if (error) {
      console.error(`  ✗ ${error.message}`);
      process.exitCode = 1;
    } else {
      console.log("  ✓ upserted");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
