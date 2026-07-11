import type {
  MemoryCandidate,
  MemoryRankingContext,
  MemoryReason,
  MemoryThread,
} from "./types.ts";

export type ScoredMemoryCandidate = {
  candidate: MemoryCandidate;
  score: number;
  reasons: MemoryReason[];
  thread: MemoryThread;
};

/**
 * Score a memory candidate — continuity and relevance first,
 * integrity weight keeps memory from overpowering editorial judgment.
 */
export function scoreMemoryCandidate(
  candidate: MemoryCandidate,
  _ctx: MemoryRankingContext
): ScoredMemoryCandidate {
  const reasons: MemoryReason[] = [];
  let score = 0;

  const continuity = candidate.scoreHints.continuity * 22;
  score += continuity;
  reasons.push({
    code: "continuity",
    label: "Continues a relationship with this reader",
    weight: continuity,
  });

  const relevance = candidate.scoreHints.relevance * 16;
  score += relevance;
  if (relevance >= 6) {
    reasons.push({
      code: "relevance",
      label: "Relevant to today’s edition or past reading",
      weight: relevance,
    });
  }

  // Integrity is a soft ceiling — high integrity preferred; never invent urgency.
  const integrity = candidate.scoreHints.integrity * 10;
  score += integrity;
  reasons.push({
    code: "editorial_integrity",
    label: "Does not override today’s editorial selection",
    weight: integrity,
  });

  const typeBoost: Record<string, number> = {
    since_you_last_read: 12,
    continuing_news: 10,
    unfinished_reading: 9,
    long_term_interest: 8,
    followed_story: 8,
    knowledge_continuity: 7,
    saved_discovery: 7,
    ongoing_timeline: 6,
    reading_streak: 6,
    previous_reading: 5,
    recurring_event: 4,
    favorite_location: 4,
    travel_history: 5,
  };
  const boost = typeBoost[candidate.thread.type] ?? 2;
  score += boost;
  reasons.push({
    code: `memory_${candidate.thread.type}`,
    label: threadLabel(candidate.thread.type),
    weight: boost,
  });

  // Soft penalty when linked to skipped topics
  const topic = candidate.thread.topic?.toLowerCase() ?? "";
  if (
    topic &&
    (_ctx.skippedTopics ?? []).some((s) => topic.includes(s.toLowerCase()))
  ) {
    score -= 8;
    reasons.push({
      code: "skip_guard",
      label: "Softened — reader has stepped away from this topic",
      weight: -8,
    });
  }

  const thread: MemoryThread = {
    ...candidate.thread,
    reasons: reasons.sort((a, b) => b.weight - a.weight),
  };

  return { candidate, score, reasons: thread.reasons, thread };
}

function threadLabel(type: string): string {
  switch (type) {
    case "since_you_last_read":
      return "Since you last read";
    case "continuing_news":
      return "Continuing news thread";
    case "unfinished_reading":
      return "Unfinished reading";
    case "long_term_interest":
      return "Long-term interest";
    case "followed_story":
      return "Followed story";
    case "knowledge_continuity":
      return "Knowledge continuity";
    case "saved_discovery":
      return "Saved discovery";
    case "ongoing_timeline":
      return "Ongoing timeline";
    case "reading_streak":
      return "Morning reading continuity";
    case "previous_reading":
      return "Previous reading";
    case "recurring_event":
      return "Recurring local event";
    case "favorite_location":
      return "Favorite location";
    case "travel_history":
      return "Travel memory";
    default:
      return "Reader memory";
  }
}
