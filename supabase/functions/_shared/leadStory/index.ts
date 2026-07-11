export type {
  LeadStory,
  LeadStoryHeroImage,
  LeadStoryRole,
  BanditsPickReservation,
  SelectLeadStoryInput,
  LeadStoryPolicy,
} from "./types.ts";

export { selectLeadStory } from "./selectLeadStory.ts";

import { selectLeadStory } from "./selectLeadStory.ts";

/** Front Page Lead Story service — selection engine + data model. */
export const LeadStoryService = {
  selectLeadStory,
};

export default LeadStoryService;
