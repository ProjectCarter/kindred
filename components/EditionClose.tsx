import { Text, View, Pressable, StyleSheet, Share } from "react-native";
import { paper, press, space } from "../lib/edition/newspaperTheme";
import {
  editionColophon,
  editionFarewell,
} from "../lib/edition/morningRitual";
import { FolioReveal } from "./FolioReveal";

type Props = {
  editionDateLabel?: string | null;
  /** Optional custom share; defaults to a calm Share sheet. */
  onShareEdition?: () => void;
  folioIndex?: number;
};

/**
 * Satisfying close to today’s paper — not an abrupt scroll stop.
 */
export function EditionClose({
  editionDateLabel,
  onShareEdition,
  folioIndex = 12,
}: Props) {
  async function share() {
    if (onShareEdition) {
      onShareEdition();
      return;
    }
    try {
      const dateBit = editionDateLabel ? ` — ${editionDateLabel}` : "";
      await Share.share({
        message: `Today’s Kindred edition${dateBit}.`,
      });
    } catch {
      /* reader cancelled */
    }
  }

  return (
    <FolioReveal index={folioIndex}>
      <View style={styles.wrap} accessibilityRole="summary">
        <View style={styles.rule} />
        <Text style={styles.colophon}>{editionColophon()}</Text>
        <Text style={styles.farewell}>{editionFarewell()}</Text>
        <Text style={styles.sign}>— Bandit</Text>

        <Pressable
          onPress={() => void share()}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Share today’s edition"
        >
          <Text style={styles.actionText}>Share today’s edition</Text>
        </Pressable>
      </View>
    </FolioReveal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: space.endPadding,
    paddingBottom: 8,
    alignItems: "center",
  },
  rule: {
    width: 64,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkMuted,
    opacity: 0.35,
    marginBottom: 26,
  },
  colophon: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkMuted,
    textAlign: "center",
    marginBottom: 10,
    maxWidth: 320,
  },
  farewell: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.ink,
    textAlign: "center",
    marginBottom: 16,
  },
  sign: {
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.inkFaint,
    letterSpacing: 0.2,
    marginBottom: 24,
  },
  action: {
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: "center",
  },
  actionText: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.15,
  },
  pressed: {
    opacity: press.opacity,
  },
});
