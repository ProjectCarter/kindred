/**
 * Turn provider extracts into concise Kindred editorial summaries.
 * Never copy long Wikipedia passages verbatim.
 */

export function synthesizeEditorialSummary(
  extract: string,
  maxLen = 280
): string {
  const cleaned = extract.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned];
  let out = "";
  for (const sentence of sentences) {
    const next = (out ? `${out} ` : "") + sentence.trim();
    if (next.length > maxLen) break;
    out = next;
    if (out.length >= Math.min(maxLen, 160)) break;
  }

  if (!out) {
    out = cleaned.slice(0, maxLen);
  }
  if (out.length < cleaned.length && !/[.!?]$/.test(out)) {
    out = out.replace(/[,;:\s]+$/, "") + ".";
  }
  return out.trim();
}

export function buildOnThisDaySearchQuery(text: string): string {
  const withoutParens = text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const colonIdx = withoutParens.indexOf(":");
  let subject =
    colonIdx >= 0 ? withoutParens.slice(colonIdx + 1).trim() : withoutParens;
  subject = subject.replace(/^(Born|Died|Founded|Published|Released|Opened)\s+/i, "").trim();
  const firstClause = subject.split(/[.;—–]/)[0]?.trim() ?? subject;
  return firstClause.slice(0, 120);
}

export function buildTodayInHistoryGrounding(
  onThisDay: { year: number; text: string },
  grounding: import("./types.ts").KnowledgeLookupResult | null | undefined,
  options?: {
    image?: { caption?: string | null; credit?: string | null; source?: string | null };
    editorNotes?: string[];
  }
): string {
  let data =
    `EDITORIAL SELECTION (write about this event only — do not substitute another)\n` +
    `Date: ${onThisDay.year}\n` +
    `Selected event: ${onThisDay.text}\n`;

  if (options?.editorNotes?.length) {
    data += `Why this story was chosen: ${options.editorNotes.join(" ")}\n`;
  }

  if (options?.image?.caption?.trim()) {
    data += `Authentic historical image: ${options.image.caption.trim()}\n`;
    if (options.image.credit?.trim()) {
      data += `Image credit: ${options.image.credit.trim()}\n`;
    }
    if (options.image.source?.trim()) {
      data += `Image source: ${options.image.source.trim()}\n`;
    }
  }

  if (grounding?.editorialSummary) {
    const summary = synthesizeEditorialSummary(grounding.editorialSummary, 520);
    data +=
      `\nVerified background context (Wikipedia — ${grounding.pageTitle}):\n${summary}` +
      `\nAttribution: ${grounding.sourceAttribution}.`;
  }

  data +=
    `\n\nWRITING STANDARD: A Sunday newspaper feature — 300–700 words in 2–4 paragraphs. ` +
    `Explain what happened, why it mattered, historical context, lasting impact, and one or two ` +
    `memorable details. Synthesize original prose; do not quote long passages or invent facts ` +
    `beyond this context and the dated event.`;

  return data;
}
