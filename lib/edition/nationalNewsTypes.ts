/**
 * Shared U.S. National News — pure types and parsers (no article graph).
 */

export type NationalNewsImage = {
  url: string | null;
  attribution: string | null;
  licenseNote: string | null;
};

export type NationalNewsVerification = {
  editorialScore: number;
  reasons: string[];
  pool: string;
};

export type NationalNewsStory = {
  id: string;
  rank: number;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  category: string | null;
  image: NationalNewsImage | null;
  verification: NationalNewsVerification;
};

export type NationalNewsPackage = {
  packageId: string;
  editionDate: string;
  generatedAt: string;
  stories: NationalNewsStory[];
};

export type LegacyTopStoryItem = {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
  role?: string | null;
};

export function parseNationalNewsPackage(raw: unknown): NationalNewsPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as NationalNewsPackage;
  if (!row.packageId?.trim() || !row.editionDate?.trim()) return null;
  if (!Array.isArray(row.stories) || row.stories.length === 0) return null;

  const stories = row.stories
    .filter(
      (s) =>
        s?.id?.trim() &&
        s?.headline?.trim() &&
        s?.summary?.trim() &&
        s?.sourceName?.trim()
    )
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  if (stories.length === 0) return null;

  return {
    packageId: row.packageId,
    editionDate: row.editionDate,
    generatedAt: row.generatedAt ?? "",
    stories,
  };
}

export function nationalNewsFromEdition(edition: {
  national_news?: unknown;
} | null | undefined): NationalNewsPackage | null {
  return parseNationalNewsPackage(edition?.national_news);
}

export function nationalNewsFromLegacyTopStories(
  topStories: LegacyTopStoryItem[],
  editionDate: string
): NationalNewsPackage | null {
  const national = topStories.filter((s) => !/local/i.test(s.role ?? ""));
  if (national.length === 0) return null;

  return {
    packageId: `legacy:${editionDate}`,
    editionDate,
    generatedAt: "",
    stories: national.map((s, index) => ({
      id: s.id,
      rank: index + 1,
      headline: s.headline,
      summary: s.summary,
      sourceName: s.source,
      sourceUrl: s.url,
      publishedAt: s.publishedAt ?? null,
      category: s.role ?? null,
      image: s.imageUrl
        ? { url: s.imageUrl, attribution: s.source, licenseNote: null }
        : null,
      verification: {
        editorialScore: 0,
        reasons: ["legacy_top_stories_adapter"],
        pool: "legacy",
      },
    })),
  };
}

export function resolveNationalNewsForRender(input: {
  edition?: { national_news?: unknown } | null;
  topStories?: LegacyTopStoryItem[];
  editionDate?: string | null;
}): NationalNewsPackage | null {
  const fromColumn = nationalNewsFromEdition(input.edition ?? null);
  if (fromColumn) return fromColumn;
  if (input.topStories?.length && input.editionDate) {
    return nationalNewsFromLegacyTopStories(input.topStories, input.editionDate);
  }
  return null;
}

export function nationalNewsStoryIds(pkg: NationalNewsPackage | null): string[] {
  return pkg?.stories.map((s) => s.id) ?? [];
}

export function localTopStoriesOnly<T extends { role?: string | null }>(
  topStories: T[]
): T[] {
  return topStories.filter((s) => /local/i.test(s.role ?? ""));
}

/** Mirrors claim_us_national_news_write — only first writer when national_news is null. */
export function simulateNationalNewsClaim(
  store: { national_news: NationalNewsPackage | null },
  incoming: NationalNewsPackage
): { claimed: boolean; stored: NationalNewsPackage | null } {
  if (store.national_news) {
    return { claimed: false, stored: store.national_news };
  }
  store.national_news = incoming;
  return { claimed: true, stored: incoming };
}
