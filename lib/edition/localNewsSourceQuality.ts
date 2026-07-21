/**
 * Local News candidate source richness — prefer verifiable wire substance
 * over title-only filler before Story Editor runs.
 */

export type LocalNewsWireCandidate = {
  title: string;
  description?: string | null;
  source?: string | null;
  category?: string | null;
  publishedAt?: string | null;
};

const EVERGREEN_FILLER =
  /\b(jersey number|jersey history|uniform history|all-?time roster|greatest players|top \d+ moments|throwback thursday|on this day in|look back at|career retrospective|ranking the best|who wore number|retired numbers?\b)/i;

const TITLE_ONLY_SPORTS_FILLER =
  /\b(signs? (?:with|to)|re-?signs?|waived|claimed off waivers|placed on (?:ir|injured reserve)|activated from|optioned|designated for assignment)\b/i;

function normalizeProseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isNearDuplicateProse(a: string, b: string): boolean {
  const left = normalizeProseKey(a);
  const right = normalizeProseKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length < 24) {
    return longer.includes(shorter);
  }
  const sigA = shorter.slice(0, Math.min(80, shorter.length));
  const sigB = longer.slice(0, Math.min(80, longer.length));
  return (
    longer.includes(sigA) ||
    shorter.includes(sigB) ||
    sigA === sigB
  );
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function localNewsSourceText(candidate: LocalNewsWireCandidate): string {
  const description = candidate.description?.trim() ?? "";
  const title = candidate.title?.trim() ?? "";
  if (description && !isNearDuplicateProse(description, title)) {
    return description;
  }
  return description || title;
}

export function hasUsefulDescription(candidate: LocalNewsWireCandidate): boolean {
  const description = candidate.description?.trim() ?? "";
  const title = candidate.title?.trim() ?? "";
  if (!description) return false;
  if (isNearDuplicateProse(description, title)) return false;
  return wordCount(description) >= 12;
}

export function isTitleOnlyCandidate(candidate: LocalNewsWireCandidate): boolean {
  const sourceText = localNewsSourceText(candidate);
  const title = candidate.title?.trim() ?? "";
  if (!title) return true;
  if (!hasUsefulDescription(candidate)) {
    return wordCount(sourceText) < 12 || isNearDuplicateProse(sourceText, title);
  }
  return false;
}

export function isEvergreenLocalNewsFiller(candidate: LocalNewsWireCandidate): boolean {
  const hay = `${candidate.title} ${candidate.description ?? ""}`;
  return EVERGREEN_FILLER.test(hay);
}

export function scoreLocalNewsSourceRichness(candidate: LocalNewsWireCandidate): {
  score: number;
  titleOnly: boolean;
  evergreenFiller: boolean;
  sourceWords: number;
} {
  const sourceText = localNewsSourceText(candidate);
  const sourceWords = wordCount(sourceText);
  const titleOnly = isTitleOnlyCandidate(candidate);
  const evergreenFiller = isEvergreenLocalNewsFiller(candidate);

  let score = 0;
  if (hasUsefulDescription(candidate)) score += 28;
  if (sourceWords >= 40) score += 18;
  else if (sourceWords >= 20) score += 10;
  else if (sourceWords >= 12) score += 4;

  if (titleOnly) score -= 40;
  if (evergreenFiller) score -= 24;

  if (
    titleOnly &&
    TITLE_ONLY_SPORTS_FILLER.test(`${candidate.title} ${candidate.description ?? ""}`)
  ) {
    score -= 12;
  }

  return { score, titleOnly, evergreenFiller, sourceWords };
}

export function isPublishableLocalNewsCandidate(
  candidate: LocalNewsWireCandidate
): boolean {
  if (isEvergreenLocalNewsFiller(candidate)) return false;
  if (isTitleOnlyCandidate(candidate)) return false;
  return scoreLocalNewsSourceRichness(candidate).sourceWords >= 12;
}

export function isDistinctLocalNewsArticleShape(input: {
  headline: string;
  dek?: string | null;
  body: string[];
}): boolean {
  const headline = input.headline.trim();
  const dek = input.dek?.trim() ?? "";
  const body = input.body.map((p) => p.trim()).filter(Boolean);
  if (!headline || !body.length) return false;
  if (dek && isNearDuplicateProse(dek, headline)) return false;
  if (body.some((p) => isNearDuplicateProse(p, headline) && body.length === 1)) {
    return false;
  }
  if (dek && body.every((p) => isNearDuplicateProse(p, dek))) return false;
  return true;
}
