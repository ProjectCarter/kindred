/**
 * Resolve shared U.S. National News — once per calendar date, idempotent under concurrency.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { runStoryEditorSafe } from "../storyEditor/index.ts";
import type { StoryEditorResult } from "../storyEditor/types.ts";
import { isRichNewsSource } from "../../../../lib/edition/newsBriefingQuality.ts";
import { validateKindredArticleProse } from "../../../../lib/edition/kindredArticleProse.ts";
import {
  buildNationalNewsStoryPayload,
  selectNationalNewsStories,
} from "./selectNationalNews.ts";
import type {
  NationalNewsDiagnostic,
  UsNationalNewsPackagePayload,
} from "./types.ts";
import { US_NATIONAL_COUNTRY_CODE } from "./resolveUsNationalDaily.ts";

function nationalStoryCopyFromEdit(
  ranked: Awaited<ReturnType<typeof selectNationalNewsStories>>["selected"][number],
  result: StoryEditorResult | null | undefined
): {
  headline: string;
  summary: string;
  dek: string | null;
  body: string[];
} {
  const wireHeadline = ranked.story.title.trim();
  const wireSummary = (ranked.story.description || ranked.story.title).trim();
  const wireFallback = {
    headline: wireHeadline,
    summary: wireSummary,
    dek: null,
    body: [] as string[],
  };

  if (!result?.ok || !result.paragraphs.length) {
    return wireFallback;
  }

  const body = result.paragraphs
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const dek = result.dek?.trim() || null;
  const sourceText = ranked.story.description || ranked.story.title;

  const prose = validateKindredArticleProse({
    headline: result.headline,
    dek,
    body,
    desk: "national_news",
    subjectTokens: [result.headline, ranked.story.source].filter(Boolean),
    minParagraphs: isRichNewsSource(sourceText) ? 3 : 2,
  });

  if (!prose.passes) {
    return wireFallback;
  }

  const headline = result.headline.trim() || wireHeadline;
  const summary = dek || body[0]?.trim() || wireSummary;

  return { headline, summary, dek, body };
}

function parseNationalNewsPayload(raw: unknown): UsNationalNewsPackagePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as UsNationalNewsPackagePayload;
  if (!row.packageId?.trim() || !row.editionDate?.trim()) return null;
  if (!Array.isArray(row.stories) || row.stories.length === 0) return null;
  const stories = row.stories.filter(
    (s) => s?.id?.trim() && s?.headline?.trim() && s?.summary?.trim()
  );
  if (stories.length === 0) return null;
  return { ...row, stories: stories.sort((a, b) => a.rank - b.rank) };
}

function logNationalNews(
  event: NationalNewsDiagnostic | "national_news_attached_to_city",
  input: {
    traceId?: string | null;
    editionDate: string;
    elapsedMs: number;
    nationalDailyId?: string | null;
    packageId?: string | null;
    storyCount?: number;
    metroKey?: string | null;
    editionId?: string | null;
    message?: string | null;
  }
): void {
  console.log(`[usNationalNews] ${event}`, {
    traceId: input.traceId ?? null,
    editionDate: input.editionDate,
    elapsedMs: input.elapsedMs,
    nationalDailyId: input.nationalDailyId ?? null,
    packageId: input.packageId ?? null,
    storyCount: input.storyCount ?? null,
    metroKey: input.metroKey ?? null,
    editionId: input.editionId ?? null,
    message: input.message ?? null,
  });
}

async function claimNationalNewsWrite(
  admin: SupabaseClient,
  editionDate: string,
  payload: UsNationalNewsPackagePayload
): Promise<boolean> {
  const { data, error } = await admin.rpc("claim_us_national_news_write", {
    p_edition_date: editionDate,
    p_country_code: US_NATIONAL_COUNTRY_CODE,
    p_national_news: payload,
  });

  if (error) {
    console.warn("[usNationalNews] claim rpc failed", {
      editionDate,
      message: error.message,
    });
    return false;
  }
  return data === true;
}

async function fetchNationalNewsFromRow(
  admin: SupabaseClient,
  editionDate: string
): Promise<{ id: string; national_news: unknown } | null> {
  const { data, error } = await admin
    .from("kindred_us_national_daily")
    .select("id, national_news")
    .eq("edition_date", editionDate)
    .eq("country_code", US_NATIONAL_COUNTRY_CODE)
    .maybeSingle();

  if (error) {
    console.warn("[usNationalNews] fetch failed", {
      editionDate,
      message: error.message,
    });
    return null;
  }
  return data as { id: string; national_news: unknown } | null;
}

export type ResolveNationalNewsInput = {
  editionDate: string;
  editionTraceId?: string | null;
  newsApiKey?: string | null;
  anthropicApiKey?: string | null;
  nationalDailyId?: string | null;
};

export type ResolveNationalNewsResult = {
  package: UsNationalNewsPackagePayload | null;
  nationalDailyId: string | null;
  diagnostic: NationalNewsDiagnostic;
};

export async function resolveUsNationalNews(
  admin: SupabaseClient,
  input: ResolveNationalNewsInput
): Promise<ResolveNationalNewsResult> {
  const started = performance.now();
  const { editionDate } = input;

  const row = await fetchNationalNewsFromRow(admin, editionDate);
  const cached = parseNationalNewsPayload(row?.national_news);
  if (cached && row?.id && cached.editionDate === editionDate) {
    logNationalNews("national_news_cache_hit", {
      traceId: input.editionTraceId,
      editionDate,
      elapsedMs: Math.round(performance.now() - started),
      nationalDailyId: row.id,
      packageId: cached.packageId,
      storyCount: cached.stories.length,
    });
    return {
      package: cached,
      nationalDailyId: row.id,
      diagnostic: "national_news_cache_hit",
    };
  }

  if (!input.newsApiKey?.trim()) {
    logNationalNews("national_news_failed", {
      traceId: input.editionTraceId,
      editionDate,
      elapsedMs: Math.round(performance.now() - started),
      message: "missing_news_api_key",
    });
    return {
      package: null,
      nationalDailyId: row?.id ?? input.nationalDailyId ?? null,
      diagnostic: "national_news_failed",
    };
  }

  try {
    const selection = await selectNationalNewsStories({
      editionDate,
      newsApiKey: input.newsApiKey,
    });

    if (selection.selected.length < 3) {
      logNationalNews("national_news_failed", {
        traceId: input.editionTraceId,
        editionDate,
        elapsedMs: Math.round(performance.now() - started),
        message: `insufficient_candidates:${selection.selected.length}`,
      });
      return {
        package: null,
        nationalDailyId: row?.id ?? input.nationalDailyId ?? null,
        diagnostic: "national_news_failed",
      };
    }

    const edited = input.anthropicApiKey
      ? await Promise.all(
          selection.selected.map((ranked) =>
            runStoryEditorSafe(
              {
                id: ranked.story.id,
                headline: ranked.story.title,
                sourceText: ranked.story.description || ranked.story.title,
                source: ranked.story.source,
                url: ranked.story.url,
                publishedAt: ranked.story.publishedAt,
                surfaceRole: "national_news",
                locale: "en",
                selectionWhy: ranked.reasons.map((r) => r.label).slice(0, 3),
              },
              input.anthropicApiKey
            ).then((result) => ({
              ranked,
              ...nationalStoryCopyFromEdit(ranked, result),
            }))
          )
        )
      : selection.selected.map((ranked) => ({
          ranked,
          headline: ranked.story.title,
          summary: ranked.story.description || ranked.story.title,
          dek: null,
          body: [] as string[],
        }));

    const nationalDailyId = row?.id ?? input.nationalDailyId ?? crypto.randomUUID();
    const payload: UsNationalNewsPackagePayload = {
      packageId: nationalDailyId,
      editionDate,
      generatedAt: new Date().toISOString(),
      stories: edited.map(({ ranked, headline, summary, dek, body }, index) => {
        const base = buildNationalNewsStoryPayload(ranked, index + 1);
        return {
          ...base,
          headline: headline.replace(/\s+[—–|-]\s+[^—–|-]+$/, "").trim(),
          summary,
          dek,
          ...(body.length ? { body } : {}),
        };
      }),
    };

    const claimed = await claimNationalNewsWrite(admin, editionDate, payload);
    const refreshed = await fetchNationalNewsFromRow(admin, editionDate);
    const stored =
      parseNationalNewsPayload(refreshed?.national_news) ??
      (claimed ? payload : null);

    if (!stored) {
      const raced = parseNationalNewsPayload(refreshed?.national_news);
      if (raced) {
        logNationalNews("national_news_reused", {
          traceId: input.editionTraceId,
          editionDate,
          elapsedMs: Math.round(performance.now() - started),
          nationalDailyId: refreshed?.id ?? null,
          packageId: raced.packageId,
          storyCount: raced.stories.length,
        });
        return {
          package: raced,
          nationalDailyId: refreshed?.id ?? null,
          diagnostic: "national_news_reused",
        };
      }
      logNationalNews("national_news_failed", {
        traceId: input.editionTraceId,
        editionDate,
        elapsedMs: Math.round(performance.now() - started),
        message: "claim_lost_and_no_package",
      });
      return {
        package: null,
        nationalDailyId: refreshed?.id ?? null,
        diagnostic: "national_news_failed",
      };
    }

    const diagnostic: NationalNewsDiagnostic = claimed
      ? "national_news_created"
      : "national_news_reused";

    logNationalNews(diagnostic, {
      traceId: input.editionTraceId,
      editionDate,
      elapsedMs: Math.round(performance.now() - started),
      nationalDailyId: refreshed?.id ?? nationalDailyId,
      packageId: stored.packageId,
      storyCount: stored.stories.length,
    });

    return {
      package: stored,
      nationalDailyId: refreshed?.id ?? nationalDailyId,
      diagnostic,
    };
  } catch (err) {
    logNationalNews("national_news_failed", {
      traceId: input.editionTraceId,
      editionDate,
      elapsedMs: Math.round(performance.now() - started),
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      package: null,
      nationalDailyId: row?.id ?? input.nationalDailyId ?? null,
      diagnostic: "national_news_failed",
    };
  }
}

export function logNationalNewsAttachedToCity(input: {
  traceId?: string | null;
  editionDate: string;
  nationalDailyId: string;
  packageId: string;
  metroKey?: string | null;
  editionId?: string | null;
  storyCount?: number;
  elapsedMs?: number;
}): void {
  logNationalNews("national_news_attached_to_city", {
    ...input,
    elapsedMs: input.elapsedMs ?? 0,
  });
}
