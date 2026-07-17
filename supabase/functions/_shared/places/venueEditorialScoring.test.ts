import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scoreVenueEditorialRecord } from "./venueEditorialScoring.ts";

Deno.test("scoreVenueEditorialRecord skips patch when editorial_lock is true", () => {
  const { patch } = scoreVenueEditorialRecord({
    row: {
      name: "Locked Venue",
      lifecycle: "verified",
      verification_status: "verified",
      confidence_score: 85,
      editorial_lock: true,
      editorial_score_override: 92,
      editorial_labels_override: ["editors_pick"],
      editorial_reason_override: "Desk override",
      editorial_score: 92,
    },
    now: "2026-07-17T00:00:00Z",
    force: true,
  });
  assertEquals(patch, null);
});

Deno.test("scoreVenueEditorialRecord produces patch on first score", () => {
  const { patch } = scoreVenueEditorialRecord({
    row: {
      name: "New Local Bakery",
      lifecycle: "verified",
      verification_status: "verified",
      confidence_score: 80,
      provider_categories: ["Bakery"],
      editorial_score: 0,
    },
    now: "2026-07-17T00:00:00Z",
    force: true,
  });
  assertEquals(typeof patch?.editorial_score, "number");
  assertEquals(patch!.editorial_score > 0, true);
});

Deno.test("scoreVenueEditorialRecord skips when material fingerprint unchanged", () => {
  const first = scoreVenueEditorialRecord({
    row: {
      name: "Stable Cafe",
      lifecycle: "verified",
      verification_status: "verified",
      confidence_score: 80,
      provider_categories: ["Coffee Shop"],
      editorial_score: 0,
    },
    now: "2026-07-17T00:00:00Z",
    force: true,
  });
  const second = scoreVenueEditorialRecord({
    row: {
      name: "Stable Cafe",
      lifecycle: "verified",
      verification_status: "verified",
      confidence_score: 80,
      provider_categories: ["Coffee Shop"],
      editorial_score: first.patch!.editorial_score,
    },
    now: "2026-07-17T01:00:00Z",
    previousFingerprint: first.patch!.editorial_score_material_fingerprint,
  });
  assertEquals(second.patch, null);
});
