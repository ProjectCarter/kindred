import { Text, View, StyleSheet } from "react-native";
import { paper } from "../lib/edition/newspaperTheme";
import {
  editionColophon,
  editionFarewell,
} from "../lib/edition/morningRitual";

/**
 * Satisfying close to today’s paper — not an abrupt scroll stop.
 */
export function EditionClose() {
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.rule} />
      <Text style={styles.colophon}>{editionColophon()}</Text>
      <Text style={styles.farewell}>{editionFarewell()}</Text>
      <Text style={styles.sign}>— Bandit</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingBottom: 0,
    alignItems: "center",
  },
  rule: {
    width: 64,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkMuted,
    opacity: 0.35,
    marginVertical: 26,
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
    marginBottom: 0,
  },
});
