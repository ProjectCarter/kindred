import { useCallback, useRef, useState } from "react";
import { Animated } from "react-native";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

/** Compact bar height below the safe area. */
export const PULL_DOWN_NAV_BAR_HEIGHT = 44;

/** Minimum scroll depth before pull-down navigation can appear. */
const REVEAL_MIN_SCROLL_Y = 64;

/** Upward scroll delta (px) that reveals the header. */
const REVEAL_SCROLL_DELTA = 3;

/** Downward scroll delta (px) that hides the header. */
const HIDE_SCROLL_DELTA = 2;

const SPRING = {
  useNativeDriver: true,
  tension: 300,
  friction: 28,
} as const;

/** Hidden offset — large enough to clear safe area + bar. */
const HIDDEN_Y = -(PULL_DOWN_NAV_BAR_HEIGHT + 60);

/**
 * Derive a screen title from a Kindred back label (`← Recommendations` → `Recommendations`).
 */
export function pullDownNavTitleFromBackLabel(
  backLabel: string,
  fallback = "Kindred"
): string {
  const stripped = backLabel.replace(/^←\s*/, "").trim();
  return stripped.length > 0 ? stripped : fallback;
}

/**
 * Reveal a compact back header when the reader pulls down on a long page.
 * Hidden at the top, on scroll-down, and whenever the reader is near the top.
 */
export function usePullDownNav() {
  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;
  const visibleRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);

  const show = useCallback(() => {
    if (visibleRef.current) return;
    visibleRef.current = true;
    setVisible(true);
    Animated.spring(translateY, {
      toValue: 0,
      ...SPRING,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    setVisible(false);
    Animated.spring(translateY, {
      toValue: HIDDEN_Y,
      ...SPRING,
    }).start();
  }, [translateY]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      if (y <= 12) {
        hide();
        return;
      }

      if (y < REVEAL_MIN_SCROLL_Y) {
        hide();
        return;
      }

      if (delta <= -REVEAL_SCROLL_DELTA) {
        show();
      } else if (delta >= HIDE_SCROLL_DELTA) {
        hide();
      }
    },
    [hide, show]
  );

  const reset = useCallback(() => {
    lastScrollY.current = 0;
    visibleRef.current = false;
    setVisible(false);
    translateY.setValue(HIDDEN_Y);
  }, [translateY]);

  return {
    translateY,
    visible,
    onScroll,
    reset,
    hide,
  };
}
