import type {
  MemoryPayload,
  MemoryStoryInput,
  MemoryThread,
  MemoryThreadType,
} from "./types.ts";
import type { ScoredMemoryCandidate } from "./score.ts";

const DEFAULT_MAX = 14;

const TYPE_CAP: Partial<Record<MemoryThreadType, number>> = {
  since_you_last_read: 1,
  reading_streak: 1,
  continuing_news: 3,
  ongoing_timeline: 2,
  long_term_interest: 3,
  followed_story: 2,
  previous_reading: 2,
  unfinished_reading: 3,
  saved_discovery: 3,
  knowledge_continuity: 2,
  recurring_event: 2,
  favorite_location: 1,
  travel_history: 1,
};

/**
 * Select a calm, diverse set of memory threads for the edition.
 * Memory informs relationship — never floods the paper.
 */
export function selectMemoryThreads(
  scored: ScoredMemoryCandidate[],
  maxThreads = DEFAULT_MAX
): MemoryThread[] {
  const ordered = [...scored].sort((a, b) => b.score - a.score);
  const selected: MemoryThread[] = [];
  const typeCounts = new Map<MemoryThreadType, number>();
  const titles = new Set<string>();

  for (const candidate of ordered) {
    if (selected.length >= maxThreads) break;
    const type = candidate.thread.type;
    const count = typeCounts.get(type) ?? 0;
    const cap = TYPE_CAP[type] ?? 2;
    if (count >= cap) continue;

    const titleKey = candidate.thread.title.toLowerCase().slice(0, 80);
    if (titles.has(titleKey)) continue;

    // Drop negative-scored skip-guarded threads
    if (candidate.score < 8) continue;

    selected.push(candidate.thread);
    typeCounts.set(type, count + 1);
    titles.add(titleKey);
  }

  return selected;
}

export function linkThreadsToStories(
  threads: MemoryThread[],
  stories: MemoryStoryInput[],
  scored: ScoredMemoryCandidate[]
): MemoryPayload["byStoryKey"] {
  const byStoryKey: MemoryPayload["byStoryKey"] = {};

  for (const story of stories) {
    const linked = scored
      .filter(
        (s) =>
          threads.some((t) => t.id === s.thread.id) &&
          (s.candidate.linkedStoryKeys.includes(story.storyKey) ||
            s.thread.storyKeys?.includes(story.storyKey))
      )
      .slice(0, 4);

    if (!linked.length) continue;
    byStoryKey[story.storyKey] = {
      threadIds: linked.map((l) => l.thread.id),
      notes: linked.map((l) => l.thread.title),
    };
  }

  return byStoryKey;
}

export function whyThread(thread: MemoryThread): string {
  const top = thread.reasons
    ?.filter((r) => r.weight > 0 && !r.code.startsWith("memory_"))
    .slice(0, 2)
    .map((r) => r.label);
  return top?.join(" ") || thread.summary.slice(0, 120);
}

export function buildSinceYouLastRead(
  threads: MemoryThread[]
): MemoryPayload["sinceYouLastRead"] {
  const since = threads.find((t) => t.type === "since_you_last_read");
  if (!since) return null;

  const continuing = threads.find((t) => t.type === "continuing_news");
  const unfinished = threads.find((t) => t.type === "unfinished_reading");
  const daysAway = since.data?.daysAway ?? null;

  const continuingHeadline = threadHeadline(continuing);
  const unfinishedHeadline = threadHeadline(unfinished);
  const priorLead =
    typeof since.data?.headline === "string"
      ? since.data.headline.trim()
      : "";

  const highlights = threads
    .filter((t) =>
      ["continuing_news", "unfinished_reading", "long_term_interest"].includes(
        t.type
      )
    )
    .slice(0, 4)
    .map((t) => highlightLabel(t))
    .filter(Boolean);

  // Specific continuity beats generic ritual copy — readers remember named threads.
  let summary = since.summary;
  if (unfinishedHeadline) {
    const title = clipHeadline(unfinishedHeadline);
    summary =
      daysAway === 1
        ? `You left off mid-read on “${title}.” It’s still waiting in the paper.`
        : `You left off mid-read on “${title}.” It’s been ${daysAway} days — pick it up when you’re ready.`;
  } else if (continuingHeadline) {
    const title = clipHeadline(continuingHeadline);
    summary =
      daysAway === 1
        ? `Yesterday’s coverage of “${title}” continues in today’s paper.`
        : `A thread from ${daysAway} days ago — “${title}” — continues today.`;
  } else if (priorLead) {
    const title = clipHeadline(priorLead);
    summary =
      daysAway === 1
        ? `Yesterday led with “${title}.” Today’s edition continues the conversation.`
        : `It’s been ${daysAway} days. Last time, the paper opened on “${title}.”`;
  }

  return {
    title: since.title,
    summary,
    daysAway,
    highlights,
  };
}

function threadHeadline(thread: MemoryThread | undefined): string | null {
  if (!thread) return null;
  const fromData = thread.data?.headline?.trim();
  if (fromData) return fromData;
  const quoted = thread.summary.match(/[“"]([^”"]+)[”"]/);
  return quoted?.[1]?.trim() || null;
}

function highlightLabel(thread: MemoryThread): string {
  const headline = threadHeadline(thread);
  if (headline) return clipHeadline(headline, 120);
  if (thread.type === "long_term_interest") {
    return thread.title.replace(/^An ongoing interest:\s*/i, "").trim();
  }
  return thread.title;
}

function clipHeadline(value: string, max = 90): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
}
