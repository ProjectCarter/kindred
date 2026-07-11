import { useRef, useState } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
} from "react-native";
import type { MorningBriefing as MorningBriefingType } from "../lib/edition/morningEdition";
import { paper, type } from "../lib/edition/newspaperTheme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  opening?: MorningBriefingType | null;
  briefing?: MorningBriefingType | null;
};

/**
 * Morning Edition AI — calm briefing under Bandit.
 * Opening shows by default; full 60s expands with a soft layout animation.
 */
export function MorningBriefing({ opening, briefing }: Props) {
  const [expanded, setExpanded] = useState(false);
  const press = useRef(new Animated.Value(1)).current;
  const shortText = opening?.text?.trim() || briefing?.text?.trim();
  const longText = briefing?.text?.trim();
  if (!shortText) return null;

  const showExpand =
    Boolean(longText) &&
    longText !== shortText &&
    (longText?.length ?? 0) > (shortText.length + 40);

  const body = expanded && longText ? longText : shortText;
  const seconds =
    expanded && longText
      ? briefing?.estimatedSeconds ?? 60
      : opening?.estimatedSeconds ?? 20;

  function toggle() {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        320,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
    setExpanded((v) => !v);
  }

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`This morning’s edition. ${body}`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>This morning’s edition</Text>
        <Text style={styles.timing}>
          {seconds <= 25 ? "A breath" : "A quiet minute"}
        </Text>
      </View>
      <Text style={styles.body} maxFontSizeMultiplier={1.35}>
        {body}
      </Text>
      {showExpand ? (
        <Pressable
          onPress={toggle}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? "Show just the opening" : "Read a little more of the briefing"
          }
          onPressIn={() =>
            Animated.spring(press, {
              toValue: 0.97,
              useNativeDriver: true,
              friction: 7,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(press, {
              toValue: 1,
              useNativeDriver: true,
              friction: 7,
            }).start()
          }
        >
          <Animated.Text
            style={[styles.toggle, { transform: [{ scale: press }] }]}
          >
            {expanded ? "Just the opening" : "Read a little more"}
          </Animated.Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 30,
    paddingBottom: 26,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
  },
  timing: {
    fontFamily: "Georgia",
    fontSize: 12,
    fontStyle: "italic",
    color: paper.inkFaint,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 29,
    color: paper.inkBody,
    letterSpacing: 0.12,
  },
  toggle: {
    marginTop: 18,
    fontFamily: "Georgia",
    fontSize: 14,
    letterSpacing: 0.2,
    color: paper.terracotta,
    fontStyle: "italic",
  },
});
