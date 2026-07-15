import { useCallback, useRef } from "react";
import { Animated } from "react-native";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";

/** Compact bar height below the safe area. */
export const PULL_DOWN_NAV_BAR_HEIGHT = 44;

/** Minimum scroll depth before a pull can reveal navigation. */
const REVEAL_MIN_SCROLL_Y = 80;

/** Downward pull distance (px) in one drag to reveal the bar. */
const PULL_REVEAL_THRESHOLD = 28;

/** Upward scroll delta (px) that hides the bar while reading down the page. */
const HIDE_SCROLL_DELTA = 6;

const SPRING = {
  useNativeDriver: true,
  tension: 280,
  friction: 30,
} as const;

/** Hidden offset — clears safe area + bar without affecting layout. */
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
 * Reveal a compact back header only after a deliberate downward pull on a long page.
 * Normal scrolling never shows the bar — only an intentional pull gesture does.
 * Uses Animated values only so scroll never triggers content re-renders.
 */
export function usePullDownNav() {
  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;
  const visibleRef = useRef(false);
  const lastScrollY = useRef(0);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const isMomentum = useRef(false);

  const show = useCallback(() => {
    if (visibleRef.current) return;
    visibleRef.current = true;
    Animated.spring(translateY, {
      toValue: 0,
      ...SPRING,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    if (!visibleRef.current) return;
    visibleRef.current = false;
    Animated.spring(translateY, {
      toValue: HIDDEN_Y,
      ...SPRING,
    }).start();
  }, [translateY]);

  const onScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isDragging.current = true;
      isMomentum.current = false;
      dragStartY.current = event.nativeEvent.contentOffset.y;
      lastScrollY.current = dragStartY.current;
    },
    []
  );

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isDragging.current = false;
      const y = event.nativeEvent.contentOffset.y;
      lastScrollY.current = y;

      if (y < REVEAL_MIN_SCROLL_Y) {
        hide();
        return;
      }

      const pulledDown = dragStartY.current - y;
      if (pulledDown >= PULL_REVEAL_THRESHOLD) {
        show();
      }
    },
    [hide, show]
  );

  const onMomentumScrollBegin = useCallback(() => {
    isMomentum.current = true;
    isDragging.current = false;
  }, []);

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      isMomentum.current = false;
      lastScrollY.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;

      if (y <= 12) {
        hide();
        return;
      }

      // Scrolling upward through the page (reading further down) — hide the bar.
      if (delta >= HIDE_SCROLL_DELTA && !isDragging.current) {
        hide();
      }
    },
    [hide]
  );

  const reset = useCallback(() => {
    lastScrollY.current = 0;
    dragStartY.current = 0;
    isDragging.current = false;
    isMomentum.current = false;
    visibleRef.current = false;
    translateY.setValue(HIDDEN_Y);
  }, [translateY]);

  return {
    translateY,
    onScroll,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
    reset,
    hide,
  };
}
