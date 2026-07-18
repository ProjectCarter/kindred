import { assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertUsCountryCode, NonUsMarketError } from "./usOnly.ts";
import { assertBatchMarketActionsAllowed } from "./buildMarket.ts";

Deno.test("rejects non-US country codes", () => {
  assertThrows(
    () => assertUsCountryCode("CA", "build market"),
    NonUsMarketError
  );
});

Deno.test("accepts US country code", () => {
  assertUsCountryCode("US", "build market");
});

Deno.test("batch market actions remain disabled", () => {
  assertThrows(() => assertBatchMarketActionsAllowed(), Error);
});
