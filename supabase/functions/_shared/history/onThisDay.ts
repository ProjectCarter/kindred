/**
 * Wikipedia On This Day feed — raw candidates for editorial curation.
 * Kindred never publishes the feed verbatim; see selectStory.ts.
 */

const WIKI_ON_THIS_DAY =
  "https://en.wikipedia.org/api/rest_v1/feed/onthisday/events";
const USER_AGENT =
  "Kindred/1.0 (https://kindred.app; editorial-knowledge-engine)";

export type OnThisDayWikiPage = {
  title?: string;
  displaytitle?: string;
  extract?: string;
  wiki_url?: string;
  thumbnail?: { source?: string; width?: number; height?: number };
  originalimage?: { source?: string; width?: number; height?: number };
};

export type OnThisDayCandidate = {
  year: number;
  text: string;
  pages?: OnThisDayWikiPage[];
};

function monthDayFromEditionDate(editionDate: string): { month: string; day: string } {
  const match = editionDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return { month: match[2]!, day: match[3]! };
  }
  const now = new Date();
  return {
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
  };
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Fetch all historical events for the edition date (up to 60 unique). */
export async function fetchOnThisDayCandidates(
  editionDate: string
): Promise<OnThisDayCandidate[]> {
  const { month, day } = monthDayFromEditionDate(editionDate);
  let res: Response;
  try {
    res = await fetch(`${WIKI_ON_THIS_DAY}/${month}/${day}`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (err) {
    console.warn("[history:onThisDay] network error", err);
    return [];
  }

  const data = (await res.json()) as { events?: OnThisDayCandidate[] };
  console.log("[history:onThisDay] Wikipedia feed", {
    httpStatus: res.status,
    ok: res.ok,
    eventCount: data.events?.length ?? 0,
    editionDate,
  });

  if (!res.ok || !data.events?.length) return [];

  const seen = new Set<string>();
  const out: OnThisDayCandidate[] = [];

  for (const raw of data.events) {
    const year = Number(raw.year);
    const text = normalizeText(raw.text ?? "");
    if (!Number.isFinite(year) || year < 1000 || text.length < 24) continue;
    const key = `${year}:${text.slice(0, 80).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      year,
      text,
      pages: raw.pages,
    });
    if (out.length >= 60) break;
  }

  return out;
}
