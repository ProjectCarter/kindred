/**
 * Today in History desk sync — article text and image must originate from the
 * same record. Mismatched pairs fail loudly (image omitted) instead of rendering.
 */

import type { EditionSection } from "./types.ts";
import type { KnowledgePayload } from "./knowledge.ts";
import { parseKnowledgePayload } from "./knowledge.ts";
import type {
  EditionKnowledgeGrounding,
  HistoricalImageAsset,
  TodayInHistoryDeskSync,
} from "./knowledgeGrounding.ts";
import type { UsNationalDailyRecord } from "./usNationalDaily.ts";
import {
  parseHistoricalImageAsset,
  todayInHistoryImageFromNationalDaily,
} from "./todayInHistoryImage.ts";

export type TodayInHistorySyncStep =
  | "national_daily_record"
  | "edition_generation"
  | "edition_sections"
  | "async_storage"
  | "edition_reader"
  | "today_in_history_section";

export type TodayInHistoryArticleIdentity = {
  sectionId: string | null;
  year: number | null;
  headline: string | null;
  fingerprint: string;
};

export type TodayInHistoryImageIdentity = {
  source: "knowledge" | "national_daily" | "paired_cache" | null;
  nationalDailyId: string | null;
  year: number | null;
  url: string | null;
  resolvedAt: string | null;
  fingerprint: string;
};

export type TodayInHistorySyncTrace = {
  step: TodayInHistorySyncStep;
  editionId?: string | null;
  editionDate?: string | null;
  usNationalDailyId?: string | null;
  article: TodayInHistoryArticleIdentity;
  image: TodayInHistoryImageIdentity;
  synced: boolean;
  reason: string | null;
  cachedAt?: number | null;
};

export type TodayInHistoryDeskResolution = {
  image: HistoricalImageAsset | null;
  imageSource: TodayInHistoryImageIdentity["source"];
  nationalDailyId: string | null;
  synced: boolean;
  reason: string | null;
  article: TodayInHistoryArticleIdentity;
  imageIdentity: TodayInHistoryImageIdentity;
};

const YEAR_RE = /\b(1[0-9]{3}|20[0-9]{2})\b/;

function stableFingerprint(
  parts: Record<string, string | number | null | undefined>
): string {
  const payload = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key] ?? ""}`)
    .join("|");
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function bodyPrefix(body: string, maxChars = 160): string {
  return body.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

export function historyYearFromSection(section: {
  headline: string;
  body: string;
}): number | null {
  const fromHeadline = section.headline.match(YEAR_RE);
  if (fromHeadline) return Number(fromHeadline[1]);

  const fromBody =
    section.body.match(/\bIn\s+(1[0-9]{3}|20[0-9]{2})\b/i) ??
    section.body.match(/\bin\s+(1[0-9]{3}|20[0-9]{2})\b/);
  if (fromBody) return Number(fromBody[1]);

  return null;
}

export function todayInHistoryContentFingerprint(input: {
  year?: number | null;
  headline?: string | null;
  body?: string | null;
}): string {
  return stableFingerprint({
    year: input.year ?? "",
    headline: (input.headline ?? "").trim(),
    body: bodyPrefix(input.body ?? ""),
  });
}

export function articleIdentityFromSection(
  section: EditionSection | null | undefined
): TodayInHistoryArticleIdentity {
  if (!section) {
    return {
      sectionId: null,
      year: null,
      headline: null,
      fingerprint: stableFingerprint({ empty: 1 }),
    };
  }

  const headline = section.headline?.trim() ?? "";
  const body = section.body?.trim() ?? "";
  const year = historyYearFromSection({ headline, body });

  return {
    sectionId: section.id ?? null,
    year,
    headline: headline || null,
    fingerprint: todayInHistoryContentFingerprint({ year, headline, body }),
  };
}

export function articleIdentityFromNationalDaily(
  record: UsNationalDailyRecord | null | undefined
): TodayInHistoryArticleIdentity | null {
  const history = record?.todayInHistory;
  if (!history?.headline?.trim() || !history.body?.trim()) return null;

  const headline = history.headline.trim();
  const body = history.body.trim();

  return {
    sectionId: null,
    year: history.year ?? null,
    headline,
    fingerprint: todayInHistoryContentFingerprint({
      year: history.year ?? null,
      headline,
      body,
    }),
  };
}

export function imageIdentityFromAsset(
  image: HistoricalImageAsset | null | undefined,
  input: {
    source: TodayInHistoryImageIdentity["source"];
    nationalDailyId?: string | null;
    year?: number | null;
  }
): TodayInHistoryImageIdentity {
  const url = image?.url?.trim() ?? null;
  return {
    source: input.source,
    nationalDailyId: input.nationalDailyId ?? null,
    year: input.year ?? null,
    url,
    resolvedAt: image?.resolvedAt?.trim() ?? null,
    fingerprint: stableFingerprint({
      source: input.source ?? "",
      nationalDailyId: input.nationalDailyId ?? "",
      year: input.year ?? "",
      url: url ?? "",
      resolvedAt: image?.resolvedAt ?? "",
    }),
  };
}

function groundingFromKnowledge(
  knowledge: KnowledgePayload | unknown | null | undefined
): EditionKnowledgeGrounding | null {
  const payload =
    knowledge && typeof knowledge === "object" && "byStoryKey" in knowledge
      ? (knowledge as KnowledgePayload)
      : parseKnowledgePayload(knowledge);
  return payload?.providerGrounding ?? null;
}

function knowledgeImageCandidate(
  knowledge: KnowledgePayload | unknown | null | undefined,
  article: TodayInHistoryArticleIdentity
): {
  image: HistoricalImageAsset | null;
  identity: TodayInHistoryImageIdentity;
  synced: boolean;
} {
  const grounding = groundingFromKnowledge(knowledge);
  const image = parseHistoricalImageAsset(grounding?.onThisDayImage);
  const sync = grounding?.onThisDaySync ?? null;
  const identity = imageIdentityFromAsset(image, {
    source: image ? "knowledge" : null,
    nationalDailyId: sync?.nationalDailyId ?? null,
    year: sync?.year ?? article.year,
  });

  if (!image) {
    return { image: null, identity, synced: false };
  }

  const synced =
    sync?.articleFingerprint === article.fingerprint ||
    (sync?.year != null &&
      article.year != null &&
      sync.year === article.year &&
      sync.imageFingerprint === identity.fingerprint);

  return { image, identity, synced };
}

function nationalDailyImageCandidate(
  record: UsNationalDailyRecord | null | undefined,
  article: TodayInHistoryArticleIdentity,
  source: "national_daily" | "paired_cache"
): {
  image: HistoricalImageAsset | null;
  identity: TodayInHistoryImageIdentity;
  synced: boolean;
  recordArticle: TodayInHistoryArticleIdentity | null;
} {
  const recordArticle = articleIdentityFromNationalDaily(record);
  const image = todayInHistoryImageFromNationalDaily(record);
  const identity = imageIdentityFromAsset(image, {
    source: image ? source : null,
    nationalDailyId: record?.id ?? null,
    year: record?.todayInHistory?.year ?? null,
  });

  if (!image || !recordArticle) {
    return { image: null, identity, synced: false, recordArticle };
  }

  const synced = recordArticle.fingerprint === article.fingerprint;
  return { image, identity, synced, recordArticle };
}

export function logTodayInHistorySyncTrace(trace: TodayInHistorySyncTrace): void {
  if (!__DEV__) return;

  const payload = {
    step: trace.step,
    editionId: trace.editionId ?? null,
    editionDate: trace.editionDate ?? null,
    usNationalDailyId: trace.usNationalDailyId ?? null,
    cachedAt: trace.cachedAt ?? null,
    synced: trace.synced,
    reason: trace.reason,
    article: trace.article,
    image: trace.image,
  };

  if (!trace.synced) {
    console.warn("[todayInHistory:sync] DESYNC", payload);
    return;
  }

  console.log("[todayInHistory:sync]", payload);
}

export function resolveSyncedTodayInHistoryDesk(input: {
  section: EditionSection | null | undefined;
  knowledge?: KnowledgePayload | unknown | null;
  nationalDaily?: UsNationalDailyRecord | null;
  /** Snapshot stored beside the cached section — wins over network national daily. */
  pairedNationalDaily?: UsNationalDailyRecord | null;
}): TodayInHistoryDeskResolution {
  const article = articleIdentityFromSection(input.section);

  if (!input.section) {
    return {
      image: null,
      imageSource: null,
      nationalDailyId: null,
      synced: false,
      reason: "missing_section",
      article,
      imageIdentity: imageIdentityFromAsset(null, { source: null }),
    };
  }

  const knowledgeCandidate = knowledgeImageCandidate(input.knowledge, article);
  if (knowledgeCandidate.image && knowledgeCandidate.synced) {
    return {
      image: knowledgeCandidate.image,
      imageSource: "knowledge",
      nationalDailyId: knowledgeCandidate.identity.nationalDailyId,
      synced: true,
      reason: null,
      article,
      imageIdentity: knowledgeCandidate.identity,
    };
  }

  const pairedCandidate = nationalDailyImageCandidate(
    input.pairedNationalDaily,
    article,
    "paired_cache"
  );
  if (pairedCandidate.image && pairedCandidate.synced) {
    return {
      image: pairedCandidate.image,
      imageSource: "paired_cache",
      nationalDailyId: pairedCandidate.identity.nationalDailyId,
      synced: true,
      reason: null,
      article,
      imageIdentity: pairedCandidate.identity,
    };
  }

  const networkCandidate = nationalDailyImageCandidate(
    input.nationalDaily,
    article,
    "national_daily"
  );
  if (networkCandidate.image && networkCandidate.synced) {
    return {
      image: networkCandidate.image,
      imageSource: "national_daily",
      nationalDailyId: networkCandidate.identity.nationalDailyId,
      synced: true,
      reason: null,
      article,
      imageIdentity: networkCandidate.identity,
    };
  }

  const reasons: string[] = [];
  if (knowledgeCandidate.image && !knowledgeCandidate.synced) {
    reasons.push("knowledge_image_article_mismatch");
  }
  if (pairedCandidate.image && !pairedCandidate.synced) {
    reasons.push("paired_cache_article_mismatch");
  }
  if (networkCandidate.image && !networkCandidate.synced) {
    const sectionYear = article.year;
    const networkYear = networkCandidate.recordArticle?.year ?? null;
    if (
      sectionYear != null &&
      networkYear != null &&
      sectionYear !== networkYear
    ) {
      reasons.push(
        `section_year_${sectionYear}_national_daily_year_${networkYear}`
      );
    } else {
      reasons.push("national_daily_article_mismatch");
    }
  }
  if (!knowledgeCandidate.image && !pairedCandidate.image && !networkCandidate.image) {
    reasons.push("no_image_candidate");
  }

  const fallbackIdentity =
    knowledgeCandidate.image
      ? knowledgeCandidate.identity
      : pairedCandidate.image
        ? pairedCandidate.identity
        : networkCandidate.identity;

  return {
    image: null,
    imageSource: null,
    nationalDailyId:
      input.pairedNationalDaily?.id ?? input.nationalDaily?.id ?? null,
    synced: false,
    reason: reasons.join("; ") || "unsynced",
    article,
    imageIdentity: fallbackIdentity,
  };
}

export function buildTodayInHistoryDeskSync(input: {
  year: number;
  eventText: string;
  articleFingerprint: string;
  imageFingerprint: string;
  nationalDailyId?: string | null;
  source: TodayInHistoryDeskSync["source"];
}): TodayInHistoryDeskSync {
  return {
    year: input.year,
    eventText: input.eventText,
    articleFingerprint: input.articleFingerprint,
    imageFingerprint: input.imageFingerprint,
    nationalDailyId: input.nationalDailyId ?? null,
    syncedAt: new Date().toISOString(),
    source: input.source,
  };
}

export function buildPairedNationalDailySnapshot(input: {
  editionDate: string;
  section: EditionSection;
  image: HistoricalImageAsset;
  year: number;
  eventText: string;
  source: "client_recovery" | "server_recovery";
  nationalDailyId?: string | null;
}): UsNationalDailyRecord {
  const headline = input.section.headline?.trim() ?? "";
  const body = input.section.body?.trim() ?? "";
  const id =
    input.nationalDailyId?.trim() ||
    `paired:${input.source}:${input.editionDate}:${input.year}`;

  return {
    id,
    editionDate: input.editionDate,
    countryCode: "US",
    todayMasterpiece: null,
    todayInHistory: {
      year: input.year,
      eventText: input.eventText,
      headline,
      body,
      teaser: body.split(/\n{2,}/)[0]?.trim() ?? "",
      sourceNote: input.section.source_note?.trim() || "Sourced from Wikipedia",
      image: input.image,
      selectionMeta: null,
    },
    nationalNews: null,
  };
}

export function resolvePairedNationalDailyForCache(input: {
  sections: EditionSection[];
  networkDaily?: UsNationalDailyRecord | null;
  existingPaired?: UsNationalDailyRecord | null;
}): UsNationalDailyRecord | null {
  const section = input.sections.find((s) => s.section_type === "today_in_history");
  if (!section) return input.existingPaired ?? null;

  const sectionArticle = articleIdentityFromSection(section);

  if (input.existingPaired) {
    const pairedArticle = articleIdentityFromNationalDaily(input.existingPaired);
    if (pairedArticle?.fingerprint === sectionArticle.fingerprint) {
      return input.existingPaired;
    }
  }

  if (input.networkDaily) {
    const networkArticle = articleIdentityFromNationalDaily(input.networkDaily);
    if (networkArticle?.fingerprint === sectionArticle.fingerprint) {
      return input.networkDaily;
    }
  }

  return input.existingPaired ?? null;
}
