import { primaryNewsCategory, interestToCategory } from "./sources.ts";
import { isNearDuplicate, normalizeTitleKey, normalizeUrlKey } from "./diversity.ts";
import { fetchWithTimeout } from "../http/fetchWithTimeout.ts";
import type { CandidateStory, StoryRankingContext } from "./types.ts";
import {
  localNewsFetchFromDate,
  LOCAL_NEWS_MAX_LEAD_AGE_HOURS,
  hoursSincePublished,
} from "../../../../lib/edition/localNewsFreshness.ts";
import {
  buildCommunityNewsQuery,
  buildStateSportsNewsQuery,
  buildWeatherNewsQuery,
} from "../../../../lib/edition/localNewsDesk.ts";

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

async function fetchHeadlines(opts: {
  apiKey: string;
  category?: string;
  pageSize?: number;
}): Promise<{ articles: NewsApiArticle[]; status: number; error: string | null }> {
  const params = new URLSearchParams({
    language: "en",
    pageSize: String(opts.pageSize ?? 10),
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

async function fetchLocalEverything(opts: {
  apiKey: string;
  query: string;
  pageSize?: number;
  /** ISO date YYYY-MM-DD — NewsAPI everything lookback start. */
  from?: string;
  now?: Date;
}): Promise<{ articles: NewsApiArticle[]; status: number; error: string | null }> {
  const from = opts.from ?? localNewsFetchFromDate(opts.now ?? new Date());
  const params = new URLSearchParams({
    q: opts.query,
    language: "en",
    sortBy: "publishedAt",
    pageSize: String(opts.pageSize ?? 8),
    from,
    apiKey: opts.apiKey,
  });

  const res = await fetchWithTimeout(
    `https://newsapi.org/v2/everything?${params.toString()}`,
    {},
    20_000
  );
  const data = await res.json();
  const articles = Array.isArray(data.articles) ? data.articles : [];
  // Defense in depth — drop anything older than the Local News ceiling.
  const now = opts.now ?? new Date();
  const freshEnough = articles.filter((a) => {
    const hours = hoursSincePublished(a.publishedAt ?? null, now);
    if (hours === null) return true;
    return hours <= LOCAL_NEWS_MAX_LEAD_AGE_HOURS;
  });
  return {
    articles: freshEnough,
    status: res.status,
    error:
      typeof data.status === "string" && data.status === "error"
        ? String(data.code ?? data.message ?? "error")
        : null,
  };
}

/**
 * Collapse same-story reprints across pools (URL, title, or near-duplicate body).
 * Prefer keeping the first (higher-priority pool order from merge).
 */
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

function localSearchQuery(ctx: StoryRankingContext): string | null {
  if (!ctx.city || ctx.city.toLowerCase() === "your area") return null;
  const parts = [ctx.city, ctx.region, ctx.state].filter(
    (p): p is string => Boolean(p && String(p).trim())
  );
  // Prefer city; append region/state for better local recall without OR spam.
  return parts.slice(0, 2).join(" ");
}

/**
 * Pull a wide candidate pool across national, interest, and local feeds.
 */
export async function fetchStoryCandidates(
  ctx: StoryRankingContext,
  apiKey: string
): Promise<CandidateStory[]> {
  const primaryCategory = primaryNewsCategory(ctx.interests);
  const secondaryInterest = ctx.interests[1] ?? null;
  const secondaryCategory = secondaryInterest
    ? interestToCategory(secondaryInterest)
    : null;
  const localQuery = localSearchQuery(ctx);

  const requests: Array<Promise<{
    label: string;
    pool: CandidateStory["pool"];
    category: string | null;
    result: Awaited<ReturnType<typeof fetchHeadlines>>;
  }>> = [
    fetchHeadlines({ apiKey, category: "general", pageSize: 12 }).then(
      (result) => ({
        label: "general",
        pool: "general" as const,
        category: "general",
        result,
      })
    ),
    fetchHeadlines({ apiKey, category: primaryCategory, pageSize: 10 }).then(
      (result) => ({
        label: `interest:${primaryCategory}`,
        pool: "interest" as const,
        category: primaryCategory,
        result,
      })
    ),
  ];

  if (secondaryCategory && secondaryCategory !== primaryCategory) {
    requests.push(
      fetchHeadlines({ apiKey, category: secondaryCategory, pageSize: 8 }).then(
        (result) => ({
          label: `secondary:${secondaryCategory}`,
          pool: "secondary" as const,
          category: secondaryCategory,
          result,
        })
      )
    );
  }

  if (localQuery) {
    const now = ctx.now ?? new Date();
    requests.push(
      fetchLocalEverything({
        apiKey,
        query: localQuery,
        pageSize: 10,
        from: localNewsFetchFromDate(now),
        now,
      }).then((result) => ({
        label: `local:${localQuery}`,
        pool: "local" as const,
        category: null,
        result,
      }))
    );
  }

  const settled = await Promise.all(requests);
  const merged: CandidateStory[] = [];

  for (const item of settled) {
    console.log("[stories] provider NewsAPI pool", {
      pool: item.label,
      httpStatus: item.result.status,
      articleCount: item.result.articles.length,
      apiError: item.result.error,
    });
    merged.push(
      ...mapArticles(item.result.articles, item.pool, item.category)
    );
  }

  const unique = dedupe(merged);
  console.log("[stories] candidate pool", {
    rawCount: merged.length,
    uniqueCount: unique.length,
    interests: ctx.interests,
    city: ctx.city,
    region: ctx.region,
    state: ctx.state,
  });

  return unique;
}

/** Local/regional pool + sports/weather/community fallback queries. */
export async function fetchLocalStoryCandidates(
  ctx: StoryRankingContext,
  apiKey: string
): Promise<CandidateStory[]> {
  const localQuery = localSearchQuery(ctx);
  const place = {
    city: ctx.city,
    state: ctx.state,
    region: ctx.region,
    metroKey: ctx.metroKey ?? null,
  };
  const sportsQuery = buildStateSportsNewsQuery(place);
  const weatherQuery = buildWeatherNewsQuery(place);
  const communityQuery = buildCommunityNewsQuery(place);

  if (!localQuery && !sportsQuery && !weatherQuery && !communityQuery) {
    console.log("[stories] local candidate pool skipped — no city/state query");
    return [];
  }

  const now = ctx.now ?? new Date();
  const from = localNewsFetchFromDate(now);

  const requests: Array<
    Promise<{
      label: string;
      category: string | null;
      result: Awaited<ReturnType<typeof fetchLocalEverything>>;
    }>
  > = [];

  if (localQuery) {
    requests.push(
      fetchLocalEverything({
        apiKey,
        query: localQuery,
        pageSize: 12,
        from,
        now,
      }).then((result) => ({
        label: `local:${localQuery}`,
        category: null,
        result,
      }))
    );
  }
  if (sportsQuery) {
    requests.push(
      fetchLocalEverything({
        apiKey,
        query: sportsQuery,
        pageSize: 10,
        from,
        now,
      }).then((result) => ({
        label: `sports:${sportsQuery.slice(0, 80)}`,
        category: "sports",
        result,
      }))
    );
  }
  if (weatherQuery) {
    requests.push(
      fetchLocalEverything({
        apiKey,
        query: weatherQuery,
        pageSize: 6,
        from,
        now,
      }).then((result) => ({
        label: `weather:${weatherQuery.slice(0, 80)}`,
        category: "weather",
        result,
      }))
    );
  }
  if (communityQuery) {
    requests.push(
      fetchLocalEverything({
        apiKey,
        query: communityQuery,
        pageSize: 6,
        from,
        now,
      }).then((result) => ({
        label: `community:${communityQuery.slice(0, 80)}`,
        category: "community",
        result,
      }))
    );
  }

  const settled = await Promise.all(requests);
  const merged: CandidateStory[] = [];
  for (const item of settled) {
    console.log("[stories] provider NewsAPI local desk pool", {
      pool: item.label,
      from,
      httpStatus: item.result.status,
      articleCount: item.result.articles.length,
      apiError: item.result.error,
      category: item.category,
    });
    merged.push(
      ...mapArticles(item.result.articles, "local", item.category)
    );
  }

  const stories = dedupe(merged);
  console.log("[stories] local candidate pool", {
    uniqueCount: stories.length,
    city: ctx.city,
    region: ctx.region,
    state: ctx.state,
    metroKey: ctx.metroKey ?? null,
    pools: settled.map((s) => s.label),
  });
  return stories;
}
