/**
 * Top Stories adapter contract — source-read tests (avoids RN import chain).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("topStoriesFromEditorialContext parses body paragraphs", () => {
  const source = readFileSync(
    path.join(__dirname, "./topStoriesFromContext.ts"),
    "utf8"
  );
  assert.match(source, /body: Array\.isArray\(item\.body\)/);
  assert.match(source, /item\.dek\?\.trim\(\)/);
  assert.match(source, /item\.desk/);
});

test("articleFromTopStory prefers edited body over card summary", () => {
  const source = readFileSync(path.join(__dirname, "./topStories.ts"), "utf8");
  assert.match(source, /story\.body\?\.length/);
  assert.match(source, /dek: story\.dek \?\? story\.summary/);
});

test("localNewsBriefing stage wires enrichLocalNewsEditorial", () => {
  const source = readFileSync(
    path.join(
      __dirname,
      "../../supabase/functions/_shared/edition/runStagedEditionBuild.ts"
    ),
    "utf8"
  );
  assert.match(source, /enrichLocalNewsEditorial\(/);
  assert.match(source, /buildUnenrichedLocalNews\(/);
  assert.match(source, /loadRecentStoryKeys\(/);
  assert.match(source, /metroKey:\s*ctx\.metroKey/);
  assert.match(source, /excludeEditionDate:\s*ctx\.editionDate/);
  assert.doesNotMatch(source, /recentStoryKeys:\s*\[\]/);
  assert.doesNotMatch(source, /body: editorial\.leadStory\.summary/);
  assert.doesNotMatch(
    source,
    /bandit: banditPayload,\s*\n\s*lead_story: editorial\.leadStory/
  );
});

test("EditionReader gates news folios behind ENABLE_NEWS_SECTIONS", () => {
  const source = readFileSync(
    path.join(__dirname, "../../components/EditionReader.tsx"),
    "utf8"
  );
  assert.match(source, /isNewsSectionsEnabled/);
  assert.match(source, /resolveLocalNewsHomePackage/);
  assert.match(source, /NewsArticleSection/);
  assert.match(source, /Local Deals/);
  assert.match(source, /Local savings, coming soon/);
});
