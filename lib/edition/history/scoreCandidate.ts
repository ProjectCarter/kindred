/**
 * Client mirror — editorial scoring for Today in History.
 */

import type { OnThisDayCandidate } from "./onThisDay";

export type ScoredOnThisDayCandidate = OnThisDayCandidate & {
  editorialScore: number;
};

const NARRATIVE_BOOST =
  /\b(first|discovered|invented|signed|ratified|launched|landed|premiered|opened|founded|published|declared|unveiled|completed|established|introduced|breakthrough|historic)\b/i;
const EDUCATIONAL_BOOST =
  /\b(scientist|physicist|astronomer|explorer|inventor|composer|artist|architect|engineer|mission|spacecraft|satellite|vaccine|theorem|expedition|museum|university|treaty|amendment|constitution|Olympic|championship)\b/i;
const CURIOSITY_BOOST =
  /\b(only|unexpected|little-known|surprising|remarkably|for the first time|previously|unknown|hidden|secret|forgotten|rare)\b/i;
const SCIENCE_BOOST =
  /\b(discovered|discovery|experiment|theory|vaccine|microscope|laboratory|physicist|chemist|biology|genome|radiation|element|fossil|observatory)\b/i;
const SPACE_BOOST =
  /\b(spacecraft|satellite|orbit|apollo|nasa|astronaut|cosmonaut|moon|mars|rocket|space station|spacewalk|probe)\b/i;
const INVENTION_BOOST =
  /\b(invented|invention|patent|prototype|telegraph|telephone|phonograph|light bulb|automobile|airplane|radio|television)\b/i;
const CULTURAL_BOOST =
  /\b(premiered|debut|symphony|opera|novel|masterpiece|exhibition|gallery|sculpture|painting|film|cinema|literature|poem)\b/i;
const OVERFAMOUS_PENALTY =
  /\b(world war ii|world war i|september 11|pearl harbor|assassination of (president )?john f\.? kennedy|moon landing|apollo 11|fall of the berlin wall|d-day|invasion of normandy)\b/i;
const WAR_TRAGEDY_PENALTY =
  /\b(world war|battle of|massacre|genocide|terrorist attack|bombing|earthquake|tsunami|hurricane|flood killed|plane crash|disaster|tragedy|assassinated|executed|killed in action|crashed during takeoff)\b/i;
const CLICHE_PENALTY =
  /\b(born,|died,|was born|was an American|was a British|politician who|actor who|singer who)\b/i;
const BIRTH_DEATH_ONLY = /^(born|died)\b/i;

export function scoreOnThisDayCandidate(
  candidate: OnThisDayCandidate,
  nowYear = new Date().getFullYear()
): ScoredOnThisDayCandidate {
  const text = candidate.text;
  const blob = `${candidate.year} ${text}`.toLowerCase();
  let score = 42;

  const age = nowYear - candidate.year;
  if (age >= 50 && age <= 250) score += 8;
  else if (age >= 15 && age < 50) score += 4;

  const words = text.split(/\s+/).filter(Boolean).length;
  if (words >= 18 && words <= 55) score += 10;
  else if (words < 12) score -= 12;

  if (NARRATIVE_BOOST.test(text)) score += 10;
  if (EDUCATIONAL_BOOST.test(text)) score += 8;
  if (CURIOSITY_BOOST.test(text)) score += 9;
  if (SCIENCE_BOOST.test(text)) score += 9;
  if (SPACE_BOOST.test(text)) score += 10;
  if (INVENTION_BOOST.test(text)) score += 9;
  if (CULTURAL_BOOST.test(text)) score += 8;
  if (candidate.pages?.some((p) => p.thumbnail?.source || p.originalimage?.source)) {
    score += 7;
  }
  if (OVERFAMOUS_PENALTY.test(blob)) score -= 22;
  if (WAR_TRAGEDY_PENALTY.test(blob)) score -= 14;
  if (BIRTH_DEATH_ONLY.test(text.trim()) && !NARRATIVE_BOOST.test(text)) score -= 18;
  if (CLICHE_PENALTY.test(text) && !NARRATIVE_BOOST.test(text)) score -= 10;

  return {
    ...candidate,
    editorialScore: Math.round(Math.max(0, Math.min(100, score))),
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
