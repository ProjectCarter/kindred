/** Server mirror — lib/edition/sectionRepair.ts */
export {
  MAX_AUTOMATIC_REPAIR_ATTEMPTS_PER_STAGE,
  applyRepairPlanToValidationState,
  applyUnresolvedRepairToValidationState,
  buildRepairStageList,
  canAttemptRepair,
  getRepairStagesForDesk,
  isCrossSectionDiscoveryFailure,
  isPublicationEligibleForRepairFlow,
  localEventsInvalidatesDiscovery,
  parseDeskFromBlockingFailure,
  planSectionRepairs,
  recordRepairAttempt,
  requiresSharedNationalDailyRegeneration,
} from "../../../../lib/edition/sectionRepair.ts";
