import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateArticleHandoff,
  isWireNewsSection,
} from "./articleIntegrity.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("articleFromLeadStory uses edition lead fields instead of gold standard", () => {
  const source = readFileSync(path.join(__dirname, "./article.ts"), "utf8");
  assert.doesNotMatch(source, /getGoldStandardArticle\(\{ id: lead\.id/);
  assert.match(source, /lead\.headline/);
  assert.match(source, /lead\.heroImage\?\.uri/);
  assert.match(source, /lead\.role === "local" \? "local_news" : "lead"/);
});

test("ensureArticleHero skips editorial substitutes for wire news", () => {
  const source = readFileSync(path.join(__dirname, "./articleHero.ts"), "utf8");
  assert.match(source, /isWireNewsSection\(article\.section\)/);
  assert.match(source, /return \{ \.\.\.article, heroImage: null \}/);
});

test("validateArticleHandoff rejects headline drift between card and reader", () => {
  const expected = {
    id: "lead:sample",
    section: "local_news",
    headline: "Local wire headline",
    source: "PR Newswire",
    body: ["Summary paragraph."],
  };
  const opened = {
    ...expected,
    headline:
      "The rare alga behind South Australia’s deadly bloom may be the most toxic ever tested",
    section: "science",
  };
  const failure = validateArticleHandoff({ expected, opened });
  assert.ok(failure);
  assert.equal(failure!.code, "headline_mismatch");
});

test("isWireNewsSection includes local news desks", () => {
  assert.equal(isWireNewsSection("local_news"), true);
  assert.equal(isWireNewsSection("lead"), true);
  assert.equal(isWireNewsSection("story_of"), false);
});

test("openKindredArticle validates handoff before navigation", () => {
  const source = readFileSync(path.join(__dirname, "./openArticle.ts"), "utf8");
  assert.match(source, /validateArticleHandoff/);
  assert.match(source, /logArticleIntegrityFailure/);
});

test("article route refuses mismatched route id", () => {
  const source = readFileSync(
    path.join(__dirname, "../../app/article/[id].tsx"),
    "utf8"
  );
  assert.match(source, /articleMatchesRouteId/);
});
