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
  grounding: import("./types.ts").KnowledgeLookupResult | null | undefined
): string {
  let data = `In ${onThisDay.year}: ${onThisDay.text}`;
  if (grounding?.editorialSummary) {
    data +=
      `\n\nVerified background context (Wikipedia — ${grounding.pageTitle}): ${grounding.editorialSummary}` +
      `\nAttribution: ${grounding.sourceAttribution}. ` +
      `Synthesize into original prose; do not quote long passages. ` +
      `Do not add facts beyond this context and the dated event.`;
  }
  return data;
}
