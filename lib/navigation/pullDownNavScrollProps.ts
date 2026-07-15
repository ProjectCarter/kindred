import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type { usePullDownNav } from "./usePullDownNav";

type PullDownNav = ReturnType<typeof usePullDownNav>;

/** Wire pull-down navigation handlers alongside an existing onScroll callback. */
export function pullDownNavScrollProps(
  pullDownNav: PullDownNav,
  onScrollOffset?: (y: number) => void
) {
  return {
    scrollEventThrottle: 16 as const,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollOffset?.(event.nativeEvent.contentOffset.y);
      pullDownNav.onScroll(event);
    },
    onScrollBeginDrag: pullDownNav.onScrollBeginDrag,
    onScrollEndDrag: pullDownNav.onScrollEndDrag,
    onMomentumScrollBegin: pullDownNav.onMomentumScrollBegin,
    onMomentumScrollEnd: pullDownNav.onMomentumScrollEnd,
  };
}

/** Compose pull-down scroll tracking with an additional onScroll handler. */
export function mergePullDownNavOnScroll(
  pullDownNav: PullDownNav,
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
) {
  return (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    pullDownNav.onScroll(event);
    onScroll?.(event);
  };
}
