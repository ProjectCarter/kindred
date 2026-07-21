import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";

/**
 * ArticleReader uses EditorialTitle when categoryIcon is present (Food & Drinks,
 * Events, Activities, etc.). Regression guard — import was dropped during analytics wiring.
 */
test("ArticleReader imports EditorialTitle for categoryIcon headlines", () => {
  const src = readFileSync(new URL("./ArticleReader.tsx", import.meta.url), "utf8");
  assert.match(
    src,
    /import \{ EditorialTitle \} from "\.\/EditorialTitle"/,
    "ArticleReader must import EditorialTitle"
  );
  assert.match(src, /article\.categoryIcon[\s\S]*<EditorialTitle/);
});

test("categoryIcon headline branch passes icon and title to EditorialTitle", () => {
  const src = readFileSync(new URL("./ArticleReader.tsx", import.meta.url), "utf8");
  assert.match(
    src,
    /icon=\{article\.categoryIcon\}[\s\S]*title=\{article\.headline\}[\s\S]*style=\{styles\.headline\}/
  );
});
