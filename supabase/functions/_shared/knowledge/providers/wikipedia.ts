import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCachedSearch, setCachedSearch } from "../../images/searchCache.ts";
import {
  isDisambiguationPage,
  isUnrelatedTopic,
  MIN_KNOWLEDGE_CONFIDENCE,
  titleMatchScore,
} from "./confidence.ts";
import {
  buildOnThisDaySearchQuery,
  synthesizeEditorialSummary,
} from "./synthesize.ts";
import type {
  KnowledgeLookupResult,
  KnowledgeProvider,
  KnowledgeSearchInput,
} from "./types.ts";
import { KNOWLEDGE_CACHE_TTL_HOURS } from "./types.ts";

const WIKI_ACTION_API = "https://en.wikipedia.org/w/api.php";
const WIKI_REST_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary";
const USER_AGENT =
  "Kindred/1.0 (https://kindred.app; editorial-knowledge-engine)";
const CACHE_PROVIDER = "wikipedia_knowledge";

type WikiSearchHit = {
  title?: string;
  pageid?: number;
  snippet?: string;
};

type WikiSearchResponse = {
  query?: { search?: WikiSearchHit[] };
  error?: { code?: string; info?: string };
};

type WikiSummaryResponse = {
  title?: string;
  pageid?: number;
  extract?: string;
  description?: string;
  lang?: string;
  thumbnail?: { source?: string; width?: number; height?: number };
  coordinates?: { lat?: number; lon?: number };
  content_urls?: { desktop?: { page?: string } };
  type?: string;
};

function wikipediaEnabledInRuntime(): boolean {
  try {
    const flag = Deno.env.get("WIKIPEDIA_KNOWLEDGE_ENABLED");
    if (flag === "false" || flag === "0") return false;
    return true;
  } catch {
    return true;
  }
}

function titleToRestPath(title: string): string {
  return encodeURIComponent(title.replace(/ /g, "_"));
}

function buildAttribution(pageTitle: string, canonicalUrl: string): string {
  return `Background from Wikipedia (${pageTitle}) — ${canonicalUrl}`;
}

function buildSearchQueries(input: KnowledgeSearchInput): string[] {
  const name = input.entityName.trim();
  if (!name) return [];
  const queries = [name];
  const context = input.context?.trim();
  if (context) {
    queries.push(`${name} ${context}`);
  }
  for (const hint of input.hints ?? []) {
    const h = hint.trim();
    if (h && !queries.includes(h)) queries.push(h);
  }
  return queries.slice(0, 4);
}

async function searchWikipediaTitles(
  query: string,
  limit = 5
): Promise<WikiSearchHit[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    utf8: "1",
  });

  let res: Response;
  try {
    res = await fetch(`${WIKI_ACTION_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (err) {
    console.warn("[knowledge:wikipedia] search network error", err);
    return [];
  }

  if (res.status === 429) {
    console.warn("[knowledge:wikipedia] rate limited on search");
    return [];
  }

  const data = (await res.json()) as WikiSearchResponse;
  if (!res.ok || data.error) {
    console.warn("[knowledge:wikipedia] search failed", {
      status: res.status,
      error: data.error?.info ?? null,
    });
    return [];
  }

  return data.query?.search ?? [];
}

async function fetchWikipediaSummary(
  title: string
): Promise<WikiSummaryResponse | null> {
  const path = titleToRestPath(title);
  let res: Response;
  try {
    res = await fetch(`${WIKI_REST_SUMMARY}/${path}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.warn("[knowledge:wikipedia] summary network error", err);
    return null;
  }

  if (res.status === 404) return null;
  if (res.status === 429) {
    console.warn("[knowledge:wikipedia] rate limited on summary");
    return null;
  }
  if (!res.ok) {
    console.warn("[knowledge:wikipedia] summary failed", { status: res.status, title });
    return null;
  }

  return (await res.json()) as WikiSummaryResponse;
}

function scoreCandidate(
  query: string,
  title: string,
  extract: string,
  searchRank: number
): number {
  if (isDisambiguationPage(title, extract)) return 0;
  if (isUnrelatedTopic(title, extract, query)) return 0;
  const titleScore = titleMatchScore(query, title);
  const rankPenalty = searchRank * 0.04;
  return Math.max(0, titleScore - rankPenalty);
}

function toLookupResult(
  summary: WikiSummaryResponse,
  query: string,
  confidence: number
): KnowledgeLookupResult | null {
  const pageTitle = summary.title?.trim();
  const extract = summary.extract?.trim() ?? "";
  const pageId = summary.pageid ?? 0;
  const canonicalUrl =
    summary.content_urls?.desktop?.page ??
    (pageTitle
      ? `https://en.wikipedia.org/wiki/${titleToRestPath(pageTitle)}`
      : "");

  if (!pageTitle || !extract || !pageId || !canonicalUrl) return null;
  if (summary.type === "disambiguation") return null;
  if (isDisambiguationPage(pageTitle, extract)) return null;

  const editorialSummary = synthesizeEditorialSummary(extract);
  if (!editorialSummary) return null;

  const lat = summary.coordinates?.lat;
  const lon = summary.coordinates?.lon;

  return {
    provider: "wikipedia",
    pageTitle,
    canonicalUrl,
    editorialSummary,
    extract: extract.slice(0, 1200),
    pageId,
    language: summary.lang ?? "en",
    coordinates:
      lat != null && lon != null ? { lat, lon } : null,
    thumbnail: summary.thumbnail?.source
      ? {
          url: summary.thumbnail.source,
          width: summary.thumbnail.width,
          height: summary.thumbnail.height,
        }
      : null,
    sourceAttribution: buildAttribution(pageTitle, canonicalUrl),
    retrievedAt: new Date().toISOString(),
    confidence,
    matchedQuery: query,
  };
}

async function lookupUncached(
  input: KnowledgeSearchInput
): Promise<KnowledgeLookupResult | null> {
  const queries = buildSearchQueries(input);
  if (queries.length === 0) return null;

  let best: KnowledgeLookupResult | null = null;

  for (const query of queries) {
    const hits = await searchWikipediaTitles(query, 5);
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i]!;
      const title = hit.title?.trim();
      if (!title) continue;

      const summary = await fetchWikipediaSummary(title);
      if (!summary?.extract) continue;

      const confidence = scoreCandidate(
        input.entityName,
        summary.title ?? title,
        summary.extract,
        i
      );
      if (confidence < MIN_KNOWLEDGE_CONFIDENCE) continue;

      const candidate = toLookupResult(summary, query, confidence);
      if (!candidate) continue;

      if (!best || candidate.confidence > best.confidence) {
        best = candidate;
      }
      if (best.confidence >= 0.92) return best;
    }
  }

  return best;
}

export async function lookupWikipedia(
  admin: SupabaseClient,
  input: KnowledgeSearchInput
): Promise<KnowledgeLookupResult | null> {
  if (!wikipediaEnabledInRuntime()) return null;

  const cacheKey = JSON.stringify({
    entityName: input.entityName.trim(),
    context: input.context?.trim() ?? "",
    hints: (input.hints ?? []).map((h) => h.trim()).filter(Boolean),
  });

  const cached = await getCachedSearch<KnowledgeLookupResult>(
    admin,
    CACHE_PROVIDER,
    cacheKey
  );
  if (cached?.length) {
    const hit = cached[0]!;
    if (hit.confidence >= MIN_KNOWLEDGE_CONFIDENCE) return hit;
    return null;
  }

  const result = await lookupUncached(input);
  await setCachedSearch(admin, CACHE_PROVIDER, cacheKey, result ? [result] : []);

  // Override TTL on knowledge rows — searchCache uses image TTL by default.
  // Re-upsert with longer expiry when we have a hit.
  if (result) {
    const queryHash = await hashForCache(cacheKey);
    const expiresAt = new Date(
      Date.now() + KNOWLEDGE_CACHE_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();
    await admin
      .from("kindred_image_search_cache")
      .update({ expires_at: expiresAt })
      .eq("provider", CACHE_PROVIDER)
      .eq("query_hash", queryHash);
  }

  return result;
}

async function hashForCache(value: string): Promise<string> {
  const data = new TextEncoder().encode(`${CACHE_PROVIDER}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function lookupOnThisDaySubject(
  admin: SupabaseClient,
  onThisDay: { year: number; text: string }
): Promise<KnowledgeLookupResult | null> {
  const subject = buildOnThisDaySearchQuery(onThisDay.text);
  if (subject.length < 4) return null;
  return lookupWikipedia(admin, {
    entityName: subject,
    hints: [`${subject} history`, `${onThisDay.year} ${subject}`],
  });
}

export async function lookupHeroArtworkSubject(
  admin: SupabaseClient,
  input: { artist: string; artworkTitle?: string | null }
): Promise<KnowledgeLookupResult | null> {
  const artist = input.artist.trim();
  if (artist.length < 3) return null;

  const artistResult = await lookupWikipedia(admin, {
    entityName: artist,
    hints: input.artworkTitle
      ? [`${artist} ${input.artworkTitle.trim()}`]
      : [`${artist} artist`, `${artist} painter`],
  });
  if (artistResult) return artistResult;

  const artwork = input.artworkTitle?.trim();
  if (!artwork || artwork.length < 4) return null;
  return lookupWikipedia(admin, {
    entityName: artwork,
    hints: [`${artwork} ${artist}`, `${artwork} painting`],
  });
}

export const wikipediaKnowledgeProvider: KnowledgeProvider = {
  id: "wikipedia",
  label: "Wikipedia",
  lookup: lookupWikipedia,
};

export function isWikipediaKnowledgeEnabled(): boolean {
  return wikipediaEnabledInRuntime();
}
