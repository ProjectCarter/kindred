/**
 * Editorial Continuation — Milestone 10
 *
 * Philosophy
 * ----------
 * A great newspaper never leaves a reader at a dead end. After a story,
 * an editor offers a short, intentional next path: deepen understanding,
 * see the local stake, hear another careful view when it exists, or
 * return to the rest of today’s paper.
 *
 * This is not a feed. Recommendations are chosen for *understanding*,
 * not dwell time. Each item must answer: “Why would a great newspaper
 * editor suggest this next?”
 *
 * Selection
 * ---------
 * Candidates come only from today’s edition intelligence:
 *   • Knowledge facets by editorial role (background, local, prior coverage)
 *   • Memory threads when coverage continues across mornings
 *   • Bandit’s Pick when it is not the story just read
 *   • Always: Return to today’s edition
 *
 * We never invent links from keyword overlap alone.
 *
 * Anti-feed rules
 * ---------------
 *   • At most four suggestions; prefer two or three
 *   • At most one item per editorial role
 *   • After a continuation hop, only “Return to today’s edition”
 *   • Opposing views appear only with a clear editorial signal
 */

import type { BanditsPick } from "./bandit";
import type { ContinueReadingItem } from "./articleCompanion";
import type { KnowledgeFacet, KnowledgePacket } from "./knowledge";
import {
  hasSubstance,
  isPlaceholderCopy,
} from "./contentQuality";
import { memoryForStory, type MemoryPayload } from "./memory";

export const CONTINUATION_MAX = 4;
export const CONTINUATION_DEPTH_MAX = 3;

const DISPLAY: Record<ContinueReadingItem["kind"], string> = {
  following: "Continue following this story",
  background: "Background & context",
  local: "Local perspective",
  opposing: "Another perspective",
  bandit: "Bandit’s Pick",
  edition: "Return to today’s edition",
};

const EDITOR_WHY: Record<ContinueReadingItem["kind"], string> = {
  following: "The paper is still covering this thread.",
  background: "Understanding comes before the next opinion.",
  local: "How this lands close to home.",
  opposing: "A careful view from another side — only when the desk found one.",
  bandit: "One quiet recommendation from the editor.",
  edition: "The rest of today’s paper is waiting.",
};

export type EditorialContinuationInput = {
  packet: KnowledgePacket | null;
  memory?: MemoryPayload | null;
  storyId?: string | null;
  currentTitle?: string | null;
  currentArticleId?: string | null;
  banditsPick?: BanditsPick | null;
  /**
   * When true, the reader already followed a continuation hop.
   * Only “Return to today’s edition” remains — the paper, not a rabbit hole.
   */
  terminal?: boolean;
};

function clip(text: string, max = 240): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function returnToEdition(): ContinueReadingItem {
  return {
    kind: "edition",
    label: DISPLAY.edition,
    title: "Back to the morning paper",
    summary: EDITOR_WHY.edition,
    editorWhy: EDITOR_WHY.edition,
    action: "return_to_edition",
  };
}

function facetItem(
  kind: ContinueReadingItem["kind"],
  facet: KnowledgeFacet
): ContinueReadingItem | null {
  if (!hasSubstance(facet.summary, 24)) return null;
  if (isPlaceholderCopy(facet.title) || isPlaceholderCopy(facet.summary)) {
    return null;
  }
  const title = facet.title?.trim() || DISPLAY[kind];
  return {
    kind,
    label: DISPLAY[kind],
    title,
    summary: clip(facet.summary),
    editorWhy: EDITOR_WHY[kind],
    // When the desk actually knows which real piece this points at
    // (another section, top story, or discovery item in today's
    // edition), carry that id so the card opens the real destination
    // article instead of a synthetic restatement of this summary.
    targetArticleId: facet.data?.storyKey || undefined,
  };
}

function pickFacet(
  facets: KnowledgeFacet[],
  types: KnowledgeFacet["type"][]
): KnowledgeFacet | null {
  for (const type of types) {
    const hit = facets.find((f) => f.type === type);
    if (hit && hasSubstance(hit.summary, 24)) return hit;
  }
  return null;
}

function followingItem(
  packet: KnowledgePacket | null,
  memory: MemoryPayload | null | undefined,
  storyId: string | null | undefined,
  currentTitle: string | null | undefined
): ContinueReadingItem | null {
  const facets = packet?.facets ?? [];
  const prior = pickFacet(facets, ["previous_coverage", "related_story"]);
  if (prior) {
    const item = facetItem("following", prior);
    if (item) return item;
  }

  if (memory && storyId) {
    const threads = memoryForStory(memory, storyId);
    const thread = threads.find(
      (t) =>
        t.type === "continuing_news" ||
        t.type === "ongoing_timeline" ||
        t.type === "previous_reading"
    );
    if (thread && hasSubstance(thread.summary, 20)) {
      const headline =
        thread.data?.headline?.trim() ||
        thread.summary.match(/[“"]([^”"]+)[”"]/)?.[1]?.trim() ||
        null;
      const title = headline || "Earlier coverage";
      if (
        currentTitle &&
        title.toLowerCase() === currentTitle.trim().toLowerCase()
      ) {
        return null;
      }
      const otherStoryKey = thread.storyKeys?.find((k) => k && k !== storyId);
      return {
        kind: "following",
        label: DISPLAY.following,
        title,
        summary: clip(thread.summary),
        editorWhy: EDITOR_WHY.following,
        targetArticleId: otherStoryKey || undefined,
      };
    }
  }

  return null;
}

function opposingItem(facets: KnowledgeFacet[]): ContinueReadingItem | null {
  const opposing = facets.find(
    (f) =>
      hasSubstance(f.summary, 24) &&
      /another view|other side|critics|counterpoint|opposing view|another perspective/i.test(
        `${f.title} ${f.summary}`
      )
  );
  if (!opposing) return null;
  return facetItem("opposing", opposing);
}

function banditItem(
  pick: BanditsPick | null | undefined,
  currentArticleId: string | null | undefined,
  currentTitle: string | null | undefined
): ContinueReadingItem | null {
  if (!pick?.story?.headline?.trim()) return null;
  if (currentArticleId && pick.story.id === currentArticleId) return null;
  const title = pick.story.headline.trim();
  if (
    currentTitle &&
    title.toLowerCase() === currentTitle.trim().toLowerCase()
  ) {
    return null;
  }
  if (isPlaceholderCopy(title) || isPlaceholderCopy(pick.story.summary)) {
    return null;
  }
  return {
    kind: "bandit",
    label: DISPLAY.bandit,
    title,
    summary: clip(
      pick.intro?.trim() ||
        pick.story.why?.trim() ||
        pick.story.summary ||
        EDITOR_WHY.bandit
    ),
    editorWhy: EDITOR_WHY.bandit,
    targetArticleId: pick.story.id,
  };
}

/**
 * Build 2–4 editorial next steps for the end of an article.
 * Always ends with a path back into today’s edition when depth exists —
 * and still offers return alone when the desk has nothing deeper.
 */
export function selectEditorialContinuation(
  input: EditorialContinuationInput
): ContinueReadingItem[] {
  if (input.terminal) {
    return [returnToEdition()];
  }

  const facets = input.packet?.facets ?? [];
  const current = (input.currentTitle ?? "").trim().toLowerCase();
  const depth: ContinueReadingItem[] = [];
  const seen = new Set<string>();

  function take(item: ContinueReadingItem | null) {
    if (!item) return;
    if (depth.length >= CONTINUATION_DEPTH_MAX) return;
    if (current && item.title.trim().toLowerCase() === current) return;
    const key = `${item.kind}:${item.title.trim().toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    depth.push(item);
  }

  // Editorial order: follow the thread → understand → localize → other view → Bandit.
  take(
    followingItem(
      input.packet,
      input.memory,
      input.storyId,
      input.currentTitle
    )
  );

  const background = pickFacet(facets, [
    "historical_background",
    "trusted_explainer",
    "timeline",
    "definition",
  ]);
  if (background) take(facetItem("background", background));

  const local = pickFacet(facets, ["local_context"]);
  if (local) take(facetItem("local", local));

  take(opposingItem(facets));

  take(
    banditItem(input.banditsPick, input.currentArticleId, input.currentTitle)
  );

  const items = [...depth, returnToEdition()];
  return items.slice(0, CONTINUATION_MAX);
}

/** After a continuation hop — close the rabbit hole. */
export function terminalEditorialContinuation(): ContinueReadingItem[] {
  return selectEditorialContinuation({ packet: null, terminal: true });
}

export const EditorialContinuation = {
  select: selectEditorialContinuation,
  terminal: terminalEditorialContinuation,
  labels: DISPLAY,
  why: EDITOR_WHY,
};
