import { useCallback, useEffect, useRef } from "react";
import type { ScrollView } from "react-native";
import {
  getListScrollSync,
  loadListScroll,
  updateListScroll,
} from "./listScrollSession";

/** Restore and persist vertical scroll for See All / archive list screens. */
export function useListScrollRestoration(
  sessionKey: string,
  options?: { onRestore?: (scrollY: number) => void }
) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const onRestoreRef = useRef(options?.onRestore);
  onRestoreRef.current = options?.onRestore;

  useEffect(() => {
    let cancelled = false;

    function restore(y: number) {
      scrollYRef.current = y;
      onRestoreRef.current?.(y);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
      });
    }

    const sync = getListScrollSync(sessionKey);
    if (sync > 0) {
      restore(sync);
      return;
    }

    void loadListScroll(sessionKey).then((y) => {
      if (cancelled || y <= 0) return;
      restore(y);
    });

    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  const onScrollOffset = useCallback((y: number) => {
    scrollYRef.current = y;
  }, []);

  const persistNow = useCallback(() => {
    updateListScroll(sessionKey, scrollYRef.current);
  }, [sessionKey]);

  return { scrollRef, scrollYRef, onScrollOffset, persistNow };
}
