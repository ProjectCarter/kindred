/**
 * Local News briefing gates — Node smoke tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function isThinSource(sourceText: string): boolean {
  return wordCount(sourceText) < 40;
}

function isRichLocalNewsSource(sourceText: string): boolean {
  return wordCount(sourceText) >= 80;
}

function isLocalNewsRole(role: string | null | undefined): boolean {
  return /local/i.test(role ?? "");
}

function localNewsSurfaceRole(
  role: string,
  placement: "lead" | "top_story"
): string {
  if (isLocalNewsRole(role)) return "local_news";
  return placement === "lead" ? "lead" : "top_story";
}

function validateLocalNewsBriefing(input: {
  paragraphs: string[];
  sourceText: string;
}): string[] {
  const issues: string[] = [];
  if (
    isRichLocalNewsSource(input.sourceText) &&
    input.paragraphs.length < 4
  ) {
    issues.push("briefing_too_short");
  }
  if (input.paragraphs.length > 8) {
    issues.push("briefing_too_long");
  }
  if (isThinSource(input.sourceText) && input.paragraphs.length > 3) {
    issues.push("thin_source_padded");
  }
  return issues;
}

test("local news roles map to local_news surface", () => {
  assert.equal(isLocalNewsRole("local"), true);
  assert.equal(isLocalNewsRole("national"), false);
  assert.equal(localNewsSurfaceRole("local", "lead"), "local_news");
  assert.equal(localNewsSurfaceRole("national", "lead"), "lead");
});

test("localNewsBriefing module has no orphaned placeLabel body", () => {
  const source = readFileSync(
    path.join(
      __dirname,
      "../../supabase/functions/_shared/storyEditor/localNewsBriefing.ts"
    ),
    "utf8"
  );
  // Orphaned duplicate body (pre-placeLabel) would break Deno/esbuild load.
  assert.doesNotMatch(
    source,
    /\}\s*\n\s*const parts = \[place\.city[\s\S]*?function placeLabel/
  );
  assert.match(source, /function placeLabel\(place: LocalNewsReaderPlace\)/);
  assert.match(source, /role: "local"/);
  assert.match(source, /selectLocalNewsDeskLead/);
  assert.match(source, /localLeadAgeBand/);
  assert.match(source, /recentStoryKeys/);
  assert.doesNotMatch(source, /recentStoryKeys:\s*\[\]/);
});

test("rich local sources require fuller briefings", () => {
  const richSource =
    "City council voted Tuesday to approve a $12 million bond for water infrastructure after months of debate. " +
    "The measure passed 5–2 following testimony from residents in the north district who reported recurring outages. " +
    "Work is expected to begin next spring on mains serving roughly 18,000 households. " +
    "Officials said the project would replace lines that date to the 1970s and reduce boil-water notices. " +
    "Financing will be repaid through a modest rate adjustment spread across five years according to the city manager.";

  assert.equal(isRichLocalNewsSource(richSource), true);
  assert.deepEqual(
    validateLocalNewsBriefing({ paragraphs: ["one", "two"], sourceText: richSource }),
    ["briefing_too_short"]
  );
  assert.deepEqual(
    validateLocalNewsBriefing({
      paragraphs: ["a", "b", "c", "d"],
      sourceText: richSource,
    }),
    []
  );
});

test("thin wires must not be padded", () => {
  assert.deepEqual(
    validateLocalNewsBriefing({
      paragraphs: ["a", "b", "c", "d"],
      sourceText: "Short wire note.",
    }),
    ["thin_source_padded"]
  );
});
