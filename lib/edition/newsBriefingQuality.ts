/**
 * Shared editorial length gates for Local + National News briefings.
 */

export function newsBriefingWordCount(
  parts: Array<string | null | undefined>
): number {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function sourceTextWordCount(sourceText: string): number {
  return sourceText.split(/\s+/).filter(Boolean).length;
}

/** Rich wire notes can support a full Local News briefing. */
export function isRichNewsSource(sourceText: string): boolean {
  return sourceTextWordCount(sourceText) >= 80;
}

export function localNewsBriefingMinWords(sourceText: string): number {
  const words = sourceTextWordCount(sourceText);
  if (words >= 80) return 180;
  if (words >= 40) return 100;
  return 50;
}

export function nationalNewsBriefingMinWords(sourceText: string): number {
  const words = sourceTextWordCount(sourceText);
  if (words >= 80) return 120;
  if (words >= 40) return 80;
  return 40;
}

export function localNewsBriefingTargetWords(sourceText: string): string {
  if (isRichNewsSource(sourceText)) return "250–500";
  if (sourceTextWordCount(sourceText) >= 40) return "120–250";
  return "80–120";
}

export function nationalNewsBriefingTargetWords(sourceText: string): string {
  if (isRichNewsSource(sourceText)) return "180–320";
  if (sourceTextWordCount(sourceText) >= 40) return "120–200";
  return "80–120";
}

export function localNewsCombinedBriefingText(input: {
  paragraphs: string[];
  fieldAnswers?: Record<string, string | undefined> | null;
}): string {
  return [
    input.paragraphs.join("\n\n"),
    ...Object.values(input.fieldAnswers ?? {}).filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    ),
  ].join("\n\n");
}
