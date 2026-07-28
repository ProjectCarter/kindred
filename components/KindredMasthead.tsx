import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { paper, space, type } from "../lib/edition/newspaperTheme";

/** Scroll distance over which the masthead settles into its compact form. */
export const MASTHEAD_COLLAPSE_DISTANCE = 84;

/** Compact sticky bar height (below safe area). */
export const MASTHEAD_COMPACT_HEIGHT = 48;

type CollapseStyle = {
  compactOpacity: Animated.AnimatedInterpolation<number>;
  compactTranslateY: Animated.AnimatedInterpolation<number>;
  fullOpacity: Animated.AnimatedInterpolation<number>;
  fullTranslateY: Animated.AnimatedInterpolation<number>;
};

/**
 * Shared interpolations for a calm, print-like collapse —
 * no bounce, no spring flash; only opacity and a few pixels of drift.
 */
export function mastheadCollapse(scrollY: Animated.Value): CollapseStyle {
  return {
    compactOpacity: scrollY.interpolate({
      inputRange: [
        MASTHEAD_COLLAPSE_DISTANCE * 0.4,
        MASTHEAD_COLLAPSE_DISTANCE,
      ],
      outputRange: [0, 1],
      extrapolate: "clamp",
    }),
    compactTranslateY: scrollY.interpolate({
      inputRange: [
        MASTHEAD_COLLAPSE_DISTANCE * 0.4,
        MASTHEAD_COLLAPSE_DISTANCE,
      ],
      outputRange: [-6, 0],
      extrapolate: "clamp",
    }),
    fullOpacity: scrollY.interpolate({
      inputRange: [0, MASTHEAD_COLLAPSE_DISTANCE * 0.9],
      outputRange: [1, 0],
      extrapolate: "clamp",
    }),
    fullTranslateY: scrollY.interpolate({
      inputRange: [0, MASTHEAD_COLLAPSE_DISTANCE],
      outputRange: [0, -10],
      extrapolate: "clamp",
    }),
  };
}

type FullProps = {
  /** Folio date line under the nameplate. */
  dateLabel?: string | null;
  /** Optional single weather line. */
  weatherLine?: string | null;
  /** Quiet eyebrow above the name (e.g. Morning Edition). */
  eyebrow?: string | null;
  /** Meta line for articles (section label). */
  meta?: string | null;
  /** Top-trailing action while expanded (Library, etc.). */
  trailing?: ReactNode;
  /** Top-leading action while expanded (back). */
  leading?: ReactNode;
  scrollY?: Animated.Value;
  style?: StyleProp<ViewStyle>;
  /**
   * Displayed wordmark text. Defaults to "Kindred". This is a visual/branding
   * override only — the project, package, and code remain Kindred. The homepage
   * passes "D.R.O.P." to show the consumer brand while everything internal
   * (imports, components, routes, analytics) is unchanged.
   */
  nameplateText?: string;
  /** Tighter nameplate for the local-day arrival screen. */
  compact?: boolean;
  /**
   * Compresses the vertical rhythm between the Library row, nameplate, rule, and
   * date/meta line — pulling the whole header upward — while KEEPING the full
   * nameplate size. Used by the homepage arrival so Today's Masterpiece starts
   * higher on screen. Independent of `compact` (which also shrinks the name).
   */
  dense?: boolean;
};

/**
 * Full editorial nameplate — the front of the paper.
 * Distinctly Kindred: cream field, Georgia authority, restrained rule.
 */
export function KindredFullMasthead({
  dateLabel,
  weatherLine,
  eyebrow = "Morning Edition",
  meta,
  trailing,
  leading,
  scrollY,
  style,
  nameplateText = "Kindred",
  compact = false,
  dense = false,
}: FullProps) {
  const collapse = scrollY ? mastheadCollapse(scrollY) : null;

  const body = (
    <View
      style={[
        styles.full,
        compact && styles.fullCompact,
        dense && styles.fullDense,
        style,
      ]}
      accessibilityRole="header"
    >
      {(leading || trailing) && (
        <View
          style={[
            styles.fullChrome,
            compact && styles.fullChromeCompact,
            dense && styles.fullChromeDense,
          ]}
        >
          <View style={styles.fullChromeSide}>{leading}</View>
          <View style={styles.fullChromeSideEnd}>{trailing}</View>
        </View>
      )}

      {eyebrow ? (
        <Text style={styles.eyebrow} maxFontSizeMultiplier={1.2}>
          {eyebrow}
        </Text>
      ) : null}

      <Text
        style={[
          styles.nameplate,
          compact && styles.nameplateCompact,
          dense && styles.nameplateDense,
        ]}
        maxFontSizeMultiplier={1.15}
      >
        {nameplateText}
      </Text>

      <View
        style={[styles.nameplateRule, dense && styles.nameplateRuleDense]}
        accessibilityElementsHidden
      />

      {dateLabel ? (
        <Text style={styles.date} maxFontSizeMultiplier={1.25}>
          {dateLabel}
        </Text>
      ) : null}

      {weatherLine ? (
        <Text style={styles.weather} maxFontSizeMultiplier={1.25}>
          {weatherLine}
        </Text>
      ) : null}

      {meta ? (
        <Text
          style={[styles.meta, dense && styles.metaDense]}
          maxFontSizeMultiplier={1.2}
        >
          {meta}
        </Text>
      ) : null}
    </View>
  );

  if (!collapse) return body;

  return (
    <Animated.View
      style={{
        opacity: collapse.fullOpacity,
        transform: [{ translateY: collapse.fullTranslateY }],
      }}
    >
      {body}
    </Animated.View>
  );
}

type StickyProps = {
  scrollY: Animated.Value;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Compact center wordmark — defaults to KINDRED. */
  wordmark?: string;
  /** Optional quiet subtitle when collapsed (section name). */
  subtitle?: string | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * Compact sticky masthead — publication identity that never leaves the page.
 * Remains pointer-transparent until collapse progresses enough to matter.
 */
export function KindredStickyMasthead({
  scrollY,
  leading,
  trailing,
  wordmark = "KINDRED",
  subtitle,
  style,
}: StickyProps) {
  const { compactOpacity, compactTranslateY } = mastheadCollapse(scrollY);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const threshold = MASTHEAD_COLLAPSE_DISTANCE * 0.55;
    const id = scrollY.addListener(({ value }) => {
      setInteractive(value >= threshold);
    });
    return () => {
      scrollY.removeListener(id);
    };
  }, [scrollY]);

  return (
    <Animated.View
      pointerEvents={interactive ? "box-none" : "none"}
      style={[
        styles.stickyWrap,
        style,
        {
          opacity: compactOpacity,
          transform: [{ translateY: compactTranslateY }],
        },
      ]}
      accessibilityRole="header"
      accessibilityLabel="Kindred"
    >
      <View style={styles.stickyInner} pointerEvents="box-none">
        <View style={styles.stickySide} pointerEvents="box-none">
          {leading}
        </View>

        <View style={styles.stickyCenter} pointerEvents="none">
          <Text style={styles.stickyWordmark} maxFontSizeMultiplier={1.1}>
            {wordmark}
          </Text>
          {subtitle ? (
            <Text style={styles.stickySubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.stickySideEnd} pointerEvents="box-none">
          {trailing}
        </View>
      </View>
      <View style={styles.stickyRule} accessibilityElementsHidden />
    </Animated.View>
  );
}

type LinkProps = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  muted?: boolean;
};

/** Quiet masthead action — italic Georgia, terracotta ink. */
export function MastheadLink({
  label,
  onPress,
  accessibilityLabel,
  muted,
}: LinkProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => pressed && styles.linkPressed}
    >
      <Text style={[styles.link, muted && styles.linkMuted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: {
    alignItems: "center",
    marginBottom: space.afterMasthead,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  fullCompact: {
    marginBottom: 4,
    paddingBottom: 10,
  },
  fullDense: {
    marginBottom: 2,
    paddingBottom: 10,
  },
  fullChrome: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    minHeight: 28,
  },
  fullChromeCompact: {
    marginBottom: 10,
  },
  fullChromeDense: {
    marginBottom: 8,
    minHeight: 22,
  },
  fullChromeSide: {
    flex: 1,
    alignItems: "flex-start",
  },
  fullChromeSideEnd: {
    flex: 1,
    alignItems: "flex-end",
  },
  eyebrow: {
    ...type.kicker,
    color: paper.inkFaint,
    letterSpacing: 2.4,
    marginBottom: 10,
  },
  nameplate: {
    ...type.nameplate,
    color: paper.ink,
    textAlign: "center",
    marginBottom: 12,
  },
  nameplateCompact: {
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  nameplateDense: {
    marginBottom: 6,
  },
  nameplateRule: {
    width: 40,
    height: 1,
    backgroundColor: paper.terracotta,
    opacity: 0.55,
    marginBottom: 12,
  },
  nameplateRuleDense: {
    marginBottom: 8,
  },
  date: {
    ...type.nameplateMeta,
    color: paper.inkMuted,
    textAlign: "center",
  },
  weather: {
    ...type.nameplateMeta,
    fontStyle: "italic",
    color: paper.inkFaint,
    textAlign: "center",
    marginTop: 4,
  },
  meta: {
    ...type.kicker,
    color: paper.inkMuted,
    letterSpacing: 1.8,
    marginTop: 10,
  },
  metaDense: {
    marginTop: 6,
  },
  stickyWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: paper.chrome,
  },
  stickyInner: {
    height: MASTHEAD_COMPACT_HEIGHT,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickySide: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  stickySideEnd: {
    flex: 1,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  stickyCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  stickyWordmark: {
    ...type.masthead,
    color: paper.ink,
    letterSpacing: 3.6,
  },
  stickySubtitle: {
    marginTop: 2,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: paper.inkFaint,
    fontWeight: "600",
    maxWidth: 140,
  },
  stickyRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  link: {
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.2,
  },
  linkMuted: {
    color: paper.inkMuted,
  },
  linkPressed: {
    opacity: 0.72,
  },
});
