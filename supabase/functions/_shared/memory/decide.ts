import { buildMemoryCandidates } from "./catalog.ts";
import { continuityDays, daysBetween } from "./extract.ts";
import { scoreMemoryCandidate } from "./score.ts";
import {
  buildSinceYouLastRead,
  linkThreadsToStories,
  selectMemoryThreads,
  whyThread,
} from "./select.ts";
import type { MemoryPayload, MemoryRankingContext } from "./types.ts";

/**
 * Memory Engine entry point — reusable for every section and article.
 * Builds long-term reader continuity at edition build time.
 * Does not rewrite the newspaper or override editorial selection.
 */
export function runMemoryDecisions(
  input: MemoryRankingContext
): MemoryPayload {
  const now = input.now ?? new Date();
  const ctx: MemoryRankingContext = {
    ...input,
    now,
    todayStories: dedupeStories(input.todayStories),
  };

  const candidates = buildMemoryCandidates(ctx);
  const scored = candidates.map((c) => scoreMemoryCandidate(c, ctx));
  const threads = selectMemoryThreads(scored, ctx.maxThreads ?? 14);
  const byStoryKey = linkThreadsToStories(
    threads,
    ctx.todayStories,
    scored
  );
  const sinceYouLastRead = buildSinceYouLastRead(threads);

  const editionDates = (ctx.priorEditions ?? []).map((p) => p.editionDate);
  const continuity = continuityDays(editionDates, ctx.editionDate);
  const lastEditionDate = editionDates[0] ?? null;

  const highlights = threads.slice(0, 16).map((t) => ({
    threadId: t.id,
    type: t.type,
    title: t.title,
    why: whyThread(t),
  }));

  const editorBrief = [
    `Memory brief for ${ctx.editionDate}.`,
    `Threads: ${threads.length}. Continuity mornings: ${continuity || 1}.`,
    lastEditionDate
      ? `Last edition: ${lastEditionDate} (${daysBetween(lastEditionDate, ctx.editionDate)} day(s) away).`
      : "First remembered edition for this reader.",
    "Memory informs relationship — it never overrides editorial selection.",
    ...highlights.slice(0, 6).map(
      (h) => `- ${h.type}: ${h.title.slice(0, 60)} — ${h.why.slice(0, 70)}`
    ),
  ].join("\n");

  const streakThread = threads.find((t) => t.type === "reading_streak");
  const continuityDaysOut =
    continuity ||
    streakThread?.data?.continuityDays ||
    (editionDates.length > 0 ? 1 : 0);

  const payload: MemoryPayload = {
    version: 1,
    generatedAt: now.toISOString(),
    editionDate: ctx.editionDate,
    location: {
      city: ctx.location.city,
      region: ctx.location.region,
      state: ctx.location.state,
    },
    reader: {
      confidence: ctx.confidence ?? 0,
      continuityDays: continuityDaysOut,
      lastEditionDate,
      lastReadAt: ctx.lastReadAt ?? null,
    },
    threads,
    byStoryKey,
    sinceYouLastRead,
    highlights,
    editorBrief,
    selectionMeta: {
      threadCount: threads.length,
      candidateCount: candidates.length,
      editorialIntegrity: true,
      editorNotes: [
        "Long-term relationship memory — subscriber newspaper spirit.",
        "Reading continuity is quiet habit, not a streak badge.",
        "No new newspaper sections; threads attach by story id when relevant.",
      ],
    },
  };

  console.log("[memory] decisions", {
    threadCount: threads.length,
    candidateCount: candidates.length,
    continuityDays: payload.reader.continuityDays,
    unfinished: (ctx.unfinishedReads ?? []).length,
    city: ctx.location.city,
  });

  return payload;
}

function dedupeStories(
  stories: MemoryRankingContext["todayStories"]
): MemoryRankingContext["todayStories"] {
  const map = new Map<string, (typeof stories)[number]>();
  for (const s of stories) {
    if (!s.storyKey || !s.headline) continue;
    if (!map.has(s.storyKey)) map.set(s.storyKey, s);
  }
  return Array.from(map.values());
}
