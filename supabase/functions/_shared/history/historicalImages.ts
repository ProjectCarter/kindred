import { buildOnThisDaySearchQuery } from "../knowledge/providers/synthesize.ts";
import type { KnowledgeLookupResult } from "../knowledge/providers/types.ts";
import { searchWikimediaCommons } from "../images/wikimedia.ts";
import type { StockSearchCandidate } from "../images/types.ts";
import type { OnThisDayWikiPage } from "./onThisDay.ts";
import type {
  HistoricalAssetKind,
  HistoricalImageAsset,
  HistoricalImageSource,
} from "./types.ts";
import {
  compareImageEditorialCandidates,
  evaluateHistoricalImageEditorial,
  historicalImageMatchesEvent,
  scoreImageEventMatch,
  type ImageEventMatchInput,
} from "./imageEventMatch.ts";

const HISTORICAL_KIND_PATTERNS: Array<{ kind: HistoricalAssetKind; pattern: RegExp }> = [
  { kind: "photograph", pattern: /\b(photograph|photo\b|daguerreotype|albumen|tintype)\b/i },
  { kind: "painting", pattern: /\b(painting|oil on canvas|watercolor|fresco|portrait)\b/i },
  { kind: "engraving", pattern: /\b(engraving|etching|woodcut|lithograph|line art)\b/i },
  { kind: "map", pattern: /\b(map\b|atlas|cartograph|chart of)\b/i },
  {
    kind: "document",
    pattern: /\b(document|manuscript|letter|newspaper|front page|proclamation|treaty|archive|patent|blueprint|currency|stamp)\b/i,
  },
  { kind: "illustration", pattern: /\b(illustration|drawing|sketch|poster|broadside|scientific illustration)\b/i },
  {
    kind: "artifact",
    pattern: /\b(artifact|artefact|relic|specimen|coin|medal|statue|monument|memorial|spacecraft|aircraft|ship|train|trophy|flag)\b/i,
  },
];

const HISTORICAL_BOOST =
  /\b(historical|history|archive|archives|circa|vintage|century|heritage|museum|library of congress|national archives|smithsonian|national park|public domain|battlefield|landmark)\b/i;

const MODERN_PENALTY =
  /\b(logo|icon|screenshot|selfie|stock photo|render|3d model|svg|diagram only|infographic)\b/i;

export function buildHistoricalImageSearchQueries(input: {
  onThisDay: { year: number; text: string };
  subject?: string | null;
}): string[] {
  const subject =
    input.subject?.trim() ||
    buildOnThisDaySearchQuery(input.onThisDay.text);
  if (!subject || subject.length < 3) return [];

  const year = String(input.onThisDay.year);
  const queries = [
    `${subject} ${year}`,
    `${subject} historical photograph`,
    `${subject} engraving`,
    `${subject} painting`,
    `${subject} illustration`,
    `${subject} map ${year}`,
    `${subject} newspaper front page`,
    `${subject} monument`,
    `${subject} statue`,
    `${subject} museum artifact`,
    `${subject} portrait`,
    `${subject} patent drawing`,
    `${subject} spacecraft`,
    `${subject} archive`,
  ];

  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 4))].slice(
    0,
    10
  );
}

export function classifyHistoricalAssetKind(text: string): HistoricalAssetKind {
  for (const { kind, pattern } of HISTORICAL_KIND_PATTERNS) {
    if (pattern.test(text)) return kind;
  }
  return "photograph";
}

export function scoreHistoricalCandidate(
  candidate: StockSearchCandidate,
  subject: string,
  year: number
): number {
  const blob = [
    candidate.altDescription,
    candidate.tags.join(" "),
    candidate.photographerName,
    candidate.sourcePageUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const subjectTokens = subject
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
  let score = 0;

  for (const token of subjectTokens.slice(0, 6)) {
    if (blob.includes(token)) score += 12;
  }

  if (blob.includes(String(year))) score += 18;
  if (HISTORICAL_BOOST.test(blob)) score += 10;
  if (MODERN_PENALTY.test(blob)) score -= 35;

  const kind = classifyHistoricalAssetKind(blob);
  if (kind === "photograph") score += 6;
  if (kind === "painting" || kind === "engraving") score += 4;
  if (kind === "map" || kind === "document") score += 3;

  if (candidate.width >= 900 && candidate.height >= 600) score += 4;
  if (/public domain|cc0|cc by/i.test(candidate.licenseShortName ?? "")) score += 3;

  return score;
}

export function formatHistoricalCredit(input: {
  source: HistoricalImageSource;
  attributionText?: string | null;
  pageTitle?: string | null;
  sourcePageUrl: string;
  assetKind: HistoricalAssetKind;
}): string {
  if (input.attributionText?.trim()) {
    return input.attributionText.trim();
  }

  const kindLabel =
    input.assetKind === "photograph"
      ? "Photograph"
      : input.assetKind === "painting"
        ? "Painting"
        : input.assetKind === "map"
          ? "Map"
          : input.assetKind === "document"
            ? "Historical document"
            : input.assetKind === "engraving"
              ? "Engraving"
              : input.assetKind === "artifact"
                ? "Artifact"
                : "Historical illustration";

  if (input.source === "wikipedia" && input.pageTitle) {
    return `${kindLabel} via Wikipedia (${input.pageTitle})`;
  }

  return `${kindLabel} — Wikimedia Commons`;
}

function candidateToAsset(
  candidate: StockSearchCandidate,
  subject: string,
  captionFallback: string,
  matchScore: number
): HistoricalImageAsset {
  const blob = [candidate.altDescription, candidate.tags.join(" ")]
    .filter(Boolean)
    .join(" ");
  const assetKind = classifyHistoricalAssetKind(blob);
  const caption =
    candidate.altDescription?.trim().slice(0, 160) ||
    `${captionFallback} — ${assetKind}`;

  return {
    url: candidate.downloadUrl,
    previewUrl: candidate.previewUrl,
    caption,
    credit:
      candidate.attributionText?.trim() ||
      formatHistoricalCredit({
        source: "wikimedia_commons",
        sourcePageUrl: candidate.sourcePageUrl,
        assetKind,
      }),
    source: "wikimedia_commons",
    sourcePageUrl: candidate.sourcePageUrl,
    assetKind,
    license: candidate.licenseShortName ?? null,
    matchScore,
    resolvedAt: new Date().toISOString(),
  };
}

function pageToAsset(
  page: OnThisDayWikiPage,
  captionFallback: string,
  matchScore: number
): HistoricalImageAsset | null {
  const url =
    page.originalimage?.source?.trim() || page.thumbnail?.source?.trim() || "";
  if (!url) return null;

  const width = page.originalimage?.width ?? page.thumbnail?.width ?? 0;
  if (width > 0 && width < 320) return null;

  const title = page.displaytitle ?? page.title ?? captionFallback;
  const assetKind = classifyHistoricalAssetKind(
    `${title} ${page.extract ?? ""}`
  );

  return {
    url,
    previewUrl: page.thumbnail?.source ?? url,
    caption: title.replace(/<[^>]+>/g, "").trim().slice(0, 160),
    credit: formatHistoricalCredit({
      source: "wikipedia",
      pageTitle: page.title ?? title,
      sourcePageUrl: page.wiki_url ?? "https://en.wikipedia.org/",
      assetKind,
    }),
    source: "wikipedia",
    sourcePageUrl: page.wiki_url ?? "https://en.wikipedia.org/",
    assetKind,
    license: null,
    matchScore,
    resolvedAt: new Date().toISOString(),
  };
}

function buildImageMatchInput(
  onThisDay: { year: number; text: string },
  image: HistoricalImageAsset,
  pageTitle?: string | null
): ImageEventMatchInput {
  return {
    eventYear: onThisDay.year,
    eventText: onThisDay.text,
    articleBody: onThisDay.text,
    image: {
      caption: image.caption,
      credit: image.credit,
      sourcePageUrl: image.sourcePageUrl,
      url: image.url,
      assetKind: image.assetKind,
    },
    pageTitle,
  };
}

function imageFromWikiPages(
  pages: OnThisDayWikiPage[] | undefined,
  onThisDay: { year: number; text: string },
  captionFallback: string
): HistoricalImageAsset | null {
  const candidates: Array<{ asset: HistoricalImageAsset; evaluation: ReturnType<typeof evaluateHistoricalImageEditorial> }> = [];

  for (const page of pages ?? []) {
    const draft = pageToAsset(page, captionFallback, 0);
    if (!draft) continue;

    const matchInput = buildImageMatchInput(
      onThisDay,
      draft,
      page.title ?? page.displaytitle ?? null
    );
    const evaluation = evaluateHistoricalImageEditorial(matchInput);
    if (!evaluation.passes) continue;

    candidates.push({
      asset: { ...draft, matchScore: evaluation.score },
      evaluation,
    });
  }

  candidates.sort((a, b) => compareImageEditorialCandidates(a.evaluation, b.evaluation));

  return candidates[0]?.asset ?? null;
}

function wikipediaThumbnailToAsset(
  grounding: KnowledgeLookupResult,
  captionFallback: string
): HistoricalImageAsset | null {
  const url = grounding.thumbnail?.url?.trim();
  if (!url) return null;

  const assetKind = classifyHistoricalAssetKind(
    `${grounding.pageTitle} ${grounding.extract.slice(0, 200)}`
  );

  return {
    url,
    previewUrl: url,
    caption: grounding.pageTitle || captionFallback,
    credit: formatHistoricalCredit({
      source: "wikipedia",
      pageTitle: grounding.pageTitle,
      sourcePageUrl: grounding.canonicalUrl,
      assetKind,
    }),
    source: "wikipedia",
    sourcePageUrl: grounding.canonicalUrl,
    assetKind,
    license: null,
    matchScore: 24,
    resolvedAt: new Date().toISOString(),
  };
}

/**
 * Resolve an authentic historical image for Today in History.
 * Searches Wikipedia page art, then Wikimedia Commons, then grounding thumbnail.
 * Never returns AI, stock, or editorial substitute imagery.
 */
export async function resolveHistoricalImageForOnThisDay(input: {
  onThisDay: { year: number; text: string };
  wikiPages?: OnThisDayWikiPage[];
  grounding?: KnowledgeLookupResult | null;
}): Promise<HistoricalImageAsset | null> {
  const subject = buildOnThisDaySearchQuery(input.onThisDay.text);
  const captionFallback = `On this day in ${input.onThisDay.year}`;

  const fromPages = imageFromWikiPages(input.wikiPages, input.onThisDay, captionFallback);
  if (fromPages) return fromPages;

  const queries = buildHistoricalImageSearchQueries({
    onThisDay: input.onThisDay,
    subject,
  });

  const seen = new Set<string>();
  let best: { candidate: StockSearchCandidate; score: number } | null = null;

  for (const query of queries) {
    const results = await searchWikimediaCommons(query, {
      orientation: "any",
      perPage: 6,
    });

    for (const candidate of results) {
      const key = candidate.downloadUrl.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const score = scoreHistoricalCandidate(
        candidate,
        subject,
        input.onThisDay.year
      );
      if (score < 8) continue;

      if (!best || score > best.score) {
        best = { candidate, score };
      }
    }

    if (best && best.score >= 24) break;
  }

  if (best) {
    const asset = candidateToAsset(best.candidate, subject, captionFallback, best.score);
    const evaluation = evaluateHistoricalImageEditorial(
      buildImageMatchInput(input.onThisDay, asset)
    );
    if (evaluation.passes) {
      return { ...asset, matchScore: evaluation.score };
    }
  }

  if (input.grounding?.thumbnail?.url) {
    const thumbnailAsset = wikipediaThumbnailToAsset(input.grounding, captionFallback);
    if (thumbnailAsset) {
      const evaluation = evaluateHistoricalImageEditorial(
        buildImageMatchInput(input.onThisDay, thumbnailAsset, input.grounding.pageTitle)
      );
      if (evaluation.passes) {
        return { ...thumbnailAsset, matchScore: evaluation.score };
      }
    }
  }

  return null;
}
