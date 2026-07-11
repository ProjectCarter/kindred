import type { CandidateStory } from "./types.ts";

/** Normalize publisher name for source-diversity caps. */
export function normalizeSourceKey(source: string): string {
  return source
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|inc|llc|ltd|com|news|online)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Compact title key for exact-ish duplicate detection. */
export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+[—–|-]\s+[^—–|-]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
}

/** Strip tracking/query noise so the same article URL collapses. */
export function normalizeUrlKey(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase().split("?")[0]?.replace(/\/+$/, "") ?? null;
  }
}

export function hoursSince(
  publishedAt: string | null | undefined,
  now: Date
): number | null {
  if (!publishedAt) return null;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / (1000 * 60 * 60);
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3)
  );
}

/** Token overlap — higher means more similar. */
export function tokenOverlap(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  for (const t of A) if (B.has(t)) overlap += 1;
  return overlap / Math.min(A.size, B.size);
}

/**
 * True when two candidates are the same story told twice —
 * same URL, same title key, or high semantic overlap.
 */
export function isNearDuplicate(
  a: CandidateStory,
  b: CandidateStory,
  similarityLimit = 0.72
): boolean {
  if (a.id === b.id) return true;

  const urlA = normalizeUrlKey(a.url);
  const urlB = normalizeUrlKey(b.url);
  if (urlA && urlB && urlA === urlB) return true;

  const titleA = normalizeTitleKey(a.title);
  const titleB = normalizeTitleKey(b.title);
  if (titleA && titleB && titleA === titleB) return true;

  const overlap = tokenOverlap(
    `${a.title} ${a.description}`,
    `${b.title} ${b.description}`
  );
  return overlap >= similarityLimit;
}

/**
 * Match against recently shown keys (titles, ids, or url keys)
 * with fuzzy title tolerance — the paper should not feel repetitive day to day.
 */
export function matchesRecentCoverage(
  story: CandidateStory,
  recentKeys: string[],
  fuzzyLimit = 0.68
): boolean {
  if (!recentKeys.length) return false;
  const titleKey = normalizeTitleKey(story.title);
  const urlKey = normalizeUrlKey(story.url);
  const hay = `${story.title} ${story.description}`;

  for (const raw of recentKeys) {
    const key = raw.trim();
    if (!key) continue;
    const normalized = normalizeTitleKey(key);
    if (titleKey && normalized && titleKey === normalized) return true;
    if (urlKey && normalizeUrlKey(key) === urlKey) return true;
    if (story.id && key === story.id) return true;
    if (tokenOverlap(hay, key) >= fuzzyLimit) return true;
  }
  return false;
}

export type CompositionAudit = {
  uniqueSources: number;
  uniqueCategories: number;
  roles: string[];
  hasLocal: boolean;
  hasNationalOrWorld: boolean;
  hasInterest: boolean;
  hasFeature: boolean;
  avgFreshnessHours: number | null;
  editorNotes: string[];
};

/**
 * Invisible editor notes describing why the slate feels curated.
 */
export function auditComposition(
  stories: Array<{
    role: string;
    source: string;
    category?: string | null;
    publishedAt?: string | null;
  }>,
  now: Date
): CompositionAudit {
  const sources = new Set(
    stories.map((s) => normalizeSourceKey(s.source)).filter(Boolean)
  );
  const categories = new Set(
    stories.map((s) => (s.category ?? s.role).toLowerCase()).filter(Boolean)
  );
  const roles = stories.map((s) => s.role);
  const hours = stories
    .map((s) => hoursSince(s.publishedAt ?? null, now))
    .filter((h): h is number => h !== null);

  const editorNotes: string[] = [];
  if (sources.size >= Math.min(stories.length, 3)) {
    editorNotes.push("Source diversity across the front page");
  }
  if (categories.size >= Math.min(stories.length, 3)) {
    editorNotes.push("Topic variety across the slate");
  }
  if (roles.includes("local") && (roles.includes("national") || roles.includes("breaking"))) {
    editorNotes.push("Local and national balance");
  }
  if (roles.includes("feature")) {
    editorNotes.push("Feature included for tonal balance");
  }
  if (hours.length && hours.every((h) => h <= 36)) {
    editorNotes.push("Fresh wire copy for this morning");
  }

  return {
    uniqueSources: sources.size,
    uniqueCategories: categories.size,
    roles,
    hasLocal: roles.includes("local"),
    hasNationalOrWorld:
      roles.includes("national") || roles.includes("breaking"),
    hasInterest: roles.includes("interest"),
    hasFeature: roles.includes("feature"),
    avgFreshnessHours: hours.length
      ? hours.reduce((a, b) => a + b, 0) / hours.length
      : null,
    editorNotes,
  };
}
