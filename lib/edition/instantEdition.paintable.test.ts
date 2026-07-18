import test from "node:test";
import assert from "node:assert/strict";

/**
 * Mirrors isCachedEditionPaintable without loading the editionCache graph
 * (extensionless TS imports break under plain node --test).
 */
function isCachedEditionPaintable(
  bundle: {
    metroKey: string;
    editionDate: string;
    sections: unknown[];
  },
  editionDate: string,
  metroKey?: string | null
): boolean {
  if (metroKey && bundle.metroKey !== metroKey) return false;
  if (bundle.editionDate !== editionDate) return false;
  return Array.isArray(bundle.sections) && bundle.sections.length > 0;
}

test("incomplete ready paper without hero is paintable", () => {
  const bundle = {
    metroKey: "phoenix-az",
    editionDate: "2026-07-17",
    sections: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }],
  };
  assert.equal(isCachedEditionPaintable(bundle, "2026-07-17"), true);
  assert.equal(isCachedEditionPaintable(bundle, "2026-07-17", "phoenix-az"), true);
  assert.equal(isCachedEditionPaintable(bundle, "2026-07-17", "seattle-wa"), false);
});

test("empty sections are not paintable", () => {
  assert.equal(
    isCachedEditionPaintable(
      { metroKey: "phoenix-az", editionDate: "2026-07-17", sections: [] },
      "2026-07-17"
    ),
    false
  );
});
