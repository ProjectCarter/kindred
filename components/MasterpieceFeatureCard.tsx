import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { MorningHeroExperience } from "../lib/edition/heroArtwork/types";
import { homepageMasterpieceSummary } from "../lib/edition/heroArtwork/homeSummary";
import { resolveMasterpieceDisplayTitle } from "../lib/edition/heroArtwork/displayTitle";
import { resolveArtworkYear } from "../lib/edition/heroArtwork/resolveYear";
import { paper } from "../lib/edition/newspaperTheme";

/** Deep Kindred purple — border + label accent for Today's Masterpiece. */
const MASTERPIECE_ACCENT = "#6E46D9";
/** Subtle "tappable" affordance — quiet enough not to draw attention. */
const CHEVRON_COLOR = "#BCB4A9";

export type MasterpieceFeatureCardProps = {
  morningHero: MorningHeroExperience;
  imageUri: string;
  onOpenMasterpiece?: () => void;
  onImageError?: () => void;
};

/**
 * Today's Masterpiece — premium featured card: artwork on the left, stacked copy
 * on the right, a single chevron affordance, and the reserved Kindred purple
 * border/label. The entire card opens the full artwork reader.
 */
export function MasterpieceFeatureCard({
  morningHero,
  imageUri,
  onOpenMasterpiece,
  onImageError,
}: MasterpieceFeatureCardProps) {
  const { displayTitle } = resolveMasterpieceDisplayTitle(morningHero.artworkTitle);
  const year = resolveArtworkYear(morningHero);
  const byline = [morningHero.artist?.trim(), year?.trim()]
    .filter(Boolean)
    .join(" • ");
  const summary = homepageMasterpieceSummary(morningHero.aboutArtworkBody);

  const inner = (
    <View style={styles.row}>
      <Image
        source={{ uri: imageUri }}
        style={styles.artwork}
        resizeMode="cover"
        onError={onImageError}
        accessibilityIgnoresInvertColors
      />

      <View style={styles.textCol}>
        <Text style={styles.label} maxFontSizeMultiplier={1.1}>
          TODAY'S MASTERPIECE
        </Text>
        <Text style={styles.title} maxFontSizeMultiplier={1.15} numberOfLines={2}>
          {displayTitle}
        </Text>
        {byline ? (
          <Text style={styles.byline} maxFontSizeMultiplier={1.15} numberOfLines={1}>
            {byline}
          </Text>
        ) : null}
        {summary ? (
          <Text
            style={styles.summary}
            maxFontSizeMultiplier={1.15}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {summary}
          </Text>
        ) : null}
      </View>

      <Text style={styles.chevron} maxFontSizeMultiplier={1.1} accessibilityElementsHidden>
        ›
      </Text>
    </View>
  );

  if (onOpenMasterpiece) {
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={onOpenMasterpiece}
        accessibilityRole="button"
        accessibilityLabel={`Today's Masterpiece: ${displayTitle}${
          byline ? `, ${byline}` : ""
        }. Tap to read the full story.`}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`Today's Masterpiece: ${displayTitle}`}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: MASTERPIECE_ACCENT,
    borderRadius: 20,
    backgroundColor: paper.cream,
    paddingVertical: 20,
    paddingLeft: 18,
    paddingRight: 22,
  },
  pressed: {
    opacity: 0.92,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  artwork: {
    width: 147,
    height: 172,
    borderRadius: 14,
    marginRight: 18,
    backgroundColor: paper.creamDeep,
  },
  textCol: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 4,
  },
  label: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    fontWeight: "700",
    color: MASTERPIECE_ACCENT,
    marginBottom: 8,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.3,
    fontWeight: "700",
    color: paper.ink,
  },
  byline: {
    marginTop: 6,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 21,
    color: "#555555",
  },
  summary: {
    marginTop: 10,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: "#555555",
  },
  chevron: {
    fontSize: 20,
    lineHeight: 24,
    color: CHEVRON_COLOR,
    marginLeft: 14,
    alignSelf: "center",
  },
});
