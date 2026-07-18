/**
 * Client-side Today in History upgrade — replaces stale edition_sections copy
 * with a curated feature when the stored edition predates the new pipeline.
 */

import type { EditionSection } from "../types";
import type { HistoricalImageAsset } from "../knowledgeGrounding";
import type { KnowledgeLookupResult } from "../knowledge";
import { fetchOnThisDayCandidates } from "./onThisDay";
import { rankOnThisDayCandidates } from "./scoreCandidate";
import { composeTodayInHistoryFeature } from "./composeFeature";
import { resolveHistoricalImageFromCandidate, bestWikiPageTitle } from "./resolveImage";

const WIKI_SUMMARY =
  "https://en.wikipedia.org/api/rest_v1/page/summary/";
const USER_AGENT =
  "Kindred/1.0 (https://kindred.app; editorial-knowledge-engine)";

async function fetchWikipediaSummary(
  title: string
): Promise<KnowledgeLookupResult | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  try {
    const [summaryRes, extractRes] = await Promise.all([
      fetch(`${WIKI_SUMMARY}${encoded}`, {
        headers: { "User-Agent": USER_AGENT },
      }),
      fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encoded}`,
        { headers: { "User-Agent": USER_AGENT } }
      ),
    ]);

    if (!summaryRes.ok) return null;
    const data = (await summaryRes.json()) as {
      title?: string;
      extract?: string;
      description?: string;
      content_urls?: { desktop?: { page?: string } };
      pageid?: number;
      thumbnail?: { source?: string; width?: number; height?: number };
    };

    let extract = (data.extract ?? data.description ?? "").trim();
    if (extractRes.ok) {
      const longData = (await extractRes.json()) as {
        query?: { pages?: Record<string, { extract?: string }> };
      };
      const longExtract = Object.values(longData.query?.pages ?? {})
        .map((p) => p.extract?.trim())
        .find(Boolean);
      if (longExtract && longExtract.length > extract.length) {
        extract = longExtract.slice(0, 2800);
      }
    }

    if (!extract) return null;

    return {
      provider: "wikipedia",
      pageTitle: data.title ?? title,
      canonicalUrl: data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`,
      editorialSummary: extract,
      extract,
      pageId: data.pageid ?? 0,
      language: "en",
      thumbnail: data.thumbnail?.source
        ? {
            url: data.thumbnail.source,
            width: data.thumbnail.width,
            height: data.thumbnail.height,
          }
        : null,
      sourceAttribution: "Wikipedia contributors",
      retrievedAt: new Date().toISOString(),
      confidence: 0.82,
    };
  } catch {
    return null;
  }
}

export type TodayInHistoryUpgradeResult = {
  ok: boolean;
  section?: EditionSection;
  image?: HistoricalImageAsset | null;
  onThisDay?: KnowledgeLookupResult | null;
  year?: number;
  eventText?: string;
  error?: string | null;
};

function pickBestPageExtract(candidate: import("./onThisDay").OnThisDayCandidate): string | null {
  const pageTitle = bestWikiPageTitle(candidate);
  const page = candidate.pages?.find((p) => p.title === pageTitle);
  return page?.extract?.trim() || null;
}

export async function upgradeTodayInHistoryClient(
  editionDate: string,
  existingSection: EditionSection
): Promise<TodayInHistoryUpgradeResult> {
  const candidates = await fetchOnThisDayCandidates(editionDate);
  if (!candidates.length) {
    return { ok: false, error: "no_candidates" };
  }

  const ranked = rankOnThisDayCandidates(candidates);
  const minScore = 34;

  let selected = ranked.find(
    (c) => c.editorialScore >= minScore && resolveHistoricalImageFromCandidate(c)
  );

  if (!selected) {
    selected = ranked.find((c) => resolveHistoricalImageFromCandidate(c));
  }

  if (!selected) {
    return { ok: false, error: "no_visual" };
  }

  const image = resolveHistoricalImageFromCandidate(selected);
  if (!image?.url) {
    return { ok: false, error: "no_image" };
  }

  const pageTitle = bestWikiPageTitle(selected);

  const wiki = pageTitle ? await fetchWikipediaSummary(pageTitle) : null;

  const composed = composeTodayInHistoryFeature({
    year: selected.year,
    eventText: selected.text,
    wikipediaSummary:
      wiki?.editorialSummary ??
      pickBestPageExtract(selected) ??
      null,
    pageTitle: wiki?.pageTitle ?? pageTitle,
  });

  const section: EditionSection = {
    ...existingSection,
    headline: composed.headline,
    body: composed.body,
    source_note: "Sourced from Wikipedia",
  };

  if (__DEV__) {
    console.log("[history:upgrade] client feature composed", {
      year: selected.year,
      headline: composed.headline,
      wordCount: composed.body.split(/\s+/).filter(Boolean).length,
      image: image.url.slice(0, 80),
      editorialScore: selected.editorialScore,
    });
  }

  return {
    ok: true,
    section,
    image,
    onThisDay: wiki,
    year: selected.year,
    eventText: selected.text,
  };
}
