import { Pressable, StyleSheet, Text, View } from "react-native";
import { paper, press, reader, type } from "../lib/edition/newspaperTheme";

type Props = {
  source?: string;
  onReturn: () => void;
  returnLabel?: string;
};

/**
 * Quiet magazine close — colophon, cadence line, and return to the paper.
 * Shared by History Around Town and other long-form editorial readers.
 */
export function ArticleEditorialClosing({
  source = "Kindred",
  onReturn,
  returnLabel = "← Back to the Morning Paper",
}: Props) {
  return (
    <>
      <View style={styles.colophon} accessibilityRole="text">
        <View style={styles.footerRule} />
        <Text style={styles.endMark}>◆</Text>
        <Text style={styles.attribution} maxFontSizeMultiplier={1.15}>
          From this morning’s paper · {source}
        </Text>
        <Text style={styles.closingCadence} maxFontSizeMultiplier={1.25}>
          That is the end of this story. Sit with it a moment.
        </Text>
      </View>

      <View style={styles.continueBlock}>
        <Text style={styles.continueKicker} maxFontSizeMultiplier={1.1}>
          Continue Reading
        </Text>
        <Pressable
          onPress={onReturn}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={returnLabel.replace(/^←\s*/, "Back to ")}
          style={({ pressed }) => [styles.returnRow, pressed && styles.pressed]}
        >
          <Text style={styles.returnLink} maxFontSizeMultiplier={1.15}>
            {returnLabel}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  colophon: {
    marginTop: 36,
    alignItems: "center",
    gap: 14,
  },
  footerRule: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 8,
  },
  endMark: {
    fontSize: 10,
    color: paper.inkFaint,
    letterSpacing: 1,
  },
  attribution: {
    ...reader.meta,
    color: paper.inkMuted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textAlign: "center",
  },
  closingCadence: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 28,
    fontStyle: "italic",
    color: paper.inkBody,
    textAlign: "center",
    maxWidth: 360,
  },
  continueBlock: {
    marginTop: 48,
    paddingTop: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
    alignItems: "center",
  },
  continueKicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.2,
    marginBottom: 20,
  },
  returnRow: {
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  returnLink: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.15,
  },
  pressed: {
    opacity: press.opacity,
  },
});
