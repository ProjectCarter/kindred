/**
 * Swap Test validation for seed scripts — keep in sync with lib/edition/uniqueConclusions.ts
 */

export const GENERIC_CONCLUSION_PATTERNS = [
  /kindred keeps these anniversaries/i,
  /explains how we got here/i,
  /see you tomorrow/i,
  /i'?ll keep looking/i,
  /glad you didn'?t miss this one/i,
  /some things are only beautiful because they don'?t last/i,
  /let today'?s masterpiece slow the morning/i,
  /slow the morning by a minute/i,
  /return to it when you can — and until then/i,
  /worth stepping out for/i,
  /don'?t miss this one/i,
  /mark your calendar/i,
  /gather your friends/i,
  /show up with curiosity/i,
  /perfect way to spend/i,
  /could describe any/i,
  /history still matters\b/i,
  /connect the past with the present/i,
  /a calm minute of context before the rest of the day/i,
  /before the rest of the day pulls you forward/i,
  /more verified background may arrive in later editions/i,
];

export function extractLastParagraph(body) {
  const paragraphs = String(body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return paragraphs.at(-1) ?? "";
}

export function validateUniqueConclusion(paragraph, options = {}) {
  const trimmed = String(paragraph ?? "").trim();
  if (!trimmed) return { passes: false, reason: "empty" };

  for (const pattern of GENERIC_CONCLUSION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { passes: false, reason: "generic_pattern", pattern: pattern.source };
    }
  }

  const tokens = (options.subjectTokens ?? []).filter((t) => String(t).trim().length > 3);
  if (tokens.length) {
    const hay = trimmed.toLowerCase();
    const hasSubject = tokens.some((token) => hay.includes(String(token).toLowerCase()));
    if (!hasSubject) return { passes: false, reason: "missing_subject" };
  }

  return { passes: true };
}
