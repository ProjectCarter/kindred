import type { LeadStory } from "./LeadStory";

/**
 * Canonical article model for Kindred’s native reader.
 * Every section (Lead, Top Stories, Business, Science, etc.)
 * should map into this shape before opening the article page.
 */
export type KindredArticle = {
  id: string;
  /** Section key for future routing analytics — e.g. lead, top_stories, sports. */
  section: string;
  headline: string;
  /** Short dek / standfirst under the headline. */
  dek?: string | null;
  byline?: string | null;
  source: string;
  publishedAt?: string | null;
  heroImage?: {
    uri: string;
    caption?: string | null;
    credit?: string | null;
  } | null;
  /** Body paragraphs for native reading. */
  body: string[];
  /** Optional pull quote — extracted or supplied by the section adapter. */
  pullQuote?: string | null;
  /** Publisher URL for “Read Original Article”. */
  sourceUrl?: string | null;
  estimatedReadMinutes?: number | null;
};

export function splitIntoParagraphs(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const byBlank = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (byBlank.length > 1) return byBlank;

  // Single block — split into sentence groups of ~2 for comfortable pacing.
  const sentences = cleaned
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [cleaned];

  if (sentences.length <= 2) return [cleaned];

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(" "));
  }
  return paragraphs;
}

export function extractPullQuote(paragraphs: string[]): string | null {
  const candidates = paragraphs
    .flatMap((p) => p.match(/[^.!?]+[.!?]+/g) ?? [p])
    .map((s) => s.trim())
    .filter((s) => s.length >= 70 && s.length <= 180);

  if (!candidates.length) return null;
  // Prefer a mid-article sentence for editorial rhythm.
  const mid = candidates[Math.floor(candidates.length / 2)] ?? candidates[0];
  return mid.replace(/^["“]|["”]$/g, "").trim();
}

export function estimateArticleReadMinutes(
  article: Pick<KindredArticle, "headline" | "dek" | "body">
): number | null {
  const text = [article.headline, article.dek, ...article.body]
    .filter(Boolean)
    .join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 40) return null;
  return Math.max(1, Math.round(words / 200));
}

export function formatArticleByline(source: string): string {
  const trimmed = source.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return "From the wires";
  return `From ${trimmed}`;
}

export function formatArticlePublishedAt(
  iso: string | null | undefined
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `Published ${time}`;

  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Published ${day}, ${time}`;
}

/**
 * Adapter: Front Page Lead Story → KindredArticle.
 * Future sections add their own adapters; the reader stays the same.
 */
export function articleFromLeadStory(lead: LeadStory): KindredArticle {
  const summary = lead.summary ?? "";
  const body = splitIntoParagraphs(summary);
  const pullQuote = extractPullQuote(body);
  const heroUri = lead.heroImage?.uri ?? null;
  const article: KindredArticle = {
    id: lead.id,
    section: "lead",
    headline: lead.headline,
    dek: null,
    byline: formatArticleByline(lead.source ?? "Kindred"),
    source: lead.source ?? "Kindred",
    publishedAt: lead.publishedAt,
    heroImage: heroUri
      ? {
          uri: heroUri,
          caption: lead.heroImage?.alt || lead.headline,
          credit: `Photograph via ${lead.source ?? "Kindred"}`,
        }
      : null,
    body: body.length ? body : summary ? [summary] : [lead.headline],
    pullQuote,
    sourceUrl: lead.url,
  };
  article.estimatedReadMinutes = estimateArticleReadMinutes(article);
  return article;
}

/**
 * Generic adapter for plain section copy (Top Stories items, etc.).
 * Call this from any future section that has headline + body text.
 */
export function articleFromSectionItem(input: {
  id: string;
  section: string;
  headline: string;
  body: string;
  source?: string | null;
  sourceUrl?: string | null;
  publishedAt?: string | null;
  imageUrl?: string | null;
  imageCaption?: string | null;
  byline?: string | null;
  dek?: string | null;
  pullQuote?: string | null;
}): KindredArticle {
  const source = input.source?.trim() || "Kindred";
  const body = splitIntoParagraphs(input.body);
  const article: KindredArticle = {
    id: input.id,
    section: input.section,
    headline: input.headline.trim(),
    dek: input.dek?.trim() || null,
    byline: input.byline?.trim() || formatArticleByline(source),
    source,
    publishedAt: input.publishedAt ?? null,
    heroImage: input.imageUrl
      ? {
          uri: input.imageUrl,
          caption: input.imageCaption ?? input.headline,
          credit: `Photograph via ${source}`,
        }
      : null,
    body: body.length ? body : [input.body.trim()].filter(Boolean),
    pullQuote: input.pullQuote ?? extractPullQuote(body),
    sourceUrl: input.sourceUrl ?? null,
  };
  article.estimatedReadMinutes = estimateArticleReadMinutes(article);
  return article;
}
