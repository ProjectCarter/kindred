import type { LeadStory } from "./LeadStory";
import {
  formatDiscoveryWhy,
  type RankedDiscoveryItem,
} from "./discovery";
import type { KnowledgeFacet } from "./knowledge";
import { dedupeProse } from "./contentQuality";

import type { ImageSourcePropType } from "react-native";

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
    /** Remote wire photograph. */
    uri?: string | null;
    /** Local curated editorial asset when no wire photo exists. */
    source?: ImageSourcePropType | null;
    caption?: string | null;
    credit?: string | null;
    kind?: "wire" | "editorial";
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

/**
 * Only return a pull quote when the source text contains an attributable quotation.
 * Never manufacture magazine quotes from ordinary prose.
 */
export function extractPullQuote(paragraphs: string[]): string | null {
  const blob = paragraphs.join(" ");
  const quoted =
    blob.match(/[“"]([^”"]{40,160})[”"]/) ||
    blob.match(/\u201C([^\u201D]{40,160})\u201D/);
  if (!quoted?.[1]) return null;
  const text = quoted[1].trim();
  if (text.split(/\s+/).length < 8) return null;
  return text;
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
  const deskBody =
    Array.isArray(lead.body) && lead.body.length
      ? dedupeProse(lead.body.map((p) => p.trim()).filter(Boolean))
      : [];
  const body = deskBody.length
    ? deskBody
    : dedupeProse(splitIntoParagraphs(summary));
  const pullQuote = extractPullQuote(body);
  const heroUri = lead.heroImage?.uri ?? null;
  const article: KindredArticle = {
    id: lead.id,
    section: "lead",
    headline: lead.headline,
    dek: lead.dek?.trim() || null,
    byline: formatArticleByline(lead.source ?? "Kindred"),
    source: lead.source ?? "Kindred",
    publishedAt: lead.publishedAt,
    heroImage: heroUri
      ? {
          uri: heroUri,
          caption: lead.heroImage?.alt || lead.headline,
          credit: `Photograph via ${lead.source ?? "Kindred"}`,
          kind: "wire" as const,
        }
      : null,
    body: body.length
      ? body
      : summary
        ? [summary]
        : [
            "This briefing is thin — open the original source for the full publisher report.",
          ],
    pullQuote,
    sourceUrl: lead.url,
  };
  article.estimatedReadMinutes = estimateArticleReadMinutes(article);
  return article;
}

/**
 * Adapter: Bandit's Pick → KindredArticle.
 */
export function articleFromBanditsPick(pick: {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  imageUrl?: string | null;
}): KindredArticle {
  return articleFromSectionItem({
    id: pick.id,
    section: "bandits_pick",
    headline: pick.headline,
    body: pick.summary,
    source: pick.source,
    sourceUrl: pick.url,
    publishedAt: pick.publishedAt,
    imageUrl: pick.imageUrl,
    dek: null,
  });
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
  const dek = input.dek?.trim() || null;
  let body = dedupeProse(splitIntoParagraphs(input.body));
  // Do not repeat the dek as the body.
  if (dek && body.length === 1) {
    const b = body[0].toLowerCase().replace(/\s+/g, " ");
    const d = dek.toLowerCase().replace(/\s+/g, " ");
    if (b === d || b.includes(d) || d.includes(b)) {
      body = [];
    }
  }
  if (!body.length && input.body.trim() && input.body.trim() !== dek) {
    body = [input.body.trim()];
  }
  if (!body.length) {
    body = [
      "Kindred has only a short note for this item. View the original source for the full report.",
    ];
  }
  const article: KindredArticle = {
    id: input.id,
    section: input.section,
    headline: input.headline.trim(),
    dek,
    byline: input.byline?.trim() || formatArticleByline(source),
    source,
    publishedAt: input.publishedAt ?? null,
    heroImage: input.imageUrl
      ? {
          uri: input.imageUrl,
          caption: input.imageCaption ?? input.headline,
          credit: `Photograph via ${source}`,
          kind: "wire" as const,
        }
      : null,
    body,
    pullQuote: input.pullQuote ?? extractPullQuote(body),
    sourceUrl: input.sourceUrl ?? null,
  };
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
