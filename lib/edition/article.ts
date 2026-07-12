import type { LeadStory } from "./LeadStory";
import {
  formatDiscoveryWhy,
  type RankedDiscoveryItem,
} from "./discovery";
import type { KnowledgeFacet } from "./knowledge";

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
  if (!article.body.length) {
    article.body = [article.headline];
  }
  article.estimatedReadMinutes = estimateArticleReadMinutes(article);
  return article;
}

/** Edition folio section → KindredArticle (Top Stories, History, etc.). */
export function articleFromEditionSection(section: {
  id: string;
  section_type: string;
  headline: string;
  body: string;
  source_note?: string | null;
}): KindredArticle {
  return articleFromSectionItem({
    id: section.id,
    section: section.section_type,
    headline: section.headline,
    body: section.body,
    source: section.source_note?.trim() || "Kindred",
    sourceUrl: null,
  });
}

/**
 * Sections that open the native article reader when tapped.
 * Weather / greeting / local events use their own interactions.
 */
export function sectionOpensArticleReader(sectionType: string): boolean {
  return (
    sectionType !== "weather" &&
    sectionType !== "greeting" &&
    sectionType !== "local_events"
  );
}

/** Discovery recommendation → KindredArticle (native reader, not the publisher). */
export function articleFromDiscoveryItem(
  ranked: RankedDiscoveryItem
): KindredArticle {
  const item = ranked.item;
  const why = formatDiscoveryWhy(ranked);
  const body = [item.dek?.trim(), why].filter(Boolean).join("\n\n");
  return articleFromSectionItem({
    id: item.id,
    section: "discovery",
    headline: item.title,
    body: body || item.title,
    dek: item.dek,
    source: item.source?.name ?? "Kindred",
    sourceUrl: item.url ?? item.source?.url ?? null,
  });
}

/** Knowledge / explainer facet → KindredArticle. */
export function articleFromKnowledgeFacet(
  facet: KnowledgeFacet,
  storyKey: string
): KindredArticle {
  return articleFromSectionItem({
    id: `${storyKey}:${facet.type}:${facet.title}`.slice(0, 120),
    section: "knowledge",
    headline: facet.title,
    body: facet.summary,
    source: facet.source?.name ?? "Kindred",
    sourceUrl: facet.source?.url ?? null,
  });
}

/**
 * True when Kindred only has a briefing/summary — never imply a full
 * publisher reprint when we lack authorized long-form text.
 */
export function isKindredBriefing(article: KindredArticle): boolean {
  if (
    article.section === "discovery" ||
    article.section === "knowledge" ||
    article.section === "today_in_history" ||
    article.section === "looking_ahead"
  ) {
    return true;
  }
  const words = [article.dek, ...(article.body ?? [])]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  return words < 350;
}

/** edition_sections.id is a UUID — only those can be clipped to the library. */
export function isClippableSectionId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}
