import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldDeferLoadEditionDuringGenerate } from "./devGenerateGuard.ts";

describe("post-generate loadEdition guard", () => {
  it("blocks loadEdition while generating unless afterGenerate", () => {
    assert.equal(
      shouldDeferLoadEditionDuringGenerate({
        pendingDevGenerate: false,
        generating: true,
        eventsOnly: false,
        afterGenerate: false,
      }),
      true
    );
    assert.equal(
      shouldDeferLoadEditionDuringGenerate({
        pendingDevGenerate: false,
        generating: true,
        eventsOnly: false,
        afterGenerate: true,
      }),
      false
    );
  });

  it("allows events-only patches during generate", () => {
    assert.equal(
      shouldDeferLoadEditionDuringGenerate({
        pendingDevGenerate: false,
        generating: true,
        eventsOnly: true,
        afterGenerate: false,
      }),
      false
    );
  });
});
