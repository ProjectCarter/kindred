import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { paper } from "../lib/edition/newspaperTheme";

/**
 * Kindred detail hero — the single visual identity for every detail page.
 *
 * A large rounded card in the section accent color carrying ONLY a large emoji,
 * the item title, and a small category pill. No photographs, no image
 * placeholders — the emoji and color are the identity. Per Kindred's detail
 * design law, this emoji must never be repeated elsewhere on the page.
 */
export function DetailHeroCard({
  emoji,
  title,
  categoryLabel,
  accent,
  style,
}: {
  emoji: string;
  title: string;
  categoryLabel: string;
  accent: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.hero, { backgroundColor: accent }, style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${title}. ${categoryLabel}.`}
    >
      <Text style={styles.emoji} allowFontScaling={false}>
        {emoji}
      </Text>
      <Text style={styles.title} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
      {categoryLabel ? (
        <View style={styles.pill}>
          <Text style={styles.pillText} maxFontSizeMultiplier={1.1}>
            {categoryLabel.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Tinted "About" card — a subtle, ~12% wash of the section accent that connects
 * the hero to a short, highlighted summary. Not the full article; the one reason
 * this item is worth attention.
 */
export function DetailAboutCard({
  label,
  body,
  tint,
  style,
}: {
  label: string;
  body: string;
  tint: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.about, { backgroundColor: tint }, style]}>
      <Text style={styles.aboutLabel} maxFontSizeMultiplier={1.2}>
        {label.toUpperCase()}
      </Text>
      <Text style={styles.aboutBody} maxFontSizeMultiplier={1.35}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: "100%",
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 64,
    lineHeight: 74,
    marginBottom: 16,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: paper.ink,
    textAlign: "center",
    maxWidth: "94%",
  },
  pill: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFFC2",
  },
  pillText: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: paper.ink,
  },
  about: {
    width: "100%",
    borderRadius: 18,
    padding: 20,
  },
  aboutLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: paper.inkMuted,
    marginBottom: 10,
  },
  aboutBody: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 26,
    color: paper.inkBody,
  },
});
