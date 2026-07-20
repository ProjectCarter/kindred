import test from "node:test";
import assert from "node:assert/strict";
import {
  clearAllHomeScrollSessions,
  clearHomeScroll,
  getHomeScrollSync,
  homeScrollSessionKey,
  loadHomeScroll,
  resetHomeScrollSessionForTests,
  updateHomeScroll,
} from "./homeSession.ts";

const EDITION = "edition-2026-07-19";
const LOCATION = "home|Gilbert|AZ";

function sessionKey(): string {
  return homeScrollSessionKey(EDITION, LOCATION);
}

test.beforeEach(() => {
  resetHomeScrollSessionForTests();
});

test("homeScrollSessionKey combines edition and location", () => {
  assert.equal(
    homeScrollSessionKey("abc", "home|Seattle|WA"),
    "abc:home|Seattle|WA"
  );
});

test("navigation return: blur persist then focus load restores exact offset", async () => {
  const key = sessionKey();
  updateHomeScroll(key, 842);

  assert.equal(getHomeScrollSync(key), 842);
  assert.equal(await loadHomeScroll(key), 842);
});

test("article return uses the same in-memory session store as events", async () => {
  const key = sessionKey();
  updateHomeScroll(key, 1200);

  assert.equal(await loadHomeScroll(key), 1200);
});

test("fresh app session: cleared memory does not reuse prior offset", async () => {
  const key = sessionKey();
  updateHomeScroll(key, 1500);

  clearAllHomeScrollSessions();

  assert.equal(getHomeScrollSync(key), 0);
  assert.equal(await loadHomeScroll(key), 0);
});

test("new process simulation: reset clears prior session offset", async () => {
  updateHomeScroll(sessionKey(), 900);
  resetHomeScrollSessionForTests();

  assert.equal(await loadHomeScroll(sessionKey()), 0);
});

test("background resume: in-session memory keeps offset without rewrite", async () => {
  const key = sessionKey();
  updateHomeScroll(key, 640);

  assert.equal(getHomeScrollSync(key), 640);
  assert.equal(await loadHomeScroll(key), 640);
});

test("clearHomeScroll removes one session key", async () => {
  const key = sessionKey();
  updateHomeScroll(key, 400);
  clearHomeScroll(key);

  assert.equal(await loadHomeScroll(key), 0);
});

test("updateHomeScroll ignores invalid offsets", () => {
  const key = sessionKey();
  updateHomeScroll(key, -1);
  updateHomeScroll("", 100);
  updateHomeScroll(key, Number.NaN);

  assert.equal(getHomeScrollSync(key), 0);
});
