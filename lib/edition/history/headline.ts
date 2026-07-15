const YEAR_HEADLINE_RE = /^(1[0-9]{3}|20[0-9]{2})\s*[\u2014\u2013-]\s*/i;
const GENERIC_HEADLINE_RE =
  /^(today in history|on this day|this day in history|historical note)\b/i;

export function formatTodayInHistoryHeadline(
  year: number,
  eventText: string,
  aiHeadline?: string | null
): string {
  const trimmed = aiHeadline?.trim();
  if (trimmed && YEAR_HEADLINE_RE.test(trimmed) && !GENERIC_HEADLINE_RE.test(trimmed)) {
    return trimmed.replace(/^(\d{4})\s*[\u2014\u2013-]\s*/i, "$1 — ");
  }

  if (trimmed && trimmed.length > 10 && !GENERIC_HEADLINE_RE.test(trimmed)) {
    const withoutYear = trimmed
      .replace(/^\s*(1[0-9]{3}|20[0-9]{2})\s*[\u2014\u2013:]\s*/i, "")
      .trim();
    if (withoutYear.length > 6) {
      return `${year} — ${withoutYear}`;
    }
  }

  return `${year} — ${deriveEditorialHeadlineFromEvent(eventText)}`;
}

function deriveEditorialHeadlineFromEvent(text: string): string {
  const withoutParens = text.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const colonIdx = withoutParens.indexOf(":");
  let subject =
    colonIdx >= 0 ? withoutParens.slice(colonIdx + 1).trim() : withoutParens;
  subject = subject
    .replace(/^(Born|Died|Founded|Published|Released|Opened|Signed|Ratified)\s+/i, "")
    .trim();

  const firstClause = subject.split(/[.;—–]/)[0]?.trim() ?? subject;
  const words = firstClause.split(/\s+/);
  if (words.length > 10) return words.slice(0, 10).join(" ");
  return firstClause || "A Day Worth Remembering";
}
