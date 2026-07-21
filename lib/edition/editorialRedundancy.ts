/**
 * Editorial redundancy detector — reject articles that repeat facts or sentences.
 */

export function normalizeEditorialText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when two passages are the same idea in different wrapper copy. */
function stripArticles(text: string): string {
  return text.replace(/\b(the|a|an)\b/gu, " ").replace(/\s+/g, " ").trim();
}

function containsNearDuplicateSignature(shorter: string, longer: string): boolean {
  if (shorter.length < 20) return longer.includes(shorter);
  const sig = shorter.slice(0, Math.min(72, shorter.length));
  return longer.includes(sig);
}

export function proseNearDuplicate(a: string, b: string): boolean {
  const left = normalizeEditorialText(a);
  const right = normalizeEditorialText(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const comparePair = (one: string, two: string): boolean => {
    const shorter = one.length <= two.length ? one : two;
    const longer = one.length > two.length ? one : two;
    return containsNearDuplicateSignature(shorter, longer);
  };

  if (comparePair(left, right)) return true;
  return comparePair(stripArticles(left), stripArticles(right));
}

function splitSentences(text: string): string[] {
  return (
    text
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((part) => part.replace(/\s+/g, " ").trim())
      .filter(Boolean) ?? []
  );
}

export function detectDuplicateSentences(paragraphs: readonly string[]): string[] {
  const sentences: string[] = [];

  for (const paragraph of paragraphs) {
    sentences.push(...splitSentences(paragraph));
  }

  const duplicates: string[] = [];

  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index]!;
    const normalized = normalizeEditorialText(sentence);
    if (normalized.length < 24) continue;

    for (let prior = 0; prior < index; prior += 1) {
      if (proseNearDuplicate(sentence, sentences[prior]!)) {
        duplicates.push(sentence.slice(0, 96));
        break;
      }
    }
  }

  return duplicates;
}

export type EditorialRedundancyInput = {
  headline?: string | null;
  dek?: string | null;
  paragraphs: readonly string[];
};

export type EditorialRedundancyResult = {
  passes: boolean;
  reasons: string[];
};

/** Reject articles that restate headlines, repeat paragraphs, or reuse sentences. */
export function detectEditorialRedundancy(
  input: EditorialRedundancyInput
): EditorialRedundancyResult {
  const reasons: string[] = [];
  const headline = input.headline?.trim() ?? "";
  const dek = input.dek?.trim() ?? "";
  const paragraphs = input.paragraphs
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (headline) {
    for (let index = 0; index < paragraphs.length; index += 1) {
      if (proseNearDuplicate(paragraphs[index], headline)) {
        reasons.push(`paragraph_${index + 1}_repeats_headline`);
      }
    }
    if (dek && proseNearDuplicate(dek, headline)) {
      reasons.push("dek_repeats_headline");
    }
  }

  if (dek && paragraphs[0]) {
    const dekNorm = normalizeEditorialText(dek);
    const openNorm = normalizeEditorialText(paragraphs[0]);
    if (
      proseNearDuplicate(dek, paragraphs[0]) &&
      dekNorm.length >= openNorm.length * 0.85
    ) {
      reasons.push("dek_repeats_opening");
    }
  }

  for (let i = 0; i < paragraphs.length; i += 1) {
    for (let j = i + 1; j < paragraphs.length; j += 1) {
      if (proseNearDuplicate(paragraphs[i], paragraphs[j])) {
        reasons.push(`paragraph_${j + 1}_repeats_paragraph_${i + 1}`);
      }
    }
  }

  if (detectDuplicateSentences(paragraphs).length > 0) {
    reasons.push("duplicate_sentence");
  }

  return { passes: reasons.length === 0, reasons };
}
