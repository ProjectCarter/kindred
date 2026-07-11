import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { motion } from "../lib/edition/newspaperTheme";

type Props = {
  children: ReactNode;
  /** 0-based stagger index within the folio. */
  index?: number;
  style?: ViewStyle;
  /** Skip animation (e.g. parent already reduced motion). */
  disabled?: boolean;
};

/**
 * Soft folio entrance — opacity + gentle rise.
 * Honors Reduce Motion: content simply appears, still in place.
 */
export function FolioReveal({
  children,
  index = 0,
  style,
  disabled,
}: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled: boolean) => {
        if (mounted) setReduceMotion(enabled);
      }
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (disabled || reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    if (started.current) return;
    started.current = true;
    opacity.setValue(0);
    translateY.setValue(motion.risePx);
    const delay = Math.min(index, 10) * motion.staggerMs;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.enterMs,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: motion.enterMs + 40,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [disabled, reduceMotion, index, opacity, translateY]);

  return (
    <Animated.View
      style={[styles.base, style, { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
  },
});
