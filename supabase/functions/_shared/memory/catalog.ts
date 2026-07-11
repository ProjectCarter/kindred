import {
  continuityDays,
  daysBetween,
  slugId,
  tokenOverlap,
} from "./extract.ts";
import type {
  MemoryCandidate,
  MemoryRankingContext,
} from "./types.ts";

/**
 * Build memory candidates from reader history + today’s slate.
 * Providers can extend this catalog later; sections share the same engine.
 */
export function buildMemoryCandidates(
  ctx: MemoryRankingContext
): MemoryCandidate[] {
  const out: MemoryCandidate[] = [];
  const stories = ctx.todayStories;
  const priors = ctx.priorEditions ?? [];
  const editionDates = priors.map((p) => p.editionDate);
  const lastEdition = priors[0]?.editionDate ?? null;
  const daysAway = lastEdition
    ? daysBetween(lastEdition, ctx.editionDate)
    : null;

  // Reading continuity (quiet habit — not a badge)
  const streak = continuityDays(editionDates, ctx.editionDate);
  if (streak >= 2 || (ctx.openDays ?? []).length >= 2) {
    const days = Math.max(streak, Math.min((ctx.openDays ?? []).length, 14), 1);
    out.push({
      thread: {
        id: slugId("streak", ctx.editionDate),
        type: "reading_streak",
        title: "A morning habit",
        summary:
          days >= 3
            ? `Kindred has been part of your mornings for ${days} days in a row — continuity, not a scoreboard.`
            : "You’re building a quiet reading rhythm with the morning paper.",
        since: lastEdition,
        data: { continuityDays: days, editionDates: editionDates.slice(0, 14) },
      },
      linkedStoryKeys: [],
      scoreHints: { continuity: 0.95, relevance: 0.4, integrity: 1 },
    });
  }

  // Since you last read
  if (daysAway != null && daysAway >= 1) {
    const priorHeadlines = priors
      .slice(0, 2)
      .flatMap((p) => [
        p.lead?.headline,
        ...(p.topStories ?? []).map((t) => t.title),
      ])
      .filter(Boolean) as string[];

    out.push({
      thread: {
        id: slugId("since", lastEdition ?? ctx.editionDate),
        type: "since_you_last_read",
        title: "Since you last read",
        summary:
          daysAway === 1
            ? "Yesterday’s paper is still close — today’s edition continues the conversation."
            : `It’s been ${daysAway} days since your last Kindred edition. Here’s where the paper picks up.`,
        since: lastEdition,
        data: {
          daysAway,
          headline: priorHeadlines[0],
          editionDates: lastEdition ? [lastEdition] : [],
        },
      },
      linkedStoryKeys: stories.map((s) => s.storyKey),
      scoreHints: {
        continuity: 0.9,
        relevance: daysAway >= 2 ? 0.85 : 0.65,
        integrity: 1,
      },
    });
  }

  // Long-term interests
  for (const topic of (ctx.followedTopics ?? []).slice(0, 6)) {
    const linked = stories
      .filter(
        (s) =>
          tokenOverlap(`${s.headline} ${s.summary}`, topic) >= 0.15 ||
          (s.category &&
            tokenOverlap(s.category, topic) >= 0.4)
      )
      .map((s) => s.storyKey);

    out.push({
      thread: {
        id: slugId("interest", topic),
        type: "long_term_interest",
        title: `An ongoing interest: ${topic}`,
        summary: linked.length
          ? `Today’s paper returns to ${topic} — a subject you’ve followed over time.`
          : `${topic} remains part of your long-term reading identity.`,
        topic,
        storyKeys: linked,
      },
      linkedStoryKeys: linked,
      scoreHints: {
        continuity: 0.8,
        relevance: linked.length ? 0.85 : 0.45,
        integrity: 0.95,
      },
    });
  }

  // Continuing news — overlap with prior edition headlines
  const priorTitles: Array<{ key: string; title: string; date: string }> = [];
  for (const ed of priors.slice(0, 7)) {
    if (ed.lead?.headline) {
      priorTitles.push({
        key: ed.lead.id ?? ed.lead.headline,
        title: ed.lead.headline,
        date: ed.editionDate,
      });
    }
    for (const t of ed.topStories ?? []) {
      if (t.title) {
        priorTitles.push({
          key: t.id ?? t.title,
          title: t.title,
          date: ed.editionDate,
        });
      }
    }
  }

  for (const story of stories) {
    let best: { title: string; date: string; overlap: number; key: string } | null =
      null;
    for (const prior of priorTitles) {
      const overlap = tokenOverlap(
        `${story.headline} ${story.summary}`,
        prior.title
      );
      if (overlap < 0.28) continue;
      if (!best || overlap > best.overlap) {
        best = { ...prior, overlap };
      }
    }
    if (!best) continue;

    out.push({
      thread: {
        id: slugId("continue", `${story.storyKey}-${best.date}`),
        type: "continuing_news",
        title: "A story that continues",
        summary: `Related to earlier coverage (“${best.title.slice(0, 90)}”) from ${best.date}.`,
        since: best.date,
        storyKeys: [story.storyKey, best.key],
        data: { headline: best.title, editionDates: [best.date] },
      },
      linkedStoryKeys: [story.storyKey],
      scoreHints: {
        continuity: 0.88,
        relevance: best.overlap,
        integrity: 0.95,
      },
    });

    out.push({
      thread: {
        id: slugId("timeline", story.storyKey),
        type: "ongoing_timeline",
        title: "An ongoing timeline",
        summary: `This thread has run across editions — from ${best.date} into today’s paper.`,
        since: best.date,
        storyKeys: [story.storyKey],
        data: {
          headline: story.headline,
          editionDates: [best.date, ctx.editionDate],
        },
      },
      linkedStoryKeys: [story.storyKey],
      scoreHints: {
        continuity: 0.82,
        relevance: best.overlap * 0.9,
        integrity: 0.95,
      },
    });
  }

  // Followed / previously engaged stories that resurface
  for (const key of (ctx.engagedStoryKeys ?? []).slice(0, 20)) {
    for (const story of stories) {
      const overlap = tokenOverlap(story.headline, key);
      if (overlap < 0.3) continue;
      out.push({
        thread: {
          id: slugId("followed", `${story.storyKey}-${key.slice(0, 20)}`),
          type: "followed_story",
          title: "A story you’ve followed",
          summary: `You’ve spent time with related coverage before — today’s piece continues that thread.`,
          storyKeys: [story.storyKey],
          data: { headline: key.slice(0, 120) },
        },
        linkedStoryKeys: [story.storyKey],
        scoreHints: {
          continuity: 0.75,
          relevance: overlap,
          integrity: 0.9,
        },
      });
    }
  }

  // Previous reading
  for (const key of (ctx.engagedStoryKeys ?? []).slice(0, 8)) {
    out.push({
      thread: {
        id: slugId("prevread", key),
        type: "previous_reading",
        title: "From earlier reading",
        summary: `You spent time with “${key.slice(0, 100)}” — the paper remembers.`,
        data: { headline: key.slice(0, 160) },
      },
      linkedStoryKeys: stories
        .filter((s) => tokenOverlap(s.headline, key) >= 0.25)
        .map((s) => s.storyKey),
      scoreHints: { continuity: 0.7, relevance: 0.55, integrity: 0.95 },
    });
  }

  // Saved discoveries / clippings
  for (const clip of (ctx.clippings ?? []).slice(0, 10)) {
    const label = clip.headline || clip.storyKey;
    const linked = stories
      .filter(
        (s) =>
          tokenOverlap(s.headline, label) >= 0.2 ||
          s.storyKey === clip.storyKey
      )
      .map((s) => s.storyKey);

    out.push({
      thread: {
        id: slugId("saved", clip.storyKey),
        type: "saved_discovery",
        title: "A saved clipping",
        summary: `You saved “${label.slice(0, 100)}” — still part of your Kindred library.`,
        since: clip.createdAt?.slice(0, 10) ?? null,
        storyKeys: [clip.storyKey, ...linked],
        data: {
          headline: label.slice(0, 160),
          category: clip.sectionType ?? undefined,
        },
      },
      linkedStoryKeys: linked,
      scoreHints: {
        continuity: 0.85,
        relevance: linked.length ? 0.8 : 0.5,
        integrity: 1,
      },
    });
  }

  // Prior discovery picks as saved discovery memory
  for (const ed of priors.slice(0, 3)) {
    for (const pick of (ed.discoveryPicks ?? []).slice(0, 4)) {
      out.push({
        thread: {
          id: slugId("disc", `${ed.editionDate}-${pick.title}`),
          type: "saved_discovery",
          title: pick.title,
          summary:
            pick.why ||
            `A discovery from ${ed.editionDate} — still available as editorial memory.`,
          since: ed.editionDate,
          data: { category: pick.category, editionDates: [ed.editionDate] },
        },
        linkedStoryKeys: [],
        scoreHints: { continuity: 0.6, relevance: 0.4, integrity: 0.95 },
      });
    }
  }

  // Knowledge continuity from prior knowledge highlights
  for (const ed of priors.slice(0, 3)) {
    for (const h of (ed.knowledgeHighlights ?? []).slice(0, 4)) {
      const linked = stories
        .filter(
          (s) =>
            (h.storyKey && s.storyKey === h.storyKey) ||
            tokenOverlap(s.headline, h.headline) >= 0.25
        )
        .map((s) => s.storyKey);

      out.push({
        thread: {
          id: slugId("know", `${ed.editionDate}-${h.headline}`),
          type: "knowledge_continuity",
          title: "Context that carries forward",
          summary:
            h.why ||
            `Earlier knowledge around “${h.headline.slice(0, 80)}” still frames today’s reading.`,
          since: ed.editionDate,
          storyKeys: linked,
          data: {
            facetType: h.facetType,
            headline: h.headline.slice(0, 160),
            editionDates: [ed.editionDate],
          },
        },
        linkedStoryKeys: linked,
        scoreHints: {
          continuity: 0.78,
          relevance: linked.length ? 0.75 : 0.4,
          integrity: 0.95,
        },
      });
    }
  }

  // Unfinished reading
  for (const u of (ctx.unfinishedReads ?? []).slice(0, 8)) {
    out.push({
      thread: {
        id: slugId("unfinished", u.storyKey),
        type: "unfinished_reading",
        title: "Where you left off",
        summary: `You paused around ${Math.round(u.scrollPct)}% through “${(u.headline || u.storyKey).slice(0, 90)}”.`,
        since: u.updatedAt.slice(0, 10),
        storyKeys: [u.storyKey],
        data: {
          scrollPct: u.scrollPct,
          headline: (u.headline || u.storyKey).slice(0, 160),
        },
      },
      linkedStoryKeys: stories
        .filter((s) => s.storyKey === u.storyKey)
        .map((s) => s.storyKey),
      scoreHints: { continuity: 0.9, relevance: 0.7, integrity: 1 },
    });
  }

  // Favorite location / travel history
  if (ctx.homeLocation?.city || ctx.location.city) {
    const home = ctx.homeLocation?.city ?? ctx.location.city;
    out.push({
      thread: {
        id: slugId("place", home ?? "home"),
        type: "favorite_location",
        title: `Near ${home}`,
        summary: `The paper keeps your place in mind — local context for ${home}.`,
        place: {
          city: home,
          region: ctx.homeLocation?.region ?? ctx.location.region,
          state: ctx.homeLocation?.state ?? ctx.location.state,
        },
      },
      linkedStoryKeys: stories
        .filter((s) => s.role === "local")
        .map((s) => s.storyKey),
      scoreHints: { continuity: 0.7, relevance: 0.55, integrity: 1 },
    });
  }

  if (ctx.travel?.away && ctx.travel.city) {
    out.push({
      thread: {
        id: slugId("travel", ctx.travel.city),
        type: "travel_history",
        title: `Away in ${ctx.travel.city}`,
        summary: ctx.travel.note
          ? ctx.travel.note
          : `Travel memory — the paper knows you’re away in ${ctx.travel.city}.`,
        place: { city: ctx.travel.city },
        data: ctx.travel.until
          ? { editionDates: [ctx.travel.until] }
          : undefined,
      },
      linkedStoryKeys: [],
      scoreHints: { continuity: 0.85, relevance: 0.6, integrity: 1 },
    });
  }

  // Recurring local events (name overlap across listings / prior)
  const eventNames = (ctx.localEvents ?? []).map((e) => e.name);
  for (const event of (ctx.localEvents ?? []).slice(0, 6)) {
    const recur = eventNames.filter(
      (n) => n !== event.name && tokenOverlap(n, event.name) >= 0.4
    );
    out.push({
      thread: {
        id: slugId("event", event.name),
        type: "recurring_event",
        title: event.name,
        summary: `${event.venue}${event.city ? ` · ${event.city}` : ""} — ${event.startDateTime}${
          recur.length ? " · A familiar local listing." : ""
        }`,
        place: { city: event.city },
        since: event.startDateTime.slice(0, 10),
      },
      linkedStoryKeys: stories
        .filter((s) => s.role === "local")
        .map((s) => s.storyKey),
      scoreHints: {
        continuity: recur.length ? 0.75 : 0.5,
        relevance: 0.45,
        integrity: 1,
      },
    });
  }

  return out;
}
