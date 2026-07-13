/**
 * Bandit's Pick eligibility — mirrors server logic in
 * supabase/functions/_shared/bandit/selectPick.ts
 */

const TECHNICAL_PATTERN =
  /\b(?:regulators?|regulatory|peptide|impurit(?:y|ies)|compliance|quarterly earnings|shareholders?|litigation|settlement|merger|acquisition|antitrust|layoffs?|bankrupt(?:cy)?|sec filing|ipo|interest rates?|federal reserve|tariffs?|earnings call|stock (?:price|market)|shares (?:fell|rose|slipped|jumped|plunged)|data breach|supply chain|inflation|gdp|unemployment rate|press release|proxy fight|board of directors|quarterly (?:report|results)|filing with|patent dispute|product recall|drug regulators?)\b/i;

const HEAVY_TONE_PATTERN =
  /\b(?:murder|killed|shooting|shot dead|stabbing|stabbed|assault|attack|terror|bomb|explosion|war|invasion|massacre|hostage|kidnap|rape|sexual assault|child abuse|deadly|death toll|bodies found|blood|gunman|shooter|violence|violent|outrage|outraged|scandal|scandalous|celebrity drama|feud|backlash|uproar|fury|furious|chaos|chaotic|crisis|disaster|catastrophe|tragedy|tragic|horror|horrific|nightmare|devastating|alarming|fear|feared|panic|panicked|threat|threatens|warning|warns|danger|dangerous|deadly|fatal|casualties|victim|victims)\b/i;

export function isTechnicalBanditsPickCopy(text: string): boolean {
  const hay = text.trim();
  if (!hay) return false;
  return TECHNICAL_PATTERN.test(hay);
}

export function isHeavyBanditsPickCopy(text: string): boolean {
  const hay = text.trim();
  if (!hay) return false;
  return HEAVY_TONE_PATTERN.test(hay);
}

export function isDisqualifiedBanditsPickStory(input: {
  headline: string;
  summary?: string | null;
}): boolean {
  const hay = `${input.headline} ${input.summary ?? ""}`.trim();
  if (!hay) return true;
  return isTechnicalBanditsPickCopy(hay) || isHeavyBanditsPickCopy(hay);
}
