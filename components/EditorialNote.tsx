import { Text, View, StyleSheet } from "react-native";
import { paper, type } from "../lib/edition/newspaperTheme";

type Props = {
  /** Small terracotta kicker — e.g. "Why this matters" */
  kicker: string;
  body: string;
  /** Optional quieter second line */
  aside?: string | null;
  compact?: boolean;
};

/**
 * Magazine sidebar aside — desk note on cream wash,
 * not a bordered product card.
 */
export function EditorialNote({ kicker, body, aside, compact }: Props) {
  if (!body.trim()) return null;

  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact]}
      accessible
      accessibilityLabel={`${kicker}. ${body}`}
    >
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
