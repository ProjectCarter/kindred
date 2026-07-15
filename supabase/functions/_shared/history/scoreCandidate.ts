/**
 * Editorial scoring for Today in History — newspaper judgment, not a database.
 */

import type { OnThisDayCandidate } from "./onThisDay.ts";

export type HistoryEditorialReason = {
  code: string;
  label: string;
  weight: number;
};

export type ScoredOnThisDayCandidate = OnThisDayCandidate & {
  editorialScore: number;
  reasons: HistoryEditorialReason[];
};

const NARRATIVE_BOOST =
  /\b(first|discovered|invented|signed|ratified|launched|landed|premiered|opened|founded|published|declared|unveiled|completed|established|introduced|breakthrough|historic)\b/i;

const EDUCATIONAL_BOOST =
  /\b(scientist|physicist|astronomer|explorer|inventor|composer|artist|architect|engineer|mission|spacecraft|satellite|vaccine|theorem|expedition|museum|university|treaty|amendment|constitution|Olympic|championship)\b/i;

const EMOTIONAL_BOOST =
  /\b(courage|triumph|survived|rescued|peace|freedom|independence|breakthrough|celebrated|honored|remembered|landmark|monument|memorial)\b/i;

const CURIOSITY_BOOST =
  /\b(only|unexpected|little-known|surprising|remarkably|for the first time|previously|unknown|hidden|secret|forgotten|rare)\b/i;

const TIMELESS_BOOST =
  /\b(still|today|legacy|enduring|influenced|changed|transformed|paved the way|shaped|continues)\b/i;

/** Penalize the obvious "everyone already knows this" on-this-day picks. */
const OVERFAMOUS_PENALTY =
  /\b(world war ii|world war i|september 11|pearl harbor|assassination of (president )?john f\.? kennedy|moon landing|apollo 11|fall of the berlin wall|d-day|invasion of normandy)\b/i;

const CLICHE_PENALTY =
  /\b(born,|died,|was born|was an American|was a British|politician who|actor who|singer who)\b/i;

const LISTLIKE_PENALTY = /^\d+\s+(people|persons|men|women|soldiers|others)\b/i;

export function scoreOnThisDayCandidate(
  candidate: OnThisDayCandidate,
  nowYear = new Date().getFullYear()
): ScoredOnThisDayCandidate {
  const text = candidate.text;
  const blob = `${candidate.year} ${text}`.toLowerCase();
  const reasons: HistoryEditorialReason[] = [];
  let score = 42;

  const age = nowYear - candidate.year;
  if (age >= 50 && age <= 250) {
    score += 8;
    reasons.push({
      code: "historical_depth",
      label: "A story with historical depth",
      weight: 8,
    });
  } else if (age >= 15 && age < 50) {
    score += 4;
    reasons.push({
      code: "living_memory",
      label: "Recent enough to feel vivid",
      weight: 4,
    });
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 18 && words <= 55) {
    score += 10;
    reasons.push({
      code: "storytelling_length",
      label: "Room for a compelling newspaper lead",
      weight: 10,
    });
  } else if (words < 12) {
    score -= 12;
    reasons.push({
      code: "too_brief",
      label: "Too thin for a morning feature",
      weight: -12,
    });
  } else if (words > 70) {
    score -= 6;
    reasons.push({
      code: "too_dense",
      label: "Too dense for a card intro",
      weight: -6,
    });
  }

  if (NARRATIVE_BOOST.test(text)) {
    score += 10;
    reasons.push({
      code: "narrative_moment",
      label: "A clear narrative moment",
      weight: 10,
    });
  }

  if (EDUCATIONAL_BOOST.test(text)) {
    score += 8;
    reasons.push({
      code: "educational",
      label: "Strong educational value",
      weight: 8,
    });
  }

  if (EMOTIONAL_BOOST.test(text)) {
    score += 6;
    reasons.push({
      code: "emotional",
      label: "Emotional resonance",
      weight: 6,
    });
  }

  if (CURIOSITY_BOOST.test(text)) {
    score += 9;
    reasons.push({
      code: "curiosity",
      label: "Invites a 'I never knew that' moment",
      weight: 9,
    });
  }

  if (TIMELESS_BOOST.test(text)) {
    score += 5;
    reasons.push({
      code: "timeless",
      label: "Still relevant today",
      weight: 5,
    });
  }

  if (candidate.pages?.some((p) => p.thumbnail?.source || p.originalimage?.source)) {
    score += 7;
    reasons.push({
      code: "visual_potential",
      label: "Trusted sources suggest a visual",
      weight: 7,
    });
  }

  if (OVERFAMOUS_PENALTY.test(blob)) {
    score -= 22;
    reasons.push({
      code: "overfamous",
      label: "Too familiar for a curated feature",
      weight: -22,
    });
  }

  if (CLICHE_PENALTY.test(text) && !NARRATIVE_BOOST.test(text)) {
    score -= 10;
    reasons.push({
      code: "biography_cliche",
      label: "Reads like a database biography",
      weight: -10,
    });
  }

  if (LISTLIKE_PENALTY.test(text)) {
    score -= 14;
    reasons.push({
      code: "listlike",
      label: "Too list-like for a story",
      weight: -14,
    });
  }

  // Slight variety: prefer stories that are not all from the same decade bucket.
  const decade = Math.floor(candidate.year / 10) * 10;
  const decadeHash = (decade % 17) - 8;
  score += decadeHash * 0.15;

  return {
    ...candidate,
    editorialScore: Math.round(Math.max(0, Math.min(100, score))),
    reasons,
  };
}

export function rankOnThisDayCandidates(
  candidates: OnThisDayCandidate[],
  nowYear = new Date().getFullYear()
): ScoredOnThisDayCandidate[] {
  return candidates
    .map((c) => scoreOnThisDayCandidate(c, nowYear))
    .sort((a, b) => b.editorialScore - a.editorialScore);
}
