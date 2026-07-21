import { proseNearDuplicate } from "../editorialRedundancy.ts";

const YEAR_HEADLINE_RE = /^(1[0-9]{3}|20[0-9]{2})\s*[\u2014\u2013-]\s*/i;
const GENERIC_HEADLINE_RE =
  /^(today in history|on this day|this day in history|historical note)\b/i;

const HEADLINE_VERB_MAP: Record<string, string> = {
  created: "Creates",
  establishes: "Establishes",
  established: "Establishes",
  formed: "Forms",
  founded: "Founds",
  organized: "Organizes",
  opens: "Opens",
  opened: "Opens",
  signs: "Signs",
  signed: "Signs",
  ratifies: "Ratifies",
  ratified: "Ratifies",
  publishes: "Publishes",
  published: "Publishes",
  releases: "Releases",
  released: "Releases",
  launches: "Launches",
  launched: "Launches",
  adopts: "Adopts",
  adopted: "Adopts",
  annexes: "Annexes",
  annexed: "Annexes",
  declares: "Declares",
  declared: "Declares",
  abolishes: "Abolishes",
  abolished: "Abolishes",
};

export function formatTodayInHistoryHeadline(
  year: number,
  eventText: string,
  aiHeadline?: string | null
): string {
  const editorial = `${year} — ${deriveEditorialHeadlineFromEvent(eventText)}`;
  const trimmed = aiHeadline?.trim();
  if (trimmed && YEAR_HEADLINE_RE.test(trimmed) && !GENERIC_HEADLINE_RE.test(trimmed)) {
    return rejectEventEchoHeadline(
      normalizeHeadlineSpacing(
        trimmed.replace(/^(\d{4})\s*[\u2014\u2013-]\s*/i, "$1 — ")
      ),
      eventText,
      editorial
    );
  }

  if (trimmed && trimmed.length > 10 && !GENERIC_HEADLINE_RE.test(trimmed)) {
    const withoutYear = trimmed
      .replace(/^\s*(1[0-9]{3}|20[0-9]{2})\s*[\u2014\u2013:]\s*/i, "")
      .trim();
    if (withoutYear.length > 6) {
      return rejectEventEchoHeadline(
        `${year} — ${normalizeHeadlineSpacing(withoutYear)}`,
        eventText,
        editorial
      );
    }
  }

  return editorial;
}

function rejectEventEchoHeadline(
  headline: string,
  eventText: string,
  editorial: string
): string {
  const withoutYear = headline.replace(/^(\d{4})\s*[-—–]\s*/i, "").trim();
  const normalizedEvent = eventText.replace(/\s+/g, " ").trim();
  if (
    proseNearDuplicate(withoutYear, normalizedEvent) ||
    proseNearDuplicate(headline, normalizedEvent) ||
    proseNearDuplicate(withoutYear.replace(/^at\s+/i, ""), normalizedEvent.replace(/^at\s+/i, ""))
  ) {
    return editorial;
  }
  return headline;
}

function normalizeHeadlineSpacing(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s*([\u2014\u2013-])\s*/g, " — ")
    .trim();
}

function normalizeEventText(text: string): string {
  return text
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/^\d{4}\s*[-—–:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function primaryEventClause(text: string): string {
  const colonIdx = text.indexOf(":");
  if (colonIdx >= 0 && colonIdx < 90) {
    const before = text.slice(0, colonIdx).trim();
    const after = text.slice(colonIdx + 1).trim();
    if (after.length >= 16 && before.split(/\s+/).length <= 8) {
      return after.replace(/[.!?]+$/, "").trim();
    }
  }

  const sentence = text.split(/[.!?](?:\s|$)/)[0]?.trim() ?? text;
  const commaParts = sentence.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length > 1) {
    const first = commaParts[0] ?? sentence;
    if (first.split(/\s+/).length >= 4) {
      return first;
    }
  }

  return sentence.replace(/[.!?]+$/, "").trim();
}

function headlineFromKnownPatterns(text: string): string | null {
  if (
    /aviation section/i.test(text) &&
    /(signal corps|u\.?\s*s\.?\s*army|military aviation|united states army)/i.test(text)
  ) {
    return "The U.S. Army Creates the Aviation Section";
  }

  if (/perfect 10|nadia com[aă]neci|first perfect score/i.test(text)) {
    return "Nadia Comăneci Records the First Perfect Ten";
  }

  if (/apollo 11|walk(?:s)? on the moon|moon landing|neil armstrong|first person to walk on the moon/i.test(text)) {
    return "Apollo 11 Lands on the Moon";
  }

  if (/wright brothers|kitty hawk|first powered flight/i.test(text)) {
    return "The Wright Brothers Make the First Powered Flight";
  }

  if (/eiffel tower/i.test(text)) {
    return "The Eiffel Tower Opens in Paris";
  }

  return null;
}

function activeVoiceHeadline(clause: string): string {
  const passive = clause.match(
    /^(.+?)\s+is\s+(created|established|formed|founded|organized|opened|signed|ratified|published|released|launched|adopted|annexed|declared|abolished)\b(?:\s+as|\s+by|\s+in|\s*,|\s|$)/i
  );
  if (passive) {
    const subject = polishHeadlineSubject(passive[1] ?? "");
    const verb = HEADLINE_VERB_MAP[passive[2]!.toLowerCase()] ?? "Creates";
    if (subject) {
      return `${subject} ${verb}`;
    }
  }

  const born = clause.match(/^(.+?)\s+is\s+born\b/i);
  if (born) {
    const subject = polishHeadlineSubject(born[1] ?? "");
    if (subject) return `${subject} Is Born`;
  }

  const died = clause.match(/^(.+?)\s+(?:dies|died|is killed|was killed)\b/i);
  if (died) {
    const subject = polishHeadlineSubject(died[1] ?? "");
    if (subject) return `${subject} Dies`;
  }

  return polishHeadlineSubject(clause);
}

function polishHeadlineSubject(text: string): string {
  let subject = text
    .replace(/^(Born|Died|Founded|Published|Released|Opened|Signed|Ratified)\s+/i, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*which\b[\s\S]*$/i, "")
    .replace(/,\s*that\b[\s\S]*$/i, "")
    .replace(/\s+as the\b[\s\S]*$/i, "")
    .replace(/\s+for the\b[\s\S]*$/i, "")
    .replace(/\s+in the\b[\s\S]*$/i, "")
    .replace(/\s+of the United States(?: Army)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  subject = subject.replace(/\bU\.?\s*S\.?\b/g, "U.S.");
  subject = subject.replace(/\bUnited States\b/g, "U.S.");

  if (!subject) return "";
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

function softenLongHeadline(headline: string): string {
  let next = headline
    .replace(/,\s*U\.S\. Signal Corps$/i, "")
    .replace(/,\s*the flying service of the U\.S\. Army$/i, "")
    .replace(/\s+as the country(?:'s|’s) first\b[\s\S]*$/i, "")
    .replace(/\s+which\b[\s\S]*$/i, "")
    .replace(/\s+that\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = next.split(/\s+/).filter(Boolean);
  if (words.length > 12) {
    const commaClause = next.split(",")[0]?.trim();
    if (commaClause && commaClause.split(/\s+/).length >= 4) {
      next = commaClause;
    }
  }

  return next;
}

export function deriveEditorialHeadlineFromEvent(text: string): string {
  const normalized = normalizeEventText(text);
  if (!normalized) return "A Day Worth Remembering";

  const patterned = headlineFromKnownPatterns(normalized);
  if (patterned) return patterned;

  const clause = primaryEventClause(normalized);
  const headline = softenLongHeadline(activeVoiceHeadline(clause));

  if (headline.split(/\s+/).filter(Boolean).length >= 4) {
    return headline;
  }

  const fallback = softenLongHeadline(polishHeadlineSubject(clause));
  return fallback || "A Day Worth Remembering";
}

function protectAbbreviations(text: string): string {
  return text
    .replace(/\bU\.S\./g, "<<US>>")
    .replace(/\bU\.K\./g, "<<UK>>")
    .replace(/\bD\.C\./g, "<<DC>>");
}

function restoreAbbreviations(text: string): string {
  return text
    .replace(/<<US>>/g, "U.S.")
    .replace(/<<UK>>/g, "U.K.")
    .replace(/<<DC>>/g, "D.C.");
}

function eventTextFromHistoryBody(body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  const protectedBody = protectAbbreviations(cleaned);
  const afterYear =
    protectedBody.match(/\bIn\s+(?:1[0-9]{3}|20[0-9]{2}),\s*([\s\S]+)/i)?.[1]?.trim() ?? "";
  const firstSentence =
    afterYear.split(/\.\s+/)[0]?.replace(/[.!?]+$/, "").trim() ?? afterYear.trim();
  const restored = restoreAbbreviations(firstSentence);
  if (restored.length >= 12) return restored;

  const fallback = protectedBody.split(/\.\s+/)[0]?.trim() ?? "";
  return restoreAbbreviations(
    fallback.replace(/^\s*In\s+(?:1[0-9]{3}|20[0-9]{2}),?\s*/i, "").trim()
  );
}

function storedHeadlineLooksBroken(headline: string): boolean {
  const titlePart = headline.replace(/^(1[0-9]{3}|20[0-9]{2})\s*[\u2014\u2013-]\s*/i, "").trim();
  if (!titlePart) return true;
  if (headline.includes("...")) return true;
  if (titlePart.length <= 3) return true;
  if (/^The [A-Z]$/.test(titlePart)) return true;
  if (/^A Day Worth Remembering$/i.test(titlePart)) return true;
  return titlePart.split(/\s+/).filter(Boolean).length < 4;
}

/** Presentation-only polish for stored section headlines — does not mutate edition data. */
export function resolveTodayInHistoryDisplayHeadline(section: {
  headline: string;
  body: string;
}): string {
  const headline = section.headline?.trim() ?? "";
  const yearMatch = headline.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const eventText = eventTextFromHistoryBody(section.body);

  if (year && eventText && headlineRepeatsEvent(headline, eventText)) {
    return formatTodayInHistoryHeadline(year, eventText, null);
  }

  if (!storedHeadlineLooksBroken(headline)) return headline;
  if (!year || !eventText) return headline;

  return formatTodayInHistoryHeadline(year, eventText);
}

function headlineRepeatsEvent(headline: string, eventText: string): boolean {
  const withoutYear = headline.replace(/^(\d{4})\s*[\u2014\u2013-]\s*/i, "").trim();
  return (
    proseNearDuplicate(withoutYear, eventText) ||
    proseNearDuplicate(headline, eventText)
  );
}
