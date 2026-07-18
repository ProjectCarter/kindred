import type { HistoricalImageAsset } from "./types.ts";
import type { OnThisDayCandidate } from "./onThisDay.ts";
import { rankOnThisDayCandidates } from "./scoreCandidate.ts";
import { resolveHistoricalImageForOnThisDay } from "./historicalImages.ts";
import { historicalImageMatchesEvent } from "./imageEventMatch.ts";

export type TodayInHistorySelection = {
  event: { year: number; text: string };
  image: HistoricalImageAsset;
  editorialScore: number;
  imageScore: number;
  candidateCount: number;
  selectedRank: number;
  editorNotes: string[];
};

export type SelectTodayInHistoryInput = {
  candidates: OnThisDayCandidate[];
  /** Minimum editorial score to consider publishing. */
  minEditorialScore?: number;
  /** How many top-ranked candidates to try pairing with an authentic visual. */
  maxImageAttempts?: number;
  nowYear?: number;
};

/**
 * Choose the best Today in History story that can be paired with an
 * authentic visual. Never publishes without an image; never picks at random.
 */
export async function selectTodayInHistoryStory(
  input: SelectTodayInHistoryInput
): Promise<TodayInHistorySelection | null> {
  const candidates = input.candidates ?? [];
  if (candidates.length === 0) {
    return null;
  }

  const minScore = input.minEditorialScore ?? 34;
  const maxAttempts = input.maxImageAttempts ?? 18;
  const ranked = rankOnThisDayCandidates(candidates, input.nowYear);
  const toTry = ranked.filter((c) => c.editorialScore >= minScore).slice(0, maxAttempts);

  if (toTry.length === 0) {
    console.log("[history:select] no candidates met editorial minimum", {
      candidateCount: candidates.length,
      minScore,
      topScore: ranked[0]?.editorialScore ?? null,
    });
    return null;
  }

  for (let i = 0; i < toTry.length; i++) {
    const candidate = toTry[i]!;
    const image = await resolveHistoricalImageForOnThisDay({
      onThisDay: { year: candidate.year, text: candidate.text },
      wikiPages: candidate.pages,
    });

    if (!image?.url?.trim()) continue;

    if (
      !historicalImageMatchesEvent({
        eventYear: candidate.year,
        eventText: candidate.text,
        articleBody: candidate.text,
        image,
      })
    ) {
      console.log("[history:select] rejected unrelated image", {
        year: candidate.year,
        caption: image.caption?.slice(0, 80) ?? null,
        rank: i + 1,
      });
      continue;
    }

    const imageScore = image.matchScore ?? 0;
    const editorNotes = [
      `Today in History curated from ${candidates.length} candidates.`,
      `Selected rank #${i + 1} (editorial score ${candidate.editorialScore}).`,
      ...candidate.reasons
        .filter((r) => r.weight > 0)
        .slice(0, 3)
        .map((r) => r.label),
      `Authentic ${image.assetKind} via ${image.source}.`,
    ];

    console.log("[history:select] chosen story", {
      year: candidate.year,
      editorialScore: candidate.editorialScore,
      imageScore,
      rank: i + 1,
      assetKind: image.assetKind,
      source: image.source,
    });

    return {
      event: { year: candidate.year, text: candidate.text },
      image,
      editorialScore: candidate.editorialScore,
      imageScore,
      candidateCount: candidates.length,
      selectedRank: i + 1,
      editorNotes,
    };
  }

  console.log("[history:select] no candidate paired with an authentic visual", {
    candidateCount: candidates.length,
    attempts: toTry.length,
  });
  return null;
}
