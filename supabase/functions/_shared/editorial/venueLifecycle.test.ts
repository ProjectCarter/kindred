import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveLifecycleAfterImport,
  lifecycleAfterMissingFromSync,
  isGuideEligibleLifecycle,
} from "./venueLifecycle.ts";

Deno.test("resolveLifecycleAfterImport promotes new venue to verified at publish threshold", () => {
  const lifecycle = resolveLifecycleAfterImport({
    current: "new",
    confidenceScore: 78,
    passesVerification: true,
    isNewDiscovery: false,
    missingFromFullSync: false,
  });
  assertEquals(lifecycle, "verified");
});

Deno.test("resolveLifecycleAfterImport marks needs_review when confidence drops", () => {
  const lifecycle = resolveLifecycleAfterImport({
    current: "verified",
    confidenceScore: 45,
    passesVerification: true,
    isNewDiscovery: false,
    missingFromFullSync: false,
  });
  assertEquals(lifecycle, "needs_review");
});

Deno.test("lifecycleAfterMissingFromSync never deletes — marks needs_review", () => {
  assertEquals(lifecycleAfterMissingFromSync("verified"), "needs_review");
  assertEquals(lifecycleAfterMissingFromSync("closed"), "closed");
});

Deno.test("isGuideEligibleLifecycle excludes new and needs_review", () => {
  assertEquals(isGuideEligibleLifecycle("verified"), true);
  assertEquals(isGuideEligibleLifecycle("new"), false);
  assertEquals(isGuideEligibleLifecycle("needs_review"), false);
});
