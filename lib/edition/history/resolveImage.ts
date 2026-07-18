/**
 * Resolve an authentic historical image from Wikipedia page metadata.
 */

import type { HistoricalImageAsset } from "../knowledgeGrounding";
import type { OnThisDayCandidate, OnThisDayWikiPage } from "./onThisDay";
import {
  evaluateHistoricalImageEditorial,
} from "./imageEventMatch";

function subjectTokens(eventText: string): string[] {
  const withoutParens = eventText.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const colonIdx = withoutParens.indexOf(":");
  const subject =
    colonIdx >= 0 ? withoutParens.slice(colonIdx + 1).trim() : withoutParens;
  return subject
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
}

function scorePage(page: OnThisDayWikiPage, eventText: string): number {
  const title = (page.title ?? "").toLowerCase().replace(/_/g, " ");
  let score = 0;

  for (const token of subjectTokens(eventText)) {
    if (title.includes(token)) score += 12;
  }

  if (/new horizons|pluto|wright|eiffel|apollo|berlin wall/i.test(title)) score += 10;
  if (title === "nasa" || title === "solar system") score -= 6;
  if (page.originalimage?.source) score += 4;
  else if (page.thumbnail?.source) score += 2;
  if (/\.svg$/i.test(page.originalimage?.source ?? page.thumbnail?.source ?? "")) {
    score -= 8;
  }

  return score;
}

function pickBestPage(
  pages: OnThisDayWikiPage[] | undefined,
  eventText: string
): OnThisDayWikiPage | null {
  if (!pages?.length) return null;

  return [...pages]
    .sort((a, b) => scorePage(b, eventText) - scorePage(a, eventText))[0] ?? null;
}

export function resolveHistoricalImageFromCandidate(
  candidate: OnThisDayCandidate
): HistoricalImageAsset | null {
  const ranked = [...(candidate.pages ?? [])].sort(
    (a, b) => scorePage(b, candidate.text) - scorePage(a, candidate.text)
  );

  for (const page of ranked) {
    const url =
      page.originalimage?.source?.trim() || page.thumbnail?.source?.trim() || null;
    if (!url) continue;

    const title = page.displaytitle?.trim() || page.title?.trim() || candidate.text;
    const caption = `On this day in ${candidate.year}: ${title.replace(/<[^>]+>/g, "")}`;
    const draft: HistoricalImageAsset = {
      url,
      caption,
      credit: page.wiki_url
        ? `Wikimedia / Wikipedia — ${page.wiki_url}`
        : "Wikimedia / Wikipedia",
      source: "wikipedia",
      sourcePageUrl: page.wiki_url ?? url,
      assetKind: "photograph",
      matchScore: 0,
      resolvedAt: new Date().toISOString(),
    };

    const matchInput = {
      eventYear: candidate.year,
      eventText: candidate.text,
      articleBody: candidate.text,
      image: {
        caption: draft.caption,
        credit: draft.credit,
        sourcePageUrl: draft.sourcePageUrl,
        url: draft.url,
        assetKind: draft.assetKind,
      },
      pageTitle: page.title ?? page.displaytitle ?? null,
    };

    const evaluation = evaluateHistoricalImageEditorial(matchInput);
    if (!evaluation.passes) continue;

    return {
      ...draft,
      matchScore: evaluation.score,
    };
  }

  return null;
}

export function bestWikiPageTitle(candidate: OnThisDayCandidate): string | null {
  const page = pickBestPage(candidate.pages, candidate.text);
  return page?.title?.trim() || null;
}
