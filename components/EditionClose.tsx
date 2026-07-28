import { StyleSheet, Text, View } from "react-native";
import { paper } from "../lib/edition/newspaperTheme";

/**
 * Gold accent — the same warm tone as the app's "See all" links. Used for the
 * highlighted D · R · O · P initials and the tagline beneath.
 */
const SIGNATURE_GOLD = paper.terracotta;
/** Kindred purple accent — matches the "Today's Masterpiece" label. */
const SIGNATURE_PURPLE = "#9B7BEA";

type Props = {
  editionDateLabel?: string | null;
  /** Retained for call-site stability; the branded footer takes no actions. */
  onShareEdition?: () => void;
  folioIndex?: number;
};

/**
 * Kindred brand signature — the calm close to today's edition.
 *
 * Two centered lines that quietly reveal the D.R.O.P. wordmark: the initials of
 * "Daily Recommended Offers & Places" are drawn in gold while the rest of each
 * word sits in Kindred purple, so the acronym surfaces without ever being
 * spelled out. Refined and timeless — no dividers, buttons, icons, or motion.
 */
export function EditionClose(_props: Props) {
  return (
    <View style={styles.wrap}>
      <Text
        style={styles.signature}
        maxFontSizeMultiplier={1.15}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel="Daily Recommended Offers and Places"
      >
        <Text style={styles.gold}>D</Text>
        <Text style={styles.purple}>aily </Text>
        <Text style={styles.gold}>R</Text>
        <Text style={styles.purple}>ecommended </Text>
        <Text style={styles.gold}>O</Text>
        <Text style={styles.purple}>ffers </Text>
        <Text style={styles.purple}>& </Text>
        <Text style={styles.gold}>P</Text>
        <Text style={styles.purple}>laces</Text>
      </Text>

      <Text style={styles.tagline} maxFontSizeMultiplier={1.15}>
        Discover More. Spend Less.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 40,
    paddingBottom: 28,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  signature: {
    fontFamily: "Georgia",
    fontSize: 17.5,
    lineHeight: 25,
    letterSpacing: 0.2,
    fontWeight: "600",
    textAlign: "center",
  },
  gold: {
    color: SIGNATURE_GOLD,
  },
  purple: {
    color: SIGNATURE_PURPLE,
  },
  tagline: {
    marginTop: 14,
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.3,
    color: SIGNATURE_GOLD,
    textAlign: "center",
  },
});
