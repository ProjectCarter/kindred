/**
 * Staged edition build completion — early MVP publish marks editions ready
 * before middle desks finish; workers must keep running until finalize_edition.
 */

import { isStageComplete } from "./editionBuildStages.ts";

export function isStagedEditionBuildComplete(
  completedStages: readonly string[] | null | undefined
): boolean {
  return isStageComplete(completedStages, "finalize_edition");
}

/** True when the edition row is paintable but staged desks may still be running. */
export function editionNeedsStagedBuildResume(input: {
  editionStatus?: string | null;
  completedStages?: readonly string[] | null;
}): boolean {
  if (!isStagedEditionBuildComplete(input.completedStages)) return true;
  return false;
}

/** True only when early publish and all stages through finalize_edition completed. */
export function isEditionFullyBuilt(input: {
  editionStatus?: string | null;
  completedStages?: readonly string[] | null;
}): boolean {
  return (
    input.editionStatus === "ready" &&
    isStagedEditionBuildComplete(input.completedStages)
  );
}
