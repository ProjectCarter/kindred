/** Development-only homepage scroll diagnostics — no production impact. */

const TAG = "[home:scroll-debug]";

/** Homepage scroll session phase — article return uses articleReturnPhase separately. */
export type HomeScrollSessionPhase = "initial" | "user_control" | "complete";

/** One-shot article-return restore lifecycle. */
export type ArticleReturnRestorePhase =
  | "idle"
  | "waiting_for_return_layout"
  | "restoring_return_position"
  | "complete";

/** @deprecated Use HomeScrollSessionPhase + ArticleReturnRestorePhase */
export type HomeScrollRestorePhase =
  | "initial"
  | "return"
  | "locked"
  | "done";

export function logHomeScrollDebug(
  event: string,
  detail?: Record<string, unknown>
): void {
  if (!__DEV__) return;
  if (detail) {
    console.log(TAG, event, detail);
  } else {
    console.log(TAG, event);
  }
}

/** User is still at the folio masthead — safe to consider an initial restore. */
export const HOME_SCROLL_AT_TOP_PX = 16;

export function scrollDebugSnapshot(input: {
  reason: string;
  targetY?: number;
  currentY: number;
  pendingRestoreY: number;
  restored: boolean;
  sessionPhase: HomeScrollSessionPhase;
  articleReturnPhase: ArticleReturnRestorePhase;
  userLocked: boolean;
  dragging: boolean;
  focusTransitions: number;
  contentHeight?: number | null;
  editionId?: string | null;
  articleReturnTargetY?: number;
  returnGeneration?: number;
}): Record<string, unknown> {
  return {
    reason: input.reason,
    targetY: input.targetY ?? null,
    currentY: input.currentY,
    pendingRestoreY: input.pendingRestoreY,
    restored: input.restored,
    sessionPhase: input.sessionPhase,
    articleReturnPhase: input.articleReturnPhase,
    userLocked: input.userLocked,
    dragging: input.dragging,
    focusTransitions: input.focusTransitions,
    contentHeight: input.contentHeight ?? null,
    editionId: input.editionId ?? null,
    articleReturnTargetY: input.articleReturnTargetY ?? null,
    returnGeneration: input.returnGeneration ?? null,
  };
}
