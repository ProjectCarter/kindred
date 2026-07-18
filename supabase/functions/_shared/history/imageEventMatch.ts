/**
 * Newspaper-grade Today in History image validation.
 * Selection-only gate — never changes rendering or national daily workflow.
 */

export const MIN_HISTORICAL_IMAGE_EVENT_MATCH_SCORE = 36;

export type ImageRelevanceTier =
  | "event_direct"
  | "person"
  | "location"
  | "artifact"
  | "unrelated";

const TIER_RANK: Record<ImageRelevanceTier, number> = {
  event_direct: 0,
  person: 1,
  location: 2,
  artifact: 3,
  unrelated: 4,
};

const STOP_TOKENS = new Set([
  "first",
  "person",
  "people",
  "history",
  "becomes",
  "become",
  "created",
  "established",
  "signed",
  "introduced",
  "founded",
  "opened",
  "published",
  "declared",
  "american",
  "british",
  "united",
  "states",
  "world",
  "olympic",
  "games",
  "summer",
  "winter",
  "during",
  "after",
  "before",
  "between",
  "under",
  "over",
  "into",
  "from",
  "with",
  "that",
  "this",
  "their",
  "there",
  "which",
  "other",
  "only",
  "also",
  "been",
  "were",
  "was",
  "are",
  "have",
  "has",
  "had",
  "will",
  "would",
  "could",
  "should",
  "one",
  "small",
  "step",
  "remembering",
  "worth",
  "country",
  "event",
  "day",
  "year",
  "time",
  "today",
]);

const MODERN_PHOTO_SIGNAL =
  /\b(20\d{2}|sports festival|selfie|smartphone|social media|instagram|tiktok|modern photograph|recent photo|current photo|photo call|red carpet|press conference today|celebrity)\b/i;

const ARTIFACT_SIGNAL =
  /\b(document|manuscript|letter|newspaper|map|aircraft|airplane|ship|equipment|artifact|patent|blueprint|building|monument|memorial|train|locomotive|uniform|flag|engraving|photograph from \d{4})\b/i;

const LOCATION_SIGNAL =
  /\b(city|harbor|harbour|island|bay|river|mountain|park|district|street|avenue|plaza|square|county|state|province|region|coast|port|station|field|camp)\b/i;

const PERSON_SIGNAL =
  /\b(born|died|president|senator|general|captain|inventor|scientist|author|composer|athlete|pilot|astronaut|brothers|sister|king|queen|emperor|mr\.|mrs\.|dr\.)\b/i;

export type ImageEventMatchInput = {
  eventYear: number;
  eventText: string;
  /** Newspaper headline when available; falls back to event-derived title. */
  articleTitle?: string | null;
  articleSubtitle?: string | null;
  /** First paragraph or event summary used during selection. */
  articleBody?: string | null;
  image: {
    caption?: string | null;
    credit?: string | null;
    sourcePageUrl?: string | null;
    url?: string | null;
    altText?: string | null;
    categories?: string[] | null;
    assetKind?: string | null;
  };
  pageTitle?: string | null;
};

export type ImageEditorialEvaluation = {
  score: number;
  tier: ImageRelevanceTier;
  matchedEntityCount: number;
  subjectDiscussedInArticle: boolean;
  historicalConsistency: boolean;
  passes: boolean;
};

function decodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function filenameFromUrl(url: string | null | undefined): string {
  if (!url?.trim()) return "";
  const path = url.split("/").pop() ?? "";
  return decodeUri(path.replace(/\.(jpg|jpeg|png|gif|webp)$/i, ""));
}

/** Subject line from the event — mirrors buildOnThisDaySearchQuery trimming. */
export function extractEventMatchTokens(eventText: string): string[] {
  const withoutParens = eventText.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const colonIdx = withoutParens.indexOf(":");
  let subject =
    colonIdx >= 0 ? withoutParens.slice(colonIdx + 1).trim() : withoutParens;
  subject = subject
    .replace(/^(Born|Died|Founded|Published|Released|Opened)\s+/i, "")
    .trim();
  const firstClause = subject.split(/[.;—–]/)[0]?.trim() ?? subject;

  return [
    ...new Set(
      firstClause
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 4 && !STOP_TOKENS.has(token))
    ),
  ];
}

export function buildArticleCorpus(input: ImageEventMatchInput): string {
  const title =
    input.articleTitle?.trim() ||
    `${input.eventYear} — ${extractEventMatchTokens(input.eventText).slice(0, 4).join(" ")}`;
  const subtitle = input.articleSubtitle?.trim() ?? "";
  const body =
    input.articleBody?.trim() ||
    input.eventText.trim();

  return [title, subtitle, body, input.eventText]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function extractNamedEntities(text: string): string[] {
  const normalized = text.toLowerCase().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const entities = new Set<string>();

  for (const token of normalized.split(/[^a-z0-9]+/)) {
    if (token.length >= 4 && !STOP_TOKENS.has(token)) entities.add(token);
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  for (let size = 2; size <= 4; size += 1) {
    for (let i = 0; i <= words.length - size; i += 1) {
      const phrase = words.slice(i, i + size).join(" ");
      if (phrase.length >= 8 && !phrase.split(" ").every((w) => STOP_TOKENS.has(w))) {
        entities.add(phrase);
      }
    }
  }

  return [...entities];
}

function significantTokens(text: string): string[] {
  return extractNamedEntities(text).filter((entity) => !entity.includes(" "));
}

export function buildImageMetadataBlob(input: ImageEventMatchInput): string {
  const url = input.image.url?.trim() ?? "";
  return [
    input.image.caption,
    input.image.altText,
    input.image.credit,
    input.image.sourcePageUrl,
    input.pageTitle,
    ...(input.image.categories ?? []),
    url ? decodeUri(url) : null,
    filenameFromUrl(url),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/_/g, " ");
}

export function extractImageEntities(input: ImageEventMatchInput): string[] {
  const blob = buildImageMetadataBlob(input);
  const fromBlob = extractNamedEntities(blob);
  const fromTitle = input.pageTitle
    ? extractNamedEntities(input.pageTitle.replace(/_/g, " "))
    : [];
  return [...new Set([...fromTitle, ...fromBlob])];
}

function countEntityMatches(
  articleCorpus: string,
  imageBlob: string
): number {
  const articleEntities = extractNamedEntities(articleCorpus);
  const imageEntities = extractNamedEntities(imageBlob);
  let matches = 0;
  const seen = new Set<string>();

  for (const imageEntity of imageEntities) {
    if (imageEntity.length < 4 || seen.has(imageEntity)) continue;

    if (articleCorpus.includes(imageEntity)) {
      matches += 1;
      seen.add(imageEntity);
      continue;
    }

    if (!imageEntity.includes(" ")) continue;
    const parts = imageEntity.split(" ").filter((part) => part.length >= 4);
    if (parts.length >= 2 && parts.every((part) => articleCorpus.includes(part))) {
      matches += 1;
      seen.add(imageEntity);
    }
  }

  if (matches > 0) return matches;

  const imageTokens = significantTokens(imageBlob);
  for (const token of imageTokens) {
    if (seen.has(token)) continue;
    if (articleCorpus.includes(token) && articleEntities.includes(token)) {
      matches += 1;
      seen.add(token);
    }
  }

  return matches;
}

function imagePrimarySubject(input: ImageEventMatchInput): string {
  const title = input.pageTitle?.replace(/_/g, " ").trim();
  if (title) return title.toLowerCase();
  return (input.image.caption ?? "").trim().toLowerCase();
}

/** Primary image subject must be discussed in headline, subtitle, or opener. */
export function imageSubjectDiscussedInArticle(input: ImageEventMatchInput): boolean {
  const corpus = buildArticleCorpus(input);
  const blob = buildImageMetadataBlob(input);
  if (countEntityMatches(corpus, blob) >= 1) return true;

  const subject = imagePrimarySubject(input);
  if (!subject || subject.length < 4) return false;

  if (corpus.includes(subject)) return true;

  const subjectTokens = subject
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOP_TOKENS.has(token));
  if (subjectTokens.length === 0) return false;

  const matched = subjectTokens.filter((token) => corpus.includes(token));
  const eventTokens = extractEventMatchTokens(input.eventText);
  if (matched.some((token) => eventTokens.includes(token))) return true;

  if (subjectTokens.length >= 2) {
    return matched.length >= Math.min(2, subjectTokens.length);
  }
  return matched.length >= 1;
}

function yearsInText(text: string): number[] {
  return [...text.matchAll(/\b(1[5-9]\d{2}|20\d{2})\b/g)]
    .map((match) => Number.parseInt(match[1]!, 10))
    .filter((year) => Number.isFinite(year));
}

/** Penalize modern photos for early events unless the article is about that modern subject. */
export function passesHistoricalConsistency(input: ImageEventMatchInput): boolean {
  const corpus = buildArticleCorpus(input);
  const blob = buildImageMetadataBlob(input);
  const subject = imagePrimarySubject(input);

  const imageYears = yearsInText(blob);
  const eventYear = input.eventYear;

  const articleAboutImageSubject =
    Boolean(subject) &&
    (corpus.includes(subject) ||
      extractImageEntities(input).some((entity) => corpus.includes(entity)));

  for (const imageYear of imageYears) {
    const gap = Math.abs(imageYear - eventYear);
    if (gap > 40 && !articleAboutImageSubject) return false;
    if (eventYear < 1930 && imageYear >= 1950 && !articleAboutImageSubject) return false;
  }

  if (eventYear < 1950 && MODERN_PHOTO_SIGNAL.test(blob) && !articleAboutImageSubject) {
    return false;
  }

  return true;
}

export function classifyImageRelevanceTier(input: ImageEventMatchInput): ImageRelevanceTier {
  const corpus = buildArticleCorpus(input);
  const blob = buildImageMetadataBlob(input);
  const matchedEntityCount = countEntityMatches(corpus, blob);
  const eventTokens = extractEventMatchTokens(input.eventText);
  const matchedEventTokens = eventTokens.filter((token) => blob.includes(token)).length;

  if (matchedEntityCount >= 2 && matchedEventTokens >= 2 && blob.includes(String(input.eventYear))) {
    return "event_direct";
  }
  if (matchedEntityCount >= 2 && matchedEventTokens >= 1) {
    return "event_direct";
  }

  const subject = imagePrimarySubject(input);
  if (
    matchedEntityCount >= 1 &&
    (PERSON_SIGNAL.test(blob) || PERSON_SIGNAL.test(subject)) &&
    imageSubjectDiscussedInArticle(input)
  ) {
    return "person";
  }

  if (matchedEntityCount >= 1 && LOCATION_SIGNAL.test(blob)) {
    return "location";
  }

  if (
    matchedEntityCount >= 1 &&
    (ARTIFACT_SIGNAL.test(blob) ||
      /map|document|photograph|painting|engraving|artifact|aircraft|ship|building/i.test(
        input.image.assetKind ?? ""
      ))
  ) {
    return "artifact";
  }

  if (matchedEntityCount >= 1 && imageSubjectDiscussedInArticle(input)) {
    return "artifact";
  }

  return "unrelated";
}

export function imageRelevanceTierRank(tier: ImageRelevanceTier): number {
  return TIER_RANK[tier];
}

/** Higher = stronger newspaper-grade confidence. */
export function scoreImageEventMatch(input: ImageEventMatchInput): number {
  const corpus = buildArticleCorpus(input);
  const blob = buildImageMetadataBlob(input);
  if (!blob.trim()) return 0;

  const matchedEntityCount = countEntityMatches(corpus, blob);
  const eventTokens = extractEventMatchTokens(input.eventText);

  let score = 0;
  let matchedTokens = 0;

  for (const token of eventTokens.slice(0, 8)) {
    if (blob.includes(token)) {
      score += 10;
      matchedTokens += 1;
    }
  }

  score += Math.min(matchedEntityCount, 6) * 14;

  if (blob.includes(String(input.eventYear))) score += 16;

  const tier = classifyImageRelevanceTier(input);
  score += (4 - imageRelevanceTierRank(tier)) * 8;

  if (
    matchedEntityCount >= 1 &&
    matchedTokens >= 1 &&
    (tier === "artifact" || tier === "person")
  ) {
    score += 10;
  }

  const imageYears = yearsInText(blob);
  for (const imageYear of imageYears) {
    const gap = Math.abs(imageYear - input.eventYear);
    if (gap > 25) score -= Math.min(45, 10 + Math.floor(gap / 5));
  }

  if (input.eventYear < 1950 && MODERN_PHOTO_SIGNAL.test(blob)) score -= 50;

  if (!imageSubjectDiscussedInArticle(input)) score -= 40;
  if (!passesHistoricalConsistency(input)) score -= 60;
  if (matchedEntityCount === 0) score = Math.min(score, 10);
  if (matchedTokens === 0 && matchedEntityCount === 0) score = Math.min(score, 5);
  if (tier === "unrelated") score = Math.min(score, 12);

  return score;
}

export function evaluateHistoricalImageEditorial(
  input: ImageEventMatchInput
): ImageEditorialEvaluation {
  const score = scoreImageEventMatch(input);
  const tier = classifyImageRelevanceTier(input);
  const matchedEntityCount = countEntityMatches(
    buildArticleCorpus(input),
    buildImageMetadataBlob(input)
  );
  const subjectDiscussedInArticle = imageSubjectDiscussedInArticle(input);
  const historicalConsistency = passesHistoricalConsistency(input);

  const passes =
    score >= MIN_HISTORICAL_IMAGE_EVENT_MATCH_SCORE &&
    tier !== "unrelated" &&
    subjectDiscussedInArticle &&
    historicalConsistency &&
    matchedEntityCount >= 1;

  return {
    score,
    tier,
    matchedEntityCount,
    subjectDiscussedInArticle,
    historicalConsistency,
    passes,
  };
}

export function historicalImageMatchesEvent(input: ImageEventMatchInput): boolean {
  return evaluateHistoricalImageEditorial(input).passes;
}

/** Event-first ranking helper for candidate lists. */
export function compareImageEditorialCandidates(
  a: ImageEditorialEvaluation,
  b: ImageEditorialEvaluation
): number {
  const tierDelta = imageRelevanceTierRank(a.tier) - imageRelevanceTierRank(b.tier);
  if (tierDelta !== 0) return tierDelta;
  return b.score - a.score;
}
