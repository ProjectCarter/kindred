import test from "node:test";
import assert from "node:assert/strict";
import {
  endingReadsLikeNewspaperWrapUp,
  validateKindredArticleProse,
} from "./kindredArticleProse.ts";

test("validateKindredArticleProse rejects AI wrap-up endings", () => {
  const result = validateKindredArticleProse({
    headline: "Council approves budget",
    dek: "The vote sets spending priorities for the year ahead.",
    body: [
      "Gilbert leaders approved the budget after a long hearing.",
      "In conclusion, this article discussed the budget vote and why it matters.",
    ],
    desk: "local_news",
    subjectTokens: ["Gilbert", "budget"],
  });

  assert.equal(result.passes, false);
  assert.ok(
    result.reasons.some(
      (r) => r.includes("summary_ending") || r.includes("generic")
    )
  );
});

test("validateKindredArticleProse accepts a clean local news briefing", () => {
  const result = validateKindredArticleProse({
    headline: "Council approves budget",
    dek: "The vote sets spending priorities for the year ahead.",
    body: [
      "Gilbert leaders approved the budget after a long hearing Tuesday night.",
      "The plan keeps parks funding steady while delaying a road project until next spring.",
      "Residents who spoke at the meeting focused on drainage repairs in older Gilbert neighborhoods this week.",
    ],
    desk: "local_news",
    subjectTokens: ["Gilbert", "budget", "Council"],
  });

  assert.equal(result.passes, true);
});

test("endingReadsLikeNewspaperWrapUp catches newspaper recap language", () => {
  assert.equal(
    endingReadsLikeNewspaperWrapUp("That wraps up tonight's vote."),
    true
  );
  assert.equal(
    endingReadsLikeNewspaperWrapUp(
      "The council will meet again when bids for the drainage work are due."
    ),
    false
  );
});
