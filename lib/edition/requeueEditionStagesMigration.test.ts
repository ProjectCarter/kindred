import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const migration = readFileSync(
  join(root, "supabase/migrations/0060_edition_validation_requeue.sql"),
  "utf8"
);

test("requeue migration rejects initialize_edition", () => {
  assert.match(migration, /initialize_edition not allowed/);
});

test("requeue migration lists validate_technical and publish_edition", () => {
  assert.match(migration, /validate_technical/);
  assert.match(migration, /publish_edition/);
});

test("requeue migration removes only requested stages from completed_stages", () => {
  assert.match(migration, /where not \(s = any \(cleaned\)\)/);
});

test("requeue migration preserves validation history comment", () => {
  assert.match(migration, /Preserves validation history/);
});
