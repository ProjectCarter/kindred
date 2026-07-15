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

const SCIENCE_BOOST =
  /\b(discovered|discovery|experiment|theory|vaccine|microscope|laboratory|physicist|chemist|biology|genome|radiation|element|fossil|observatory)\b/i;

const SPACE_BOOST =
  /\b(spacecraft|satellite|orbit|apollo|nasa|astronaut|cosmonaut|moon|mars|rocket|space station|spacewalk|probe)\b/i;

const INVENTION_BOOST =
  /\b(invented|invention|patent|prototype|telegraph|telephone|phonograph|light bulb|automobile|airplane|radio|television)\b/i;

const CULTURAL_BOOST =
  /\b(premiered|debut|symphony|opera|novel|masterpiece|exhibition|gallery|sculpture|painting|film|cinema|literature|poem)\b/i;

const ARCHITECTURE_BOOST =
  /\b(tower|cathedral|bridge|palace|monument|skyscraper|architect|dedicated|cornerstone|landmark building)\b/i;

const CONSERVATION_BOOST =
  /\b(national park|preserve|protected|conservation|wildlife refuge|sanctuary|endangered)\b/i;

const EXPEDITION_BOOST =
  /\b(expedition|summit|crossed|voyage|explored|navigator|reached the|circumnavig)\b/i;

const ACHIEVEMENT_BOOST =
  /\b(first human|world record|championship|medal|nobel|pulitzer|milestone|pioneer|breakthrough)\b/i;

const SPEECH_BOOST =
  /\b(speech|address|proclamation|declaration|emancipation|inaugural|famous words)\b/i;

/** Penalize the obvious "everyone already knows this" on-this-day picks. */
const OVERFAMOUS_PENALTY =
  /\b(world war ii|world war i|september 11|pearl harbor|assassination of (president )?john f\.? kennedy|moon landing|apollo 11|fall of the berlin wall|d-day|invasion of normandy)\b/i;

/** Wars and tragedies are valid — but should not dominate the morning ritual. */
const WAR_TRAGEDY_PENALTY =
  /\b(world war|battle of|massacre|genocide|terrorist attack|bombing|earthquake|tsunami|hurricane|flood killed|plane crash|disaster|tragedy|assassinated|executed|killed in action)\b/i;

const CLICHE_PENALTY =
  /\b(born,|died,|was born|was an American|was a British|politician who|actor who|singer who)\b/i;

const BIRTH_DEATH_ONLY =
  /^(born|died)\b/i;

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

  const categoryBoosts: Array<{
    re: RegExp;
    code: string;
    label: string;
    weight: number;
  }> = [
    { re: SCIENCE_BOOST, code: "science", label: "Scientific discovery", weight: 9 },
    { re: SPACE_BOOST, code: "space", label: "Space exploration", weight: 10 },
    { re: INVENTION_BOOST, code: "invention", label: "Historic invention", weight: 9 },
    { re: CULTURAL_BOOST, code: "cultural", label: "Cultural milestone", weight: 8 },
    { re: ARCHITECTURE_BOOST, code: "architecture", label: "Architectural achievement", weight: 7 },
    { re: CONSERVATION_BOOST, code: "conservation", label: "Conservation success", weight: 8 },
    { re: EXPEDITION_BOOST, code: "expedition", label: "Famous expedition", weight: 8 },
    { re: ACHIEVEMENT_BOOST, code: "achievement", label: "Inspiring human achievement", weight: 8 },
    { re: SPEECH_BOOST, code: "speech", label: "Important speech or declaration", weight: 7 },
  ];

  for (const boost of categoryBoosts) {
    if (boost.re.test(text)) {
      score += boost.weight;
      reasons.push({
        code: boost.code,
        label: boost.label,
        weight: boost.weight,
      });
    }
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

  if (WAR_TRAGEDY_PENALTY.test(blob)) {
    score -= 14;
    reasons.push({
      code: "war_tragedy",
      label: "War or tragedy — valid but not the morning default",
      weight: -14,
    });
  }

  if (BIRTH_DEATH_ONLY.test(text.trim()) && !NARRATIVE_BOOST.test(text)) {
    score -= 18;
    reasons.push({
      code: "birth_death_only",
      label: "Birth or death notice — thin for a feature",
      weight: -18,
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
