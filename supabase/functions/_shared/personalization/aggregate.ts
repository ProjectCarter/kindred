import type {
  AffinityWeight,
  PersonalizationAffinities,
  ReadingSignalRow,
} from "./types.ts";

const SIGNAL_WEIGHTS: Record<string, number> = {
  clip: 5,
  read_complete: 4,
  source_engage: 3,
  read_progress: 1.5,
  open: 1,
  skip: -3,
  unclip: -2,
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bump(
  map: Map<string, number>,
  key: string | null | undefined,
  delta: number
) {
  const k = key ? normalizeKey(key) : "";
  if (!k || k.length < 2) return;
  map.set(k, (map.get(k) ?? 0) + delta);
}

function toSortedAffinities(
  map: Map<string, number>,
  minWeight = 1.5,
  limit = 8
): AffinityWeight[] {
  return Array.from(map.entries())
    .filter(([, w]) => w >= minWeight)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, weight]) => ({ key, weight: Number(weight.toFixed(2)) }));
}

/**
 * Turn raw reading signals into quiet ranking affinities.
 * Caps keep personalization from overpowering editorial judgment.
 */
export function aggregateReadingSignals(
  signals: ReadingSignalRow[]
): PersonalizationAffinities {
  const sources = new Map<string, number>();
  const topics = new Map<string, number>();
  const skips = new Map<string, number>();
  const engaged = new Set<string>();
  const clipped = new Set<string>();

  for (const row of signals) {
    const base = SIGNAL_WEIGHTS[row.signal_type] ?? 0;
    if (!base) continue;

    // Progress-weighted dwell for read_progress.
    let delta = base;
    if (row.signal_type === "read_progress" && row.payload) {
      const dwell = Number(row.payload.dwell_ms ?? 0);
      const scroll = Number(row.payload.scroll_pct ?? 0);
      if (dwell >= 45_000 || scroll >= 60) delta = 3;
      else if (dwell < 8_000 && scroll < 15) delta = 0.25;
    }

    if (row.signal_type === "skip") {
      bump(skips, row.topic ?? row.section_type, Math.abs(delta));
      bump(topics, row.topic ?? row.section_type, delta);
      continue;
    }

    if (row.signal_type === "clip") {
      clipped.add(row.story_key);
      engaged.add(row.story_key);
    }
    if (
      row.signal_type === "open" ||
      row.signal_type === "read_complete" ||
      row.signal_type === "source_engage"
    ) {
      engaged.add(row.story_key);
    }

    bump(sources, row.source, delta);
    bump(topics, row.topic ?? row.section_type, delta);
  }

  const favoriteSources = toSortedAffinities(sources, 2, 6);
  const followedTopics = toSortedAffinities(
    new Map(
      Array.from(topics.entries()).filter(([, w]) => w > 0)
    ),
    2,
    8
  );
  const skippedTopics = toSortedAffinities(skips, 2, 6);

  const positiveCount = signals.filter((s) =>
    ["clip", "read_complete", "source_engage", "open"].includes(s.signal_type)
  ).length;
  const confidence = Math.min(1, positiveCount / 12);

  return {
    favoriteSources,
    followedTopics,
    skippedTopics,
    engagedStoryKeys: Array.from(engaged).slice(0, 40),
    clippedStoryKeys: Array.from(clipped).slice(0, 40),
    confidence,
  };
}

export function mergeTopicLists(
  profileTopics: string[],
  affinityTopics: AffinityWeight[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of [...profileTopics, ...affinityTopics.map((a) => a.key)]) {
    const n = normalizeKey(t);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(t.trim());
  }
  return out.slice(0, 12);
}

export function mergeSourceLists(
  profileSources: string[],
  affinitySources: AffinityWeight[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [...affinitySources.map((a) => a.key), ...profileSources]) {
    const n = normalizeKey(s);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(s.trim());
  }
  return out.slice(0, 10);
}
