import { useMemo } from "react";
import {
  pullDownNavTitleFromBackLabel,
  usePullDownNav,
} from "./usePullDownNav";
import { pullDownNavScrollProps } from "./pullDownNavScrollProps";

export type PullDownNavScreenOptions = {
  onBack: () => void;
  /** Section list screens — e.g. "Activities", "Local Events". */
  title?: string;
  /** Detail screens — item headline shown when space permits. */
  itemTitle?: string | null;
  /** Back label on the page — e.g. "← Back to Homepage". */
  backLabel?: string;
  backAccessibilityLabel?: string;
  fallbackTitle?: string;
  onScrollOffset?: (y: number) => void;
};

/** Derive the compact bar title for section and detail secondary screens. */
export function resolvePullDownNavTitle(options: {
  title?: string;
  itemTitle?: string | null;
  backLabel?: string;
  fallbackTitle?: string;
}): string {
  if (options.title?.trim()) return options.title.trim();
  if (options.itemTitle?.trim()) return options.itemTitle.trim();
  if (options.backLabel?.trim()) {
    return pullDownNavTitleFromBackLabel(
      options.backLabel,
      options.fallbackTitle ?? "Kindred"
    );
  }
  return options.fallbackTitle ?? "Kindred";
}

/**
 * Reusable pull-down back navigation for every non-homepage secondary screen.
 * Pair `scrollProps` on a ScrollView with `headerProps` on PullDownNavHeader.
 */
export function usePullDownNavScreen(options: PullDownNavScreenOptions) {
  const pullDownNav = usePullDownNav();

  const title = useMemo(
    () =>
      resolvePullDownNavTitle({
        title: options.title,
        itemTitle: options.itemTitle,
        backLabel: options.backLabel,
        fallbackTitle: options.fallbackTitle,
      }),
    [
      options.title,
      options.itemTitle,
      options.backLabel,
      options.fallbackTitle,
    ]
  );

  const scrollProps = useMemo(
    () => pullDownNavScrollProps(pullDownNav, options.onScrollOffset),
    [pullDownNav, options.onScrollOffset]
  );

  const backAccessibilityLabel =
    options.backAccessibilityLabel ??
    options.backLabel?.replace(/^←\s*/, "Back to ") ??
    "Back";

  return {
    pullDownNav,
    title,
    scrollProps,
    headerProps: {
      title,
      translateY: pullDownNav.translateY,
      onBack: options.onBack,
      backAccessibilityLabel,
    },
  };
}
