import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { paper } from "../lib/edition/newspaperTheme";

type Props = {
  /** Italic Georgia hospitality line — never technical. */
  hint?: string;
};

/**
 * Shared waiting ritual — no platform spinner.
 * A quiet mark that breathes, or holds still under Reduce Motion.
 */
export function PaperLoading({ hint = "Opening today’s paper…" }: Props) {
  const breath = useRef(new Animated.Value(0.4)).current;
  const hintOp = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const prevHint = useRef(hint);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) =>
      setReduceMotion(Boolean(v))
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      breath.setValue(0.8);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0.4,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath, reduceMotion]);

  useEffect(() => {
    if (prevHint.current === hint) return;
    prevHint.current = hint;
    if (reduceMotion) return;
    hintOp.setValue(0);
    Animated.timing(hintOp, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hint, hintOp, reduceMotion]);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={hint}
    >
      <Animated.Text style={[styles.mark, { opacity: breath }]}>
        ◆
      </Animated.Text>
      <Animated.Text
        style={[styles.hint, { opacity: hintOp }]}
        maxFontSizeMultiplier={1.35}
      >
        {hint}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: paper.sky,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  mark: {
    fontSize: 11,
    color: paper.terracotta,
    letterSpacing: 0,
    marginBottom: 20,
  },
  hint: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    color: paper.inkMuted,
    textAlign: "center",
    letterSpacing: 0.15,
  },
});
