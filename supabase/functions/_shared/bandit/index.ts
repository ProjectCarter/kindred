export type {
  BanditComposeInput,
  BanditMoment,
  BanditMomentKind,
  BanditOccasion,
  BanditPayload,
  BanditReaderProfile,
  BanditsPick,
} from "./types.ts";

export {
  BANDIT_NAME,
  BANDIT_VOICE,
  BANDIT_SYSTEM_PROMPT,
} from "./personality.ts";

export { detectBanditOccasions } from "./occasions.ts";
export {
  composeBanditPayload,
  composeMorningLine,
  buildBanditGrounding,
} from "./compose.ts";
export {
  generateBanditPayload,
  polishBanditMorningLine,
} from "./generate.ts";
export { loadBanditReaderProfile } from "./loadReaderProfile.ts";
export {
  selectBanditsPick,
  composeBanditsPickIntro,
  composeBanditsPickClosing,
  type BanditsPickStory,
} from "./selectPick.ts";
export {
  verifySeasonalLocalEvidence,
  type LocalEvidenceBundle,
  type ExperienceEvidenceBundle,
} from "./localEvidence.ts";
export {
  assessRegionalAuthenticity,
  experienceProfile,
} from "./experienceProfiles.ts";
