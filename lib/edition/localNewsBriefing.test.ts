/**
 * Local News briefing gates — Node smoke tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function isThinSource(sourceText: string): boolean {
  return wordCount(sourceText) < 40;
}

function isLocalNewsRole(role: string | null | undefined): boolean {
  return /local/i.test(role ?? "");
}

function localNewsSurfaceRole(
  role: string,
  placement: "lead" | "top_story"
): string {
  if (isLocalNewsRole(role)) return "local_news";
  return placement === "lead" ? "lead" : "top_story";
}

function normalizeForContainment(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.%$]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function proseNearDuplicate(a: string, b: string): boolean {
  const left = normalizeForContainment(a);
  const right = normalizeForContainment(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length < 20) return longer.includes(shorter);
  const sig = shorter.slice(0, Math.min(72, shorter.length));
  return longer.includes(sig);
}

function validateLocalNewsBriefing(input: {
  headline: string;
  paragraphs: string[];
  sourceText: string;
  storyType?: string | null;
  fieldAnswers?: Record<string, string | undefined> | null;
}): string[] {
  const issues: string[] = [];
  const open = input.paragraphs[0]?.trim() ?? "";

  if (open && proseNearDuplicate(open, input.headline)) {
    issues.push("headline_repeats_in_open");
  }
  if (isThinSource(input.sourceText) && open && proseNearDuplicate(open, input.sourceText)) {
    issues.push("wire_repeated_in_open");
  }
  if (!input.storyType?.trim()) {
    issues.push("missing_story_type");
  }
  const sections = Object.values(input.fieldAnswers ?? {}).filter(
    (v) => typeof v === "string" && v.trim().length >= 12
  );
  if (sections.length === 0) {
    issues.push("missing_context");
  }
  return issues;
}

test("local news roles map to local_news surface", () => {
  assert.equal(isLocalNewsRole("local"), true);
  assert.equal(isLocalNewsRole("national"), false);
  assert.equal(localNewsSurfaceRole("local", "lead"), "local_news");
  assert.equal(localNewsSurfaceRole("national", "lead"), "lead");
});

test("localNewsBriefing module persists classified desk metadata", () => {
  const source = readFileSync(
    path.join(
      __dirname,
      "../../supabase/functions/_shared/storyEditor/localNewsBriefing.ts"
    ),
    "utf8"
  );
  assert.match(source, /Classify the story first/);
  assert.match(source, /desk: edited\.desk/);
  assert.match(source, /selectLocalNewsDeskLead/);
});

test("quality gates reject headline repetition and missing context", () => {
  assert.deepEqual(
    validateLocalNewsBriefing({
      headline: "Council approves water bond",
      paragraphs: ["Council approves water bond after Tuesday vote."],
      sourceText: "Short wire note.",
      storyType: "local_government",
      fieldAnswers: {
        why_it_matters: "The vote clears the way for mains serving 18,000 households.",
      },
    }),
    ["headline_repeats_in_open"]
  );

  assert.deepEqual(
    validateLocalNewsBriefing({
      headline: "Council approves water bond",
      paragraphs: [
        "City council voted Tuesday to approve a $12 million bond for water infrastructure after months of debate.",
      ],
      sourceText:
        "City council voted Tuesday to approve a $12 million bond for water infrastructure after months of debate.",
      storyType: "local_government",
      fieldAnswers: {
        background:
          "City councils typically approve bond measures after public hearings and staff review.",
      },
    }),
    ["wire_repeated_in_open"]
  );

  assert.deepEqual(
    validateLocalNewsBriefing({
      headline: "Council approves water bond",
      paragraphs: [
        "After months of debate, the council approved a $12 million bond for water infrastructure.",
      ],
      sourceText:
        "City council voted Tuesday to approve a $12 million bond for water infrastructure after months of debate.",
      storyType: "local_government",
      fieldAnswers: {
        background:
          "Bond measures in Arizona require public hearings before council votes.",
        why_it_matters: "Roughly 18,000 households rely on aging mains in the north district.",
        looking_ahead: "Construction is expected to begin next spring.",
      },
    }),
    []
  );
});
