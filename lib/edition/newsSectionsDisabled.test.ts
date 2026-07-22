/**
 * Regression: with news sections disabled for V1, editions must not gate
 * completeness or validation on Local News / National News.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isNewsSectionsEnabled, ENABLE_NEWS_SECTIONS } from "./newsSectionsFeature.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("ENABLE_NEWS_SECTIONS is false for V1", () => {
  assert.equal(ENABLE_NEWS_SECTIONS, false);
  assert.equal(isNewsSectionsEnabled(), false);
});

test("server mirror matches client news flag", () => {
  const source = readFileSync(
    path.join(
      __dirname,
      "../../supabase/functions/_shared/edition/newsSectionsFeature.ts"
    ),
    "utf8"
  );
  assert.match(source, /ENABLE_NEWS_SECTIONS = false/);
});

test("editionCompleteness skips lead_story when news disabled", () => {
  const source = readFileSync(
    path.join(__dirname, "../perf/editionCompleteness.ts"),
    "utf8"
  );
  assert.match(source, /isNewsSectionsEnabled\(\) && !hasLeadStory/);
});

test("runStagedEditionBuild skips local_news stage when flag is false", () => {
  const source = readFileSync(
    path.join(
      __dirname,
      "../../supabase/functions/_shared/edition/runStagedEditionBuild.ts"
    ),
    "utf8"
  );
  assert.match(source, /isNewsSectionsEnabled\(\)/);
  assert.match(source, /localNewsDesk\] stage skipped/);
});

test("home.tsx skips national news hydration when flag is false", () => {
  const source = readFileSync(
    path.join(__dirname, "../../app/home.tsx"),
    "utf8"
  );
  assert.match(source, /isNewsSectionsEnabled/);
  assert.match(source, /ensureNationalNewsHydrated/);
  assert.match(source, /if \(!isNewsSectionsEnabled\(\)\) return true/);
});

test("national daily validation allows missing national_news when flag is false", () => {
  const source = readFileSync(
    path.join(__dirname, "./nationalDailyValidation.ts"),
    "utf8"
  );
  assert.match(source, /isNewsSectionsEnabled/);
  assert.match(source, /missing_national_news/);
});
