export type NationalNewsImagePayload = {
  url: string | null;
  attribution: string | null;
  licenseNote: string | null;
};

export type NationalNewsVerificationPayload = {
  editorialScore: number;
  reasons: string[];
  pool: string;
};

export type NationalNewsStoryPayload = {
  id: string;
  rank: number;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  category: string | null;
  image: NationalNewsImagePayload | null;
  verification: NationalNewsVerificationPayload;
};

export type UsNationalNewsPackagePayload = {
  packageId: string;
  editionDate: string;
  generatedAt: string;
  stories: NationalNewsStoryPayload[];
};

export type NationalNewsDiagnostic =
  | "national_news_cache_hit"
  | "national_news_created"
  | "national_news_reused"
  | "national_news_failed";
