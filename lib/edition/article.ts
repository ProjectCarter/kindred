import type { LeadStory } from "./LeadStory";
import {
  formatDiscoveryWhy,
  type DiscoveryItem,
  type RankedDiscoveryItem,
} from "./discovery";
import type { KnowledgeFacet, KnowledgePayload } from "./knowledge";
import { resolveTodayInHistoryImage } from "./todayInHistoryImage";
import { resolveTodayInHistoryDisplayHeadline } from "./history/headline";
import {
  isStoryOfSection,
  parseStoryOfSourceNote,
  storyOfImageFromSourceNote,
} from "./storyOf";
import { resolveStoryOfCityImage } from "./storyOfImage";
import { dedupeProse, isNearDuplicateProse } from "./contentQuality";
import { getGoldStandardArticle } from "./goldStandard/algalBloomArticle";
import {
  applyContentSystem,
  type ContentType,
  type EditorialFieldAnswers,
  type EditorialModule,
} from "./contentSystem";
import type { LocalEventCard } from "./localEvents";
import { eventDisplayHeadline } from "./localEvents";
import type { ClippingContentType } from "./clippingTypes";
import { resolveEventEndsAt } from "./eventExpiry";
import {
  composeEventArticleFromVerifiedData,
} from "./eventEditorial";
import {
  composeCategorySeedArticle,
  composeFallbackDiscoveryBody,
  composeGenericDynamicDiscoveryArticle,
  composePlaceDiscoveryArticle,
  composeVerifiedEventDiscoveryArticle,
  getCuratedDiscoveryArticle,
  matchVerifiedLocalEvent,
} from "./discoveryArticles";
import {
  actionContextFromBanditsPick,
  actionContextFromDiscoveryItem,
  actionContextFromLocalEvent,
} from "./actionBar";
import { enrichBanditsPickStory } from "./banditEditorial";
import { sanitizeAddressForDisplay } from "./verifiedLocation";
import type { ImageSourcePropType } from "react-native";
import { resolveDiscoveryCategoryIcon, resolveEventCategoryIcon, resolveBanditsPickCategoryIcon } from "./categoryIcon";
import { resolveVenueClassification } from "./venueClassification";
import { inferActivitySubtype } from "./activities";

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
  /** Single editorial category emoji — consistent on cards and in the reader. */
  categoryIcon?: string | null;
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
  /** Bandit's closing signature — end of Bandit's Pick features. */
  closingBanditNote?: string | null;
  /** Publisher URL for "Read Original Article". */
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
  /** Bandit's Pick — 2–3 local editorial recommendations after the feature. */
  nearbyEditorial?: Array<{
    name: string;
    description: string;
    glyph?: string | null;
  }> | null;
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
  /** Frozen History Around Town snapshot — premium reader only. */
  historyPlaceSnapshot?: import("./historyAroundTown/types").HistoryPlaceSnapshot | null;
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
    body?: string[];
    modules?: EditorialModule[];
    closingNote?: string | null;
    mapsQuery?: string | null;
    actionLabel?: string | null;
    nearby?: Array<{ name: string; description: string; glyph?: string }>;
    heroMomentId?: string | null;
    imageCaption?: string | null;
    why?: string;
    source: string;
    url: string | null;
    publishedAt: string | null;
    imageUrl?: string | null;
    discoveryItem?: DiscoveryItem | null;
  },
  options?: {
    intro?: string | null;
    fallbackCity?: string | null;
    editionDate?: string | null;
    kind?: import("./bandit").BanditsPickKind;
  }
): KindredArticle {
  const enriched = enrichBanditsPickStory({
    ...pick,
    why: pick.why ?? "",
  });
  const bodyText =
    enriched.body?.length && enriched.body.join("").trim()
      ? enriched.body.join("\n\n")
      : enriched.summary?.trim() || "";

  const base = articleFromSectionItem({
    id: enriched.id,
    section: "bandits_pick",
    headline: enriched.headline,
    body: bodyText,
    source: enriched.source,
    sourceUrl: enriched.url,
    publishedAt: enriched.publishedAt,
    imageUrl: null,
    dek: null,
    banditNote: options?.intro?.trim() || null,
    contentType: "recommendation",
  });

  const modules =
    enriched.modules?.length && enriched.modules.some((m) => m.body?.trim())
      ? enriched.modules
      : base.modules;

  return {
    ...base,
    categoryIcon: resolveBanditsPickCategoryIcon({
      kind: options?.kind ?? "place",
      headline: enriched.headline,
      summary: enriched.summary,
      category: pick.discoveryItem?.category ?? null,
      discoveryItem: pick.discoveryItem ?? null,
    }),
    body: enriched.body?.length ? enriched.body : base.body,
    modules,
    figures: [],
    closingBanditNote: enriched.closingNote?.trim() || null,
    nearbyEditorial: enriched.nearby?.length ? enriched.nearby : null,
    heroImage: null,
    actionContext: actionContextFromBanditsPick({
      url: enriched.url,
      mapsQuery: enriched.mapsQuery,
      actionLabel: enriched.actionLabel,
      discoveryItem: enriched.discoveryItem ?? pick.discoveryItem ?? null,
      fallbackCity: options?.fallbackCity ?? null,
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
      "The note on this one is short — the full report lives with the original source.",
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
    dek?: string | null;
  }
): KindredArticle {
  let historical = options?.historicalImage;
  if (isStoryOfSection(section.section_type)) {
    const resolved = resolveStoryOfCityImage({
      sourceNote: section.source_note,
      metroKey: parseStoryOfSourceNote(section.source_note)?.metroKey ?? null,
    });
    historical = resolved ?? historical ?? null;
  }
  const storyNote = isStoryOfSection(section.section_type)
    ? parseStoryOfSourceNote(section.source_note)
    : null;
  const article = articleFromSectionItem({
    id: section.id,
    section: section.section_type,
    headline: section.headline,
    body: section.body,
    dek: options?.dek ?? storyNote?.subtitle ?? null,
    source: storyNote ? "Kindred Editorial" : section.source_note?.trim() || "Kindred",
    sourceUrl: null,
    imageUrl: historical?.url ?? null,
    imageCaption: historical?.caption ?? section.headline,
    imageCredit: historical?.credit ?? null,
  });

  if (historical?.url && article.heroImage) {
    return {
      ...article,
      heroImage: { ...article.heroImage, kind: "historical" },
    };
  }

  return article;
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
  knowledge: KnowledgePayload | unknown | null | undefined,
  options?: {
    nationalDaily?: import("./usNationalDaily").UsNationalDailyRecord | null;
    pairedNationalDaily?: import("./usNationalDaily").UsNationalDailyRecord | null;
  }
): KindredArticle {
  const historicalImage =
    section.section_type === "today_in_history"
      ? resolveTodayInHistoryImage({
          section,
          knowledge,
          nationalDaily: options?.nationalDaily,
          pairedNationalDaily: options?.pairedNationalDaily,
        }).image
      : isStoryOfSection(section.section_type)
        ? storyOfImageFromSourceNote(section.source_note)
        : null;

  const displayHeadline =
    section.section_type === "today_in_history"
      ? resolveTodayInHistoryDisplayHeadline(section)
      : section.headline;

  return articleFromEditionSection(
    { ...section, headline: displayHeadline },
    {
      historicalImage,
    dek:
      isStoryOfSection(section.section_type)
        ? parseStoryOfSourceNote(section.source_note)?.subtitle ?? null
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

function finalizeDiscoveryArticle(
  article: KindredArticle,
  item: DiscoveryItem
): KindredArticle {
  const surface = discoveryActionSurface(item);
  const context = surface === "activity" ? "activity" : "recommendation";
  const venue = resolveVenueClassification({
    title: item.title,
    venueCategories: item.venueCategories,
    discoveryCategory: item.category,
    dek: item.dek,
    address: item.address,
  });
  return attachDiscoveryActionContext(
    {
      ...article,
      categoryIcon: resolveDiscoveryCategoryIcon(
        {
          title: item.title,
          dek: item.dek,
          category: item.category,
          venueCategories: item.venueCategories,
          tags: item.tags,
          editorialCategoryId:
            venue.confidence !== "low" ? venue.categoryId : null,
          activitySubtype:
            item.category === "activities" ? inferActivitySubtype(item) : null,
        },
        context
      ),
    },
    item
  );
}

function discoverySavedLocation(item: DiscoveryItem): string | null {
  const address = sanitizeAddressForDisplay(item.address);
  if (address) return address;
  const city = item.place?.city?.trim();
  const state = item.place?.state?.trim() || item.place?.region?.trim();
  if (city && state) return `${city}, ${state}`;
  return city || null;
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
  ranked: RankedDiscoveryItem,
  options?: { editionDate?: string | null }
): KindredArticle {
  const item = ranked.item;
  const editionDate = options?.editionDate ?? null;
  const why = formatDiscoveryWhy(ranked);
  const savedLocation = discoverySavedLocation(item);

  const curated = getCuratedDiscoveryArticle(item.id);

  if (curated) {
    return finalizeDiscoveryArticle(
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
        savedContentType:
          item.category === "activities" ? "activity" : "recommendation",
      },
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
      address: sanitizeAddressForDisplay(item.address),
      venueCategories: item.venueCategories ?? null,
      sourceName: item.source?.name ?? null,
      category: item.category,
      seedKey: item.id,
      editionDate,
      knowledgeGrounding: item.knowledgeGrounding ?? null,
    });
    return finalizeDiscoveryArticle(
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
        savedContentType:
          item.category === "activities" ? "activity" : "recommendation",
      },
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
    editionDate,
  });
  if (categoryArticle) {
    return finalizeDiscoveryArticle(
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
        savedContentType:
          item.category === "activities" ? "activity" : "recommendation",
      },
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

  return finalizeDiscoveryArticle(
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
        fieldAnswers: {},
      }),
      savedLocation,
      savedContentType:
        item.category === "activities" ? "activity" : "recommendation",
    },
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
  localEvents?: LocalEventCard[] | null,
  options?: { editionDate?: string | null }
): KindredArticle {
  const item = ranked.item;
  const editionDate = options?.editionDate ?? null;
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
      address: sanitizeAddressForDisplay(item.address),
      venueCategories: item.venueCategories ?? null,
      sourceName: item.source?.name ?? null,
      category: item.category,
      seedKey: item.id,
      editionDate,
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
    const composed = composeVerifiedEventDiscoveryArticle(verifiedEvent, { editionDate });
    return articleFromSectionItem({
      id: item.id,
      section: "discovery",
      headline: item.title,
      body: composed.body.join("\n\n"),
      dek: composed.dek,
      source: verifiedEvent.sourceName?.trim() || "Local listing",
      sourceUrl: verifiedEvent.sourceUrl || item.url || null,
      imageUrl: null,
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
    editionDate,
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
 * Local event / festival → KindredArticle with verified editorial copy only.
 * Editorial law: docs/editorial/EVENT_EDITORIAL_STANDARD.md
 */
export function articleFromLocalEvent(
  event: LocalEventCard,
  options?: { editionDate?: string | null }
): KindredArticle {
  const venue =
    event.venue?.trim() && event.venue.trim() !== "Venue TBA"
      ? event.venue.trim()
      : null;
  const safeVenue =
    venue && !/^\d+[a-z]?$/i.test(venue) ? venue : null;
  const place = [safeVenue, event.city?.trim()].filter(Boolean).join(", ");
  const whenParts = [event.date, event.time].filter(
    (p) => p && !/TBA/i.test(p)
  );
  const whenLine = whenParts.join(" · ") || "Check the listing for times.";
  const hay = `${event.name} ${event.venue}`.toLowerCase();
  const isFestival = /festival|fair|parade|carnival/.test(hay);
  const banditNote = event.banditNote?.trim() || null;
  const story = composeEventArticleFromVerifiedData(event, options);

  return {
    ...articleFromSectionItem({
      id: `event:${event.name}:${event.date}`.slice(0, 120),
      section: "local_events",
      headline: eventDisplayHeadline(event),
      body: story.join("\n\n"),
      dek: place || null,
      source: event.sourceName?.trim() || "Local listing",
      sourceUrl: event.sourceUrl || null,
      imageUrl: null,
      imageCaption: event.name,
      banditNote,
      contentType: isFestival ? "festival" : "local_event",
      tags: [isFestival ? "festival" : "local_event", event.name],
      fieldAnswers: {
        when: whenLine,
        where: place || null,
        what_to_expect: story[1] ?? story[0] ?? null,
        tips: event.sourceUrl
          ? "Confirm hours and tickets on the listing before you go — schedules shift close to the date."
          : null,
      },
    }),
    categoryIcon:
      event.categoryIcon ??
      resolveEventCategoryIcon({
        name: event.name,
        venue: event.venue,
        category: event.category,
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
    article.section === "looking_ahead"
  ) {
    return true;
  }
  const words = [article.dek, ...(article.body ?? [])]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
  if (article.section === "today_in_history") {
    return words < 250;
  }
  if (article.section === "your_city" || article.section === "story_of") {
    return words < 500;
  }
  return words < 350;
}

/** edition_sections.id is a UUID — only those can be clipped to the library. */
export function isClippableSectionId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}
