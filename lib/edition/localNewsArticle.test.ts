/**
 * Local News reader adapters — disclaimer filtering and desk mapping.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterLocalNewsBodyParagraphs,
  isLocalNewsDisclaimerParagraph,
  localNewsBriefingFooterNote,
} from "./localNewsArticleCore.ts";
import { localNewsModulesFromDesk } from "./localNewsStoryStructure.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("filters disclaimer paragraphs from local news body", () => {
  const body = filterLocalNewsBodyParagraphs([
    "City council approved the bond measure Tuesday after months of debate.",
    "The reporting available to Kindred's desk is limited.",
    "Kindred will not invent details that were not reported.",
  ]);
  assert.equal(body.length, 1);
  assert.match(body[0]!, /City council approved/);
});

test("isLocalNewsDisclaimerParagraph catches attribution boilerplate", () => {
  assert.equal(
    isLocalNewsDisclaimerParagraph("Read the original report for complete coverage."),
    true
  );
  assert.equal(
    isLocalNewsDisclaimerParagraph("Officials said work would begin next spring."),
    false
  );
});

test("classified desk modules use story-type labels", () => {
  const modules = localNewsModulesFromDesk({
    storyType: "public_safety",
    fieldAnswers: {
      verified_facts: "Police confirmed the road closure affects two downtown blocks.",
      why_it_matters: "Commuters should expect delays through the morning rush.",
      looking_ahead: "Officials expect to reopen the corridor by 6 p.m.",
    },
  });
  assert.equal(modules[0]?.label, "VERIFIED FACTS");
  assert.equal(modules[2]?.label, "WHAT RESIDENTS SHOULD KNOW");
});

test("footer attribution stays compact", () => {
  const note = localNewsBriefingFooterNote({
    desk: {
      fourQuestions: {
        limits: ["This summary reflects reporting published by AZCentral."],
      },
    },
    source: "AZCentral",
  });
  assert.match(note ?? "", /AZCentral/);
  assert.doesNotMatch(note ?? "", /does not invent details/);
  assert.doesNotMatch(note ?? "", /Kindred summary/);
});

test("localNewsArticle wires classified modules and footer through adapters", () => {
  const structure = readFileSync(
    path.join(__dirname, "./localNewsStoryStructure.ts"),
    "utf8"
  );
  const reader = readFileSync(
    path.join(__dirname, "../../components/ArticleReader.tsx"),
    "utf8"
  );
  const article = readFileSync(path.join(__dirname, "./localNewsArticle.ts"), "utf8");

  assert.match(structure, /localNewsModulesFromDesk/);
  assert.match(article, /localNewsModulesFromDeskMeta/);
  assert.match(article, /briefingFooterNote/);
  assert.match(reader, /article\.briefingFooterNote/);
  assert.match(reader, /!isLocalNewsArticle/);
});
