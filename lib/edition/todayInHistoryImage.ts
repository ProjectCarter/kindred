/**
 * Today in History image resolution — image must match the rendered section record.
 */

import type { EditionSection } from "./types.ts";
import type { KnowledgePayload } from "./knowledge.ts";
import { parseKnowledgePayload } from "./knowledge.ts";
import type { HistoricalImageAsset } from "./knowledgeGrounding.ts";
import type { UsNationalDailyRecord } from "./usNationalDaily.ts";
import {
  imageIdentityFromAsset,
  resolveSyncedTodayInHistoryDesk,
} from "./todayInHistorySync.ts";

function onThisDayImageFromKnowledgePayload(
  knowledge: KnowledgePayload | unknown | null | undefined
): HistoricalImageAsset | null {
  const payload =
    knowledge && typeof knowledge === "object" && "byStoryKey" in knowledge
      ? (knowledge as KnowledgePayload)
      : parseKnowledgePayload(knowledge);
  const image = payload?.providerGrounding?.onThisDayImage;
  if (!image?.url?.trim()) return null;
  return image;
}

export type TodayInHistoryImageResolution = {
  image: HistoricalImageAsset | null;
  source: "knowledge" | "national_daily" | "paired_cache" | null;
  nationalDailyId: string | null;
  todayInHistoryId: string | null;
  synced: boolean;
  reason: string | null;
  article: import("./todayInHistorySync.ts").TodayInHistoryArticleIdentity;
  imageIdentity: import("./todayInHistorySync.ts").TodayInHistoryImageIdentity;
};

const AUTHORIZED_SOURCES = new Set<HistoricalImageAsset["source"]>([
  "wikimedia_commons",
  "wikipedia",
]);

/** Normalize and validate a stored historical image asset. */
export function parseHistoricalImageAsset(
  raw: unknown
): HistoricalImageAsset | null {
  if (!raw || typeof raw !== "object") return null;
  const asset = raw as HistoricalImageAsset;
  const url = asset.url?.trim();
  if (!url) return null;
  if (!AUTHORIZED_SOURCES.has(asset.source)) return null;
  if (!asset.caption?.trim() || !asset.credit?.trim()) return null;
  if (!asset.sourcePageUrl?.trim() || !asset.resolvedAt?.trim()) return null;
  return {
    ...asset,
    url,
    caption: asset.caption.trim(),
    credit: asset.credit.trim(),
    sourcePageUrl: asset.sourcePageUrl.trim(),
    previewUrl: asset.previewUrl?.trim() || null,
    license: asset.license?.trim() || null,
  };
}

export function todayInHistoryImageFromNationalDaily(
  record: UsNationalDailyRecord | null | undefined
): HistoricalImageAsset | null {
  return parseHistoricalImageAsset(record?.todayInHistory?.image ?? null);
}

export function resolveTodayInHistoryImage(input: {
  section?: EditionSection | null;
  knowledge?: KnowledgePayload | unknown | null;
  nationalDaily?: UsNationalDailyRecord | null;
  pairedNationalDaily?: UsNationalDailyRecord | null;
  editionDate?: string | null;
}): TodayInHistoryImageResolution {
  const desk = resolveSyncedTodayInHistoryDesk({
    section: input.section,
    knowledge: input.knowledge,
    nationalDaily: input.nationalDaily,
    pairedNationalDaily: input.pairedNationalDaily,
    editionDate: input.editionDate,
  });

  return {
    image: desk.image,
    source: desk.imageSource,
    nationalDailyId: desk.nationalDailyId,
    todayInHistoryId: desk.nationalDailyId ? `${desk.nationalDailyId}:history` : null,
    synced: desk.synced,
    reason: desk.reason,
    article: desk.article,
    imageIdentity: desk.imageIdentity,
  };
}

export function shouldRenderTodayInHistoryImage(
  image: HistoricalImageAsset | null | undefined,
  sync?: { synced?: boolean }
): boolean {
  if (sync?.synced === false) return false;
  return Boolean(image?.url?.trim());
}

/** @deprecated Prefer resolveTodayInHistoryImage with section context. */
export function legacyKnowledgeFirstImage(input: {
  knowledge?: KnowledgePayload | unknown | null;
  nationalDaily?: UsNationalDailyRecord | null;
}): HistoricalImageAsset | null {
  const knowledgeImage = parseHistoricalImageAsset(
    onThisDayImageFromKnowledgePayload(input.knowledge)
  );
  if (knowledgeImage) return knowledgeImage;
  return todayInHistoryImageFromNationalDaily(input.nationalDaily);
}

export { imageIdentityFromAsset } from "./todayInHistorySync.ts";
