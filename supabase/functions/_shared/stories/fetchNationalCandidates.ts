/**
 * National wire pool only — no local query. Same candidates for every U.S. city.
 */

import { isNearDuplicate, normalizeTitleKey, normalizeUrlKey } from "./diversity.ts";
import { fetchWithTimeout } from "../http/fetchWithTimeout.ts";
import type { CandidateStory } from "./types.ts";

type NewsApiArticle = {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
  source?: { name?: string | null } | null;
};

function storyId(title: string, url: string | null): string {
  const base = `${title}|${url ?? ""}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash * 31 + base.charCodeAt(i)) | 0;
  }
  return `story_${Math.abs(hash)}`;
}

function mapArticles(
  articles: NewsApiArticle[],
  pool: CandidateStory["pool"],
  category: string | null
): CandidateStory[] {
  const out: CandidateStory[] = [];
  for (const a of articles) {
    const title = a.title?.trim();
    if (!title || title === "[Removed]") continue;
    const url = a.url?.trim() || null;
    out.push({
      id: storyId(title, url),
      title,
      description: a.description?.trim() || "",
      source: a.source?.name?.trim() || "Unknown",
      url,
      publishedAt: a.publishedAt ?? null,
      imageUrl: a.urlToImage?.trim() || null,
      category,
      pool,
    });
  }
  return out;
}

function dedupe(stories: CandidateStory[]): CandidateStory[] {
  const out: CandidateStory[] = [];
  const titleKeys = new Set<string>();
  const urlKeys = new Set<string>();
  for (const s of stories) {
    const titleKey = normalizeTitleKey(s.title);
    const urlKey = normalizeUrlKey(s.url);
    if (titleKey && titleKeys.has(titleKey)) continue;
    if (urlKey && urlKeys.has(urlKey)) continue;
    if (out.some((existing) => isNearDuplicate(existing, s))) continue;
    if (titleKey) titleKeys.add(titleKey);
    if (urlKey) urlKeys.add(urlKey);
    out.push(s);
  }
  return out;
}

async function fetchHeadlines(opts: {
  apiKey: string;
  category?: string;
  pageSize?: number;
}): Promise<{ articles: NewsApiArticle[]; status: number; error: string | null }> {
  const params = new URLSearchParams({
    language: "en",
    country: "us",
    pageSize: String(opts.pageSize ?? 12),
    apiKey: opts.apiKey,
  });
  if (opts.category) params.set("category", opts.category);

  const res = await fetchWithTimeout(
    `https://newsapi.org/v2/top-headlines?${params.toString()}`,
    {},
    20_000
  );
  const data = await res.json();
  return {
    articles: Array.isArray(data.articles) ? data.articles : [],
    status: res.status,
    error:
      typeof data.status === "string" && data.status === "error"
        ? String(data.code ?? data.message ?? "error")
        : null,
  };
}

/** Pull national headline pools — general plus business and science for breadth. */
export async function fetchNationalStoryCandidates(
  apiKey: string
): Promise<CandidateStory[]> {
  const pools = [
    { label: "general", category: "general", pageSize: 15 },
    { label: "business", category: "business", pageSize: 8 },
    { label: "science", category: "science", pageSize: 8 },
  ] as const;

  const settled = await Promise.all(
    pools.map(async (pool) => {
      const result = await fetchHeadlines({
        apiKey,
        category: pool.category,
        pageSize: pool.pageSize,
      });
      console.log("[stories] national NewsAPI pool", {
        pool: pool.label,
        httpStatus: result.status,
        articleCount: result.articles.length,
        apiError: result.error,
      });
      return mapArticles(result.articles, "general", pool.category);
    })
  );

  const merged = settled.flat();
  const unique = dedupe(merged);
  console.log("[stories] national candidate pool", {
    rawCount: merged.length,
    uniqueCount: unique.length,
  });
  return unique;
}
