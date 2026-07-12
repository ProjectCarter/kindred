import { Text, View, StyleSheet, Pressable } from "react-native";
import { paper, press, type } from "../lib/edition/newspaperTheme";

type Props = {
  /** Small terracotta kicker — e.g. "Why this matters" */
  kicker: string;
  body: string;
  /** Optional quieter second line */
  aside?: string | null;
  compact?: boolean;
  /** When set, the whole note opens more content (native reader). */
  onPress?: () => void;
};

/**
 * Magazine sidebar aside — desk note on cream wash,
 * not a bordered product card.
 */
export function EditorialNote({
  kicker,
  body,
  aside,
  compact,
  onPress,
}: Props) {
  if (!body.trim()) return null;

  const content = (
    <View style={styles.inner}>
      <View style={styles.rule} />
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.body} maxFontSizeMultiplier={1.35}>
        {body.trim()}
      </Text>
      {aside?.trim() ? (
        <Text style={styles.aside} maxFontSizeMultiplier={1.25}>
          {aside.trim()}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={`${kicker}. ${body}. Open to read more.`}
        hitSlop={6}
        style={({ pressed }) => [
          styles.wrap,
          compact && styles.wrapCompact,
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessible
      accessibilityLabel={`${kicker}. ${body}`}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 22,
  },
  wrapCompact: {
    marginBottom: 14,
  },
  pressed: {
    opacity: press.opacity,
  },
  inner: {
    backgroundColor: paper.creamWash,
    borderRadius: 1,
    paddingVertical: 18,
    paddingHorizontal: 18,
    paddingLeft: 20,
    overflow: "hidden",
  },
  rule: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: paper.terracotta,
    opacity: 0.75,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 9,
    letterSpacing: 1.9,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 25,
    color: paper.inkBody,
    fontStyle: "italic",
  },
  aside: {
    marginTop: 10,
    fontFamily: "Georgia",
    fontSize: 12,
    lineHeight: 18,
    color: paper.inkFaint,
    letterSpacing: 0.2,
  },
});
