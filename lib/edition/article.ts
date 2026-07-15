import type { LeadStory } from "./LeadStory";
import {
  formatDiscoveryWhy,
  type DiscoveryItem,
  type RankedDiscoveryItem,
} from "./discovery";
import type { KnowledgeFacet, KnowledgePayload } from "./knowledge";
import { onThisDayImageFromKnowledge } from "./historicalImages";
import { dedupeProse, isNearDuplicateProse } from "./contentQuality";
import { getGoldStandardArticle } from "./goldStandard/algalBloomArticle";
import {
  applyContentSystem,
  type ContentType,
  type EditorialFieldAnswers,
  type EditorialModule,
} from "./contentSystem";
import type { LocalEventCard } from "./localEvents";
import type { ClippingContentType } from "./clippingTypes";
import { resolveEventEndsAt } from "./eventExpiry";
import {
  composeCategorySeedArticle,
  composeFallbackDiscoveryBody,
  composeGenericDynamicDiscoveryArticle,
  composePlaceDiscoveryArticle,
  composeVerifiedEventDiscoveryArticle,
  getCuratedDiscoveryArticle,
  matchVerifiedLocalEvent,
} from "./discoveryArticles";
import { attributionFromEditorialImage } from "./imageAttribution";
import {
  actionContextFromBanditsPick,
  actionContextFromDiscoveryItem,
  actionContextFromLocalEvent,
} from "./actionBar";
import type { ImageSourcePropType } from "react-native";

/**
 * Deterministically pick from a short list of equivalent phrasings so the
 * same template doesn't read identically across many articles in one
 * session — e.g. every local event sharing one "context" sentence.
 * Same seed always picks the same option (stable across re-renders).
 */
function pickVariant(seed: string, options: string[]): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % options.length;
  return options[index];
}

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
    kind?: "wire" | "editorial" | "historical";
  } | null;
  /**
   * Supporting figures placed naturally in the body (Phase 1 universal reader).
   * Prefer adapter-supplied photos; the reader may derive calm editorial fills.
   */
  figures?: ArticleFigure[] | null;
  /** Body paragraphs for native reading. */
  body: string[];
  /** Optional pull quote — extracted or supplied by the section adapter. */
  pullQuote?: string | null;
  /**
   * Bandit’s personal note — why this story earned a place in today’s paper.
   * Shown once near the top; never algorithmic language.
   */
  banditNote?: string | null;
  /** Publisher URL for “Read Original Article”. */
  sourceUrl?: string | null;
  estimatedReadMinutes?: number | null;
  /**
   * Universal Content System — which editorial desk template to use.
   * Resolved automatically when omitted.
   */
  contentType?: ContentType | null;
  /**
   * Magazine desk modules (atmosphere, difficulty, don’t miss, …).
   * Story first in `body`; these answer natural reader questions in prose.
   */
  modules?: EditorialModule[] | null;
  /**
   * Which Clippings bucket this belongs to, when the adapter that built
   * this article already knows (e.g. Activities vs Recommendations both
   * flow through `articleFromDiscoveryItem` and are otherwise identical).
   * Falls back to `inferClipContentType` (clippings.ts) when omitted.
   */
  savedContentType?: ClippingContentType | null;
  /** Human-readable venue/place line, for the Clippings card. */
  savedLocation?: string | null;
  /** Human-readable date/time line, for the Clippings card (events). */
  savedEventTime?: string | null;
  /** Provider-backed actions — never invented URLs. */
  actionContext?: import("./actionBar").ActionBarContext | null;
  /**
   * ISO timestamp for when this event actually ends — resolved once, at
   * adapter time, from the event's own date/time (never from when it was
   * saved). Powers Clippings' 30-day auto-expiry and "Past Event" note.
   * Null when Kindred can't confidently parse an end date/time.
   */
  savedEventEndsAt?: string | null;
};

/** Inline magazine photograph within the long-form body. */
export type ArticleFigure = {
  uri?: string | null;
  source?: ImageSourcePropType | null;
  caption?: string | null;
  credit?: string | null;
  /** Insert after this body paragraph index (0-based). */
  afterParagraph: number;
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
 * Phase 1: the Lead opens Kindred’s gold-standard science story —
 * the editorial blueprint for every future article.
 */
export function articleFromLeadStory(lead: LeadStory): KindredArticle {
  // Preserve the edition lead id so clipping / session keys stay stable.
  return getGoldStandardArticle({ id: lead.id || undefined });
}

/**
 * Adapter: Bandit's Pick → KindredArticle.
 */
export function articleFromBanditsPick(
  pick: {
    id: string;
    headline: string;
    summary: string;
    source: string;
    url: string | null;
    publishedAt: string | null;
    imageUrl?: string | null;
    discoveryItem?: DiscoveryItem | null;
  }
): KindredArticle {
  return {
    ...articleFromSectionItem({
      id: pick.id,
      section: "bandits_pick",
      headline: pick.headline,
      body: pick.summary,
      source: pick.source,
      sourceUrl: pick.url,
      publishedAt: pick.publishedAt,
      imageUrl: pick.imageUrl,
      dek: null,
    }),
    actionContext: actionContextFromBanditsPick({
      url: pick.url,
      discoveryItem: pick.discoveryItem ?? null,
    }),
  };
}

/**
 * Attach / refresh Universal Content System fields on any article.
 * Safe to call more than once — explicit contentType and modules win.
 */
export function withContentSystem(
  article: KindredArticle,
  options?: {
    discoveryCategory?: string | null;
    tags?: string[] | null;
    role?: string | null;
    answers?: EditorialFieldAnswers | null;
    seedDek?: string | null;
  }
): KindredArticle {
  if (
    article.contentType &&
    article.modules &&
    article.modules.length > 0
  ) {
    return article;
  }
  const applied = applyContentSystem({
    resolve: {
      contentType: article.contentType,
      section: article.section,
      discoveryCategory: options?.discoveryCategory,
      tags: options?.tags,
      headline: article.headline,
      role: options?.role,
    },
    answers: options?.answers,
    seedDek: options?.seedDek ?? article.dek,
  });
  return {
    ...article,
    contentType: article.contentType ?? applied.contentType,
    modules:
      article.modules && article.modules.length > 0
        ? article.modules
        : applied.modules,
  };
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
  imageCredit?: string | null;
  byline?: string | null;
  dek?: string | null;
  pullQuote?: string | null;
  contentType?: ContentType | null;
  discoveryCategory?: string | null;
  tags?: string[] | null;
  role?: string | null;
  fieldAnswers?: EditorialFieldAnswers | null;
  banditNote?: string | null;
}): KindredArticle {
  const source = input.source?.trim() || "Kindred";
  const dek = input.dek?.trim() || null;
  let body = dedupeProse(splitIntoParagraphs(input.body));
  // Never repeat the dek verbatim (or near-verbatim) as body content —
  // it already renders once as the opening summary.
  if (dek) {
    body = body.filter((p) => !isNearDuplicateProse(p, dek));
  }
  if (
    !body.length &&
    input.body.trim() &&
    !(dek && isNearDuplicateProse(input.body.trim(), dek))
  ) {
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
          credit:
            input.imageCredit?.trim() ||
            `Photograph via ${source}`,
          kind: "wire" as const,
        }
      : null,
    body,
    pullQuote: input.pullQuote ?? extractPullQuote(body),
    sourceUrl: input.sourceUrl ?? null,
    banditNote: input.banditNote?.trim() || null,
    contentType: input.contentType ?? null,
  };
  article.estimatedReadMinutes = estimateArticleReadMinutes(article);
  return withContentSystem(article, {
    discoveryCategory: input.discoveryCategory,
    tags: input.tags,
    role: input.role,
    answers: input.fieldAnswers,
    seedDek: dek,
  });
}

/** Edition folio section → KindredArticle (Top Stories, History, etc.). */
export function articleFromEditionSection(
  section: {
  id: string;
  section_type: string;
  headline: string;
  body: string;
  source_note?: string | null;
  },
  options?: {
    historicalImage?: import("./knowledgeGrounding").HistoricalImageAsset | null;
  }
): KindredArticle {
  const historical = options?.historicalImage;
  return articleFromSectionItem({
    id: section.id,
    section: section.section_type,
    headline: section.headline,
    body: section.body,
    source: section.source_note?.trim() || "Kindred",
    sourceUrl: null,
    imageUrl: historical?.url ?? null,
    imageCaption: historical?.caption ?? section.headline,
    imageCredit: historical?.credit ?? null,
  });
}

/** Edition section with stored knowledge payload (Today in History image). */
export function articleFromEditionSectionWithKnowledge(
  section: {
    id: string;
    section_type: string;
    headline: string;
    body: string;
    source_note?: string | null;
  },
  knowledge: KnowledgePayload | unknown | null | undefined
): KindredArticle {
  return articleFromEditionSection(section, {
    historicalImage:
      section.section_type === "today_in_history"
        ? onThisDayImageFromKnowledge(knowledge)
        : null,
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

/** Card photo from enrichment — keep reader hero aligned with the grid. */
function withDiscoveryEditorialHero(
  article: KindredArticle,
  item: DiscoveryItem
): KindredArticle {
  const url = item.editorialImage?.url?.trim();
  if (!url) return article;

  const attribution = attributionFromEditorialImage(item.editorialImage);
  const credit =
    attribution?.attributionText?.trim() ||
    (attribution?.photographerName
      ? `Photo by ${attribution.photographerName}`
      : null) ||
    (attribution?.source === "pexels"
      ? "Pexels"
      : attribution?.source === "pixabay"
        ? "Pixabay"
        : "Kindred editorial photography");

  return {
    ...article,
    heroImage: {
      uri: url,
      caption: item.title,
      credit,
      kind: "wire",
    },
  };
}

function discoveryActionSurface(
  item: DiscoveryItem
): "activity" | "recommendation" {
  return item.category === "activities" ? "activity" : "recommendation";
}

function attachDiscoveryActionContext(
  article: KindredArticle,
  item: DiscoveryItem
): KindredArticle {
  return {
    ...article,
    actionContext: actionContextFromDiscoveryItem(
      item,
      discoveryActionSurface(item)
    ),
  };
}
export function articleFromDiscoveryItem(
  ranked: RankedDiscoveryItem
): KindredArticle {
  const item = ranked.item;
  const why = formatDiscoveryWhy(ranked);
  const savedLocation = item.place?.city ?? item.address ?? null;

  const curated = getCuratedDiscoveryArticle(item.id);

  if (curated) {
    return attachDiscoveryActionContext(
      withDiscoveryEditorialHero(
        {
          ...articleFromSectionItem({
            id: item.id,
            section: "discovery",
            headline: item.title,
            body: curated.body.join("\n\n"),
            dek: curated.dek,
            pullQuote: curated.pullQuote ?? null,
            source: item.source?.name ?? "Kindred",
            sourceUrl: item.url ?? item.source?.url ?? null,
            discoveryCategory: item.category,
            contentType: curated.contentType,
            tags: [item.category],
            fieldAnswers: curated.fieldAnswers,
          }),
          savedLocation,
        },
        item
      ),
      item
    );
  }

  // Verified place (Foursquare) — a real, specific venue, but Kindred only
  // has its name/location confirmed. Build a full piece from the category
  // essay the desk already writes for this kind of place, grounded by the
  // one verified fact, rather than stretching a single sentence.
  if (item.tags?.includes("local_place")) {
    const composed = composePlaceDiscoveryArticle({
      title: item.title,
      dek: item.dek,
      city: item.place?.city ?? null,
      address: item.address ?? null,
      venueCategories: item.venueCategories ?? null,
      sourceName: item.source?.name ?? null,
      category: item.category,
      seedKey: item.id,
      knowledgeGrounding: item.knowledgeGrounding ?? null,
    });
    return attachDiscoveryActionContext(
      withDiscoveryEditorialHero(
        {
          ...articleFromSectionItem({
            id: item.id,
            section: "discovery",
            headline: item.title,
            body: composed.body.join("\n\n"),
            dek: composed.dek,
            source: item.source?.name ?? "Kindred",
            sourceUrl: item.url ?? item.source?.url ?? null,
            discoveryCategory: item.category,
            tags: [item.category],
            fieldAnswers: composed.fieldAnswers,
          }),
          savedLocation,
        },
        item
      ),
      item
    );
  }

  // Most of the seed catalog (and every local-event card reshaped into a
  // discovery item) has no hand-written piece of its own — borrow the
  // category essay so it reads as a full story, not a two-line filler.
  const categoryArticle = composeCategorySeedArticle({
    title: item.title,
    dek: item.dek,
    category: item.category,
    seedKey: item.id,
  });
  if (categoryArticle) {
    return attachDiscoveryActionContext(
      withDiscoveryEditorialHero(
        {
          ...articleFromSectionItem({
            id: item.id,
            section: "discovery",
            headline: item.title,
            body: categoryArticle.body.join("\n\n"),
            dek: categoryArticle.dek,
            source: item.source?.name ?? "Kindred",
            sourceUrl: item.url ?? item.source?.url ?? null,
            discoveryCategory: item.category,
            tags: [item.category],
            fieldAnswers: categoryArticle.fieldAnswers,
          }),
          savedLocation,
        },
        item
      ),
      item
    );
  }

  // Defensive last resort — only reached if a category has no essay yet.
  const body = composeFallbackDiscoveryBody({
    title: item.title,
    dek: item.dek,
    why,
    city: item.place?.city ?? null,
  });

  return attachDiscoveryActionContext(
    withDiscoveryEditorialHero(
      {
        ...articleFromSectionItem({
          id: item.id,
          section: "discovery",
          headline: item.title,
          body: body.join("\n\n"),
          dek: item.dek,
          source: item.source?.name ?? "Kindred",
          sourceUrl: item.url ?? item.source?.url ?? null,
          discoveryCategory: item.category,
          tags: [item.category],
          // Explicitly empty — the fallback body already answers the practical
          // question; auto-seeding a module from the dek here would repeat it
          // a third time under a labeled section.
          fieldAnswers: {},
        }),
        savedLocation,
      },
      item
    ),
    item
  );
}

/**
 * Bandit's Notebook → KindredArticle.
 * Same source data as articleFromDiscoveryItem, but with the reusable
 * dynamic composer that covers items whose runtime id can never exist in
 * the static discovery catalog (real local events reshaped into cards).
 * Scoped to the Notebook only — Experiences, Recommendations, and Local
 * Businesses keep using articleFromDiscoveryItem unchanged.
 *
 * Resolution order, richest verified source first:
 *   1. Curated static piece (hand-written, matched by id)
 *   2. Verified real local event (matched by name against the edition's
 *      actual local_events data — carries a real photo, venue, date/time)
 *   3. Honest generic composer (title/category/dek/why only — no invented
 *      sensory detail, no invented facts)
 */
export function articleFromNotebookItem(
  ranked: RankedDiscoveryItem,
  localEvents?: LocalEventCard[] | null
): KindredArticle {
  const item = ranked.item;
  const why = formatDiscoveryWhy(ranked);

  const curated = getCuratedDiscoveryArticle(item.id);
  if (curated) {
    return articleFromSectionItem({
      id: item.id,
      section: "discovery",
      headline: item.title,
      body: curated.body.join("\n\n"),
      dek: curated.dek,
      pullQuote: curated.pullQuote ?? null,
      source: item.source?.name ?? "Kindred",
      sourceUrl: item.url ?? item.source?.url ?? null,
      discoveryCategory: item.category,
      contentType: curated.contentType,
      tags: [item.category],
      fieldAnswers: curated.fieldAnswers,
    });
  }

  if (item.tags?.includes("local_place")) {
    const composed = composePlaceDiscoveryArticle({
      title: item.title,
      dek: item.dek,
      city: item.place?.city ?? null,
      address: item.address ?? null,
      venueCategories: item.venueCategories ?? null,
      sourceName: item.source?.name ?? null,
      category: item.category,
      seedKey: item.id,
      knowledgeGrounding: item.knowledgeGrounding ?? null,
    });
    return articleFromSectionItem({
      id: item.id,
      section: "discovery",
      headline: item.title,
      body: composed.body.join("\n\n"),
      dek: composed.dek,
      source: item.source?.name ?? "Kindred",
      sourceUrl: item.url ?? item.source?.url ?? null,
      discoveryCategory: item.category,
      tags: [item.category],
      fieldAnswers: composed.fieldAnswers,
    });
  }

  const verifiedEvent = matchVerifiedLocalEvent(item, localEvents);
  if (verifiedEvent) {
    const composed = composeVerifiedEventDiscoveryArticle(verifiedEvent);
    return articleFromSectionItem({
      id: item.id,
      section: "discovery",
      headline: item.title,
      body: composed.body.join("\n\n"),
      dek: composed.dek,
      source: verifiedEvent.sourceName?.trim() || "Local listing",
      sourceUrl: verifiedEvent.sourceUrl || item.url || null,
      // Real provider photo when the listing has one — never a stock
      // image standing in for a specific verified subject.
      imageUrl: verifiedEvent.imageUrl ?? null,
      imageCaption: verifiedEvent.name,
      banditNote: verifiedEvent.banditNote?.trim() || null,
      discoveryCategory: item.category,
      contentType: composed.contentType,
      tags: [item.category, "local_event"],
      fieldAnswers: composed.fieldAnswers,
    });
  }

  // No matching id, no verified event — borrow the category essay so an
  // event or seed idea without its own piece still reads as a full story.
  const categoryArticle = composeCategorySeedArticle({
    title: item.title,
    dek: item.dek,
    category: item.category,
    seedKey: item.id,
  });
  if (categoryArticle) {
    return articleFromSectionItem({
      id: item.id,
      section: "discovery",
      headline: item.title,
      body: categoryArticle.body.join("\n\n"),
      dek: categoryArticle.dek,
      source: item.source?.name ?? "Kindred",
      sourceUrl: item.url ?? item.source?.url ?? null,
      discoveryCategory: item.category,
      tags: [item.category],
      fieldAnswers: categoryArticle.fieldAnswers,
    });
  }

  // Defensive last resort — only reached if a category has no essay yet.
  const composed = composeGenericDynamicDiscoveryArticle({
    title: item.title,
    category: item.category,
    dek: item.dek,
    why,
    sourceName: item.source?.name ?? null,
    city: item.place?.city ?? null,
  });

  return articleFromSectionItem({
    id: item.id,
    section: "discovery",
    headline: item.title,
    body: composed.body.join("\n\n"),
    dek: item.dek,
    source: item.source?.name ?? "Kindred",
    sourceUrl: item.url ?? item.source?.url ?? null,
    discoveryCategory: item.category,
    tags: [item.category],
    fieldAnswers: composed.fieldAnswers,
  });
}

/**
 * Local event / festival → KindredArticle with the matching desk template.
 * Story first (Bandit’s invitation); logistics as magazine modules.
 */
export function articleFromLocalEvent(event: LocalEventCard): KindredArticle {
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  const whenParts = [event.date, event.time].filter(
    (p) => p && !/TBA/i.test(p)
  );
  const whenLine = whenParts.join(" · ") || "Check the listing for times.";
  const hay = `${event.name} ${event.venue}`.toLowerCase();
  const isFestival = /festival|fair|parade|carnival/.test(hay);
  const banditNote = event.banditNote?.trim() || null;

  // Story first, built only from what Kindred actually knows — the
  // Bandit note (grounded, never invented) opens the scene; the rest is
  // an honest, category-true case for going, never a fabricated detail.
  const hook =
    banditNote ||
    (place
      ? `Something is on tonight at ${place} worth rearranging an evening for.`
      : "A local moment worth leaving the house for.");
  const context = isFestival
    ? pickVariant(event.name, [
        "Festivals like this are where a town actually shows up for itself — worth the crowd, the parking search, and the hour spent finding a good spot to stand.",
        "A festival is one of the few times a whole town turns up in the same place at once — worth the crowd and the walk to find parking.",
      ])
    : pickVariant(event.name, [
        "The best local evenings rarely make anyone's must-see list. They just quietly turn out better than staying in would have.",
        "Nothing about this needs to be a big production — just an evening worth showing up for.",
        "This is the kind of plan that looks unremarkable on paper and turns out to be exactly the right amount of evening.",
      ]);
  const closing = pickVariant(`${event.name}:${event.date}`, [
    "Here's what Kindred could confirm — the rest is worth discovering in person.",
    "That's what Kindred could pin down — the rest is best found out by going.",
    "Kindred can vouch for the details above; everything else is worth seeing for yourself.",
  ]);
  const story = [hook, context, closing];

  return {
    ...articleFromSectionItem({
      id: `event:${event.name}:${event.date}`.slice(0, 120),
      section: "local_events",
      headline: event.name.trim(),
      body: story.join("\n\n"),
      dek: place || null,
      source: event.sourceName?.trim() || "Local listing",
      sourceUrl: event.sourceUrl || null,
      imageUrl: event.imageUrl ?? null,
      imageCaption: event.name,
      banditNote,
      contentType: isFestival ? "festival" : "local_event",
      tags: [isFestival ? "festival" : "local_event", event.name],
      fieldAnswers: {
        when: whenLine,
        where: place || null,
        what_to_expect: isFestival
          ? "Expect crowds, food and craft stalls, and a full program of activity — arrive early for the calmer version of it."
          : "A single scheduled happening — arrive a little before start time to find parking and a good spot.",
        tips: event.sourceUrl
          ? "Confirm hours and tickets on the listing before you go — schedules shift close to the date."
          : "Details can shift close to the date — worth a quick check before you leave.",
      },
    }),
    savedContentType: "event",
    savedLocation: place || null,
    savedEventTime: whenLine || null,
    savedEventEndsAt: resolveEventEndsAt(event.date, event.time),
    actionContext: actionContextFromLocalEvent(event),
  };
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
