import type { ViewStyle } from "react-native";

/**
 * Extra space below the status bar / Dynamic Island for the fixed in-scroll
 * back link on article detail screens. Does not affect PullDownNavHeader.
 */
export const ARTICLE_BACK_BELOW_SAFE_AREA = 20;

/** Padding for the fixed top back row on article readers. */
export function articleBackRowInsets(
  topInset: number,
  options?: { safeAreaAlreadyApplied?: boolean }
): Pick<ViewStyle, "paddingTop"> {
  const safeAreaAlreadyApplied = options?.safeAreaAlreadyApplied ?? false;
  return {
    paddingTop: safeAreaAlreadyApplied
      ? ARTICLE_BACK_BELOW_SAFE_AREA
      : topInset + ARTICLE_BACK_BELOW_SAFE_AREA,
  };
}
