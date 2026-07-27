#!/usr/bin/env node
/**
 * Post-build step: guarantee the Impact.com verification <meta> is the literal
 * FIRST element inside <head> on every exported page — ahead of the charset and
 * viewport tags that Next.js injects automatically.
 *
 * Next's App Router always emits <meta charset> and <meta viewport> at the very
 * top of <head>, so the only reliable way to place the verification tag before
 * them in the final static HTML is to reposition it after `next build`.
 *
 * This only moves the existing tag; it does not change any site content.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const IMPACT_META =
  '<meta name="impact-site-verification" value="97c4ef62-a7eb-4a7f-8be8-5e7309e7517d"/>';

// Matches the rendered <meta> tag only (not the escaped RSC/JSON payload).
const IMPACT_META_RE = /<meta name="impact-site-verification"[^>]*>/g;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(scriptDir, "..", "out");

async function collectHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectHtmlFiles(full)));
    } else if (entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

const files = await collectHtmlFiles(outDir);
let updated = 0;

for (const file of files) {
  let html = await readFile(file, "utf8");
  const headIndex = html.indexOf("<head>");
  if (headIndex === -1) continue;
  if (!IMPACT_META_RE.test(html)) {
    IMPACT_META_RE.lastIndex = 0;
    continue;
  }
  IMPACT_META_RE.lastIndex = 0;

  // Remove any rendered occurrence(s), then re-insert as the first head child.
  html = html.replace(IMPACT_META_RE, "");
  html = html.replace("<head>", `<head>${IMPACT_META}`);

  await writeFile(file, html, "utf8");
  updated += 1;
}

console.log(
  `[hoist-impact-meta] Impact verification meta placed first in <head> on ${updated} page(s).`,
);
