import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aggregateUrlProbeStatus,
  isStructurallyValidHttpUrl,
  isValidLatitude,
  isValidLongitude,
} from "./urlValidation.ts";

Deno.test("isStructurallyValidHttpUrl accepts https URLs", () => {
  assertEquals(isStructurallyValidHttpUrl("https://example.com/a"), true);
  assertEquals(isStructurallyValidHttpUrl("not-a-url"), false);
  assertEquals(isStructurallyValidHttpUrl(""), false);
});

Deno.test("coordinate bounds validation", () => {
  assertEquals(isValidLatitude(33.3), true);
  assertEquals(isValidLatitude(91), false);
  assertEquals(isValidLongitude(-111.7), true);
  assertEquals(isValidLongitude(200), false);
});

Deno.test("aggregateUrlProbeStatus — transient warning does not fail", () => {
  const agg = aggregateUrlProbeStatus(
    [
      {
        url: "https://example.com/img.jpg",
        structurallyValid: true,
        probed: true,
        status: "WARNING",
        httpStatus: 403,
        message: "transient_head_failure",
      },
    ],
    true
  );
  assertEquals(agg.status, "WARNING");
});

Deno.test("aggregateUrlProbeStatus — malformed required URL fails", () => {
  const agg = aggregateUrlProbeStatus(
    [
      {
        url: "bad",
        structurallyValid: false,
        probed: false,
        status: "FAIL",
        httpStatus: null,
      },
    ],
    true
  );
  assertEquals(agg.status, "FAIL");
});
