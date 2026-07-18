import test from "node:test";
import assert from "node:assert/strict";
import { resolveMasterpieceDisplayTitle } from "./displayTitle.ts";

test("神奈川沖浪裏 maps to The Great Wave off Kanagawa", () => {
  const result = resolveMasterpieceDisplayTitle("神奈川沖浪裏");
  assert.equal(result.displayTitle, "The Great Wave off Kanagawa");
  assert.equal(result.originalTitle, "神奈川沖浪裏");
});

test("モナ・リザ maps to Mona Lisa", () => {
  const result = resolveMasterpieceDisplayTitle("モナ・リザ");
  assert.equal(result.displayTitle, "Mona Lisa");
  assert.equal(result.originalTitle, "モナ・リザ");
});

test("La Joconde maps to Mona Lisa with original preserved", () => {
  const result = resolveMasterpieceDisplayTitle("La Joconde");
  assert.equal(result.displayTitle, "Mona Lisa");
  assert.equal(result.originalTitle, "La Joconde");
});

test("Las Meninas stays the common English title", () => {
  const result = resolveMasterpieceDisplayTitle("Las Meninas");
  assert.equal(result.displayTitle, "Las Meninas");
  assert.equal(result.originalTitle, null);
});

test("already-English Great Wave needs no original section", () => {
  const result = resolveMasterpieceDisplayTitle("The Great Wave off Kanagawa");
  assert.equal(result.displayTitle, "The Great Wave off Kanagawa");
  assert.equal(result.originalTitle, null);
});

test("English Starry Night passes through without an original section", () => {
  const result = resolveMasterpieceDisplayTitle("Starry Night");
  assert.equal(result.displayTitle, "Starry Night");
  assert.equal(result.originalTitle, null);
});

test("homepage title line uses English with year", () => {
  const { displayTitle } = resolveMasterpieceDisplayTitle("神奈川沖浪裏");
  assert.equal(
    `${displayTitle} (c. 1831)`,
    "The Great Wave off Kanagawa (c. 1831)"
  );
});
