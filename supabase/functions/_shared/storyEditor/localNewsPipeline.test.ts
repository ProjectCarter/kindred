/**
 * Story Editor pipeline regression tests (Node).
 * Run: npx tsx supabase/functions/_shared/storyEditor/localNewsPipeline.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canAcceptLocalNewsThinDraft,
  isFactIntegrityIssue,
  validateStoryDraft,
} from "./validators.ts";
import {
  composeLocalNewsThinHonest,
  composeLocalNewsUnavailable,
} from "./thinFallback.ts";
import { isPublishableLocalNewsStory } from "./localNewsPublish.ts";
import type { StoryEditorIntake } from "./types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const THIN_INTAKE: StoryEditorIntake = {
  id: "story-1",
  headline: "Council approves park expansion",
  sourceText:
    "Gilbert leaders voted Tuesday to expand Freestone Park with new trails after neighbors testified.",
  source: "Local Paper",
  surfaceRole: "local_news",
};

const TITLE_ONLY_INTAKE: StoryEditorIntake = {
  id: "story-2",
  headline: "Rockets sign veteran guard Smith",
  sourceText: "Rockets sign veteran guard Smith",
  source: "Wire",
  surfaceRole: "local_news",
};

assert.equal(
  isPublishableLocalNewsStory(
    composeLocalNewsUnavailable(TITLE_ONLY_INTAKE, "title-only")
  ),
  false
);

const thinHonest = composeLocalNewsThinHonest(
  THIN_INTAKE,
  "Thin source — honest Local News briefing."
);
assert.notEqual(thinHonest.dek, thinHonest.headline);
assert.notEqual(thinHonest.paragraphs[0], thinHonest.headline);
assert.equal(isPublishableLocalNewsStory(thinHonest), true);

const unavailable = composeLocalNewsThinHonest(
  TITLE_ONLY_INTAKE,
  "Thin source — honest Local News briefing."
);
assert.equal(unavailable.desk.path, "unavailable");
assert.equal(unavailable.paragraphs.length, 0);

const acceptedThin = canAcceptLocalNewsThinDraft({
  headline: "Council approves park expansion",
  dek: "Gilbert leaders voted to expand Freestone Park after public testimony.",
  paragraphs: [
    "Gilbert leaders voted Tuesday to expand Freestone Park with new trails after neighbors testified.",
  ],
  sourceText: `${THIN_INTAKE.headline}\n${THIN_INTAKE.sourceText}`,
  scores: {
    interest: 4,
    curiosity: 4,
    flow: 4,
    human_connection: 4,
    learning: 4,
    memorability: 4,
    reader_satisfaction: 4,
  },
  voluntaryFinish: true,
  memorableInsight: "Park expansion follows months of neighborhood input.",
  fieldAnswers: {
    background:
      "Freestone Park is one of Gilbert's largest public parks and a frequent venue for community events.",
  },
  storyType: "local_government",
});
assert.equal(acceptedThin.accepted, true);
assert.equal(acceptedThin.factIssues.length, 0);

const fabricated = validateStoryDraft({
  headline: "Council approves park expansion",
  dek: "Leaders approved a $12 million expansion.",
  paragraphs: ["Leaders approved a $12 million expansion after a 7-2 vote."],
  sourceText: `${THIN_INTAKE.headline}\n${THIN_INTAKE.sourceText}`,
  scores: {
    interest: 5,
    curiosity: 5,
    flow: 5,
    human_connection: 5,
    learning: 5,
    memorability: 5,
    reader_satisfaction: 5,
  },
  voluntaryFinish: true,
  memorableInsight: "Numbers matter.",
  requirePerfectScores: false,
  surfaceRole: "local_news",
  fieldAnswers: { background: "Parks matter." },
  storyType: "local_government",
});
assert.ok(
  fabricated.some((issue) => isFactIntegrityIssue(issue.code)),
  "fabricated numbers must still fail"
);

const articleSource = readFileSync(
  join(__dirname, "../../../../lib/edition/article.ts"),
  "utf8"
);
assert.doesNotMatch(
  articleSource,
  /The verified note on this story is brief\./
);

console.log("localNewsPipeline.test.ts: ok");
