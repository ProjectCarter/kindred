/**
 * The Story of... — editorial validation for seeding and ingest.
 * Keep in sync with .cursor/rules/kindred-story-of.mdc
 */

import {
  extractLastParagraph,
  validateUniqueConclusion,
} from "./uniqueConclusions.mjs";
import { validateLastingThought } from "./memorableWriting.mjs";

export const STORY_OF_BANNED_PHRASES = [
  "rich history",
  "vibrant community",
  "hidden gem",
  "nestled",
  "worth exploring",
  "must-see",
  "something for everyone",
  "quintessential",
  "bustling",
  "up-and-coming",
];

export const STORY_OF_MIN_PARAGRAPHS = 4;
export const STORY_OF_MAX_PARAGRAPHS = 8;

export function storyOfTitle(cityName) {
  const name = String(cityName ?? "").trim();
  return name ? `The Story of ${name}` : "";
}

export function paragraphCount(body) {
  return String(body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

export function validateStoryOfArticle(raw) {
  const required = [
    "metroKey",
    "cityName",
    "headline",
    "subtitle",
    "body",
    "image",
    "furtherReading",
  ];
  for (const key of required) {
    if (!raw[key]) throw new Error(`Missing required field: ${key}`);
  }

  const expectedHeadline = storyOfTitle(raw.cityName);
  if (raw.headline.trim() !== expectedHeadline) {
    throw new Error(
      `${raw.metroKey}: headline must be exactly "${expectedHeadline}"`
    );
  }

  const subtitle = raw.subtitle.trim();
  if (subtitle.split(/\s+/).length < 6) {
    throw new Error(`${raw.metroKey}: subtitle too short`);
  }
  if (subtitle.length > 220) {
    throw new Error(`${raw.metroKey}: subtitle too long (max 220 chars)`);
  }

  const paras = paragraphCount(raw.body);
  if (paras < STORY_OF_MIN_PARAGRAPHS) {
    throw new Error(
      `${raw.metroKey}: need ${STORY_OF_MIN_PARAGRAPHS}–${STORY_OF_MAX_PARAGRAPHS} paragraphs, found ${paras}`
    );
  }
  if (paras > STORY_OF_MAX_PARAGRAPHS) {
    throw new Error(
      `${raw.metroKey}: max ${STORY_OF_MAX_PARAGRAPHS} paragraphs, found ${paras}`
    );
  }

  const hay = `${raw.body}\n${raw.subtitle}`.toLowerCase();
  for (const phrase of STORY_OF_BANNED_PHRASES) {
    if (hay.includes(phrase)) {
      throw new Error(`${raw.metroKey}: banned phrase "${phrase}"`);
    }
  }

  const image = raw.image;
  for (const key of ["url", "caption", "credit", "sourceUrl"]) {
    if (!image?.[key]?.trim()) throw new Error(`Missing image.${key}`);
  }

  const furtherReading = raw.furtherReading;
  if (!Array.isArray(furtherReading) || furtherReading.length < 2) {
    throw new Error(`${raw.metroKey}: furtherReading needs ≥2 authoritative URLs`);
  }

  const wikiOnly = furtherReading.every((url) =>
    String(url).toLowerCase().includes("wikipedia.org")
  );
  if (wikiOnly) {
    throw new Error(
      `${raw.metroKey}: furtherReading must include primary sources beyond Wikipedia`
    );
  }

  const lastParagraph = extractLastParagraph(raw.body);
  const cityTokens = [
    raw.cityName,
    ...String(raw.subtitle ?? "")
      .split(/\s+/)
      .filter((w) => w.length > 4),
  ];
  const conclusion = validateUniqueConclusion(lastParagraph, {
    subjectTokens: cityTokens,
  });
  if (!conclusion.passes) {
    throw new Error(
      `${raw.metroKey}: Legacy conclusion fails Swap Test (${conclusion.reason ?? "invalid"})`
    );
  }

  const lastingThought = validateLastingThought(raw.body, {
    subjectTokens: cityTokens,
  });
  if (!lastingThought.passes) {
    throw new Error(
      `${raw.metroKey}: fails Lasting Thought Test (${lastingThought.reason ?? "invalid"})`
    );
  }
}
