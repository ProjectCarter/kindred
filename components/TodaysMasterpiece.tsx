import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { MorningHeroExperience } from "../lib/edition/heroArtwork/types";
import { heroFrameHeight } from "../lib/edition/heroArtwork/imageSpec";
import { renderMasterpieceCreditLine } from "../lib/edition/heroArtwork/attribution";
import { paper, shadow } from "../lib/edition/newspaperTheme";

/** Side inset used by home folio — artwork bleeds past it for a cover presentation. */
const FOLIO_GUTTER = 28;

export type TodaysMasterpieceProps = {
  morningHero: MorningHeroExperience;
  imageUri: string;
  containerWidth: number;
  imageOpacity?: number;
  onOpenMasterpiece?: () => void;
  onImageError?: () => void;
  style?: ViewStyle;
};

/**
 * Today's Masterpiece — a calm, museum-quality morning tradition.
 * All copy and imagery come pre-frozen on morningHero; this component
 * renders only — no network, generation, or metadata fetching.
 *
 * Future: wire onOpenMasterpiece to a full artwork reader route.
 */
export function TodaysMasterpiece({
  morningHero,
  imageUri,
  containerWidth,
  imageOpacity = 1,
  onOpenMasterpiece,
  onImageError,
  style,
}: TodaysMasterpieceProps) {
  const heroHeight = heroFrameHeight(
    containerWidth,
    morningHero.imageWidth,
    morningHero.imageHeight,
    morningHero.aspectRatio
  );

  const titleWithYear = morningHero.year
    ? `${morningHero.artworkTitle} (${morningHero.year})`
    : morningHero.artworkTitle;

  const creditLine = renderMasterpieceCreditLine(morningHero);

  const content = (
    <>
      <View style={styles.sectionRule} accessibilityElementsHidden />

      <View style={styles.header}>
        <Text style={styles.heading} maxFontSizeMultiplier={1.1}>
          🎨 Today's Masterpiece
        </Text>
        <Text style={styles.tagline} maxFontSizeMultiplier={1.1}>
          One masterpiece. Every morning.
        </Text>
      </View>

      <View style={styles.imageBleed}>
        <View style={[styles.imageFrame, shadow.photo]}>
          <Image
            source={{ uri: imageUri }}
            style={{
              width: containerWidth,
              height: heroHeight,
              opacity: imageOpacity,
            }}
            resizeMode="cover"
            accessibilityLabel={`${morningHero.artworkTitle} by ${morningHero.artist}`}
            onError={onImageError}
          />
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} maxFontSizeMultiplier={1.15}>
          {titleWithYear}
        </Text>
        <Text style={styles.artist} maxFontSizeMultiplier={1.15}>
          {morningHero.artist}
        </Text>
        {morningHero.aboutArtworkBody ? (
          <Text style={styles.about} maxFontSizeMultiplier={1.2}>
            {morningHero.aboutArtworkBody}
          </Text>
        ) : null}
        {creditLine ? (
          <Text style={styles.attribution} maxFontSizeMultiplier={1.05}>
            {creditLine}
          </Text>
        ) : null}
      </View>

      <View style={styles.sectionRule} accessibilityElementsHidden />
    </>
  );

  if (onOpenMasterpiece) {
    return (
      <Pressable
        style={[styles.section, style]}
        onPress={onOpenMasterpiece}
        accessibilityRole="button"
        accessibilityLabel={`Today's Masterpiece: ${titleWithYear} by ${morningHero.artist}. Tap to read the full story.`}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.section, style]}
      accessibilityRole="summary"
      accessibilityLabel={`Today's Masterpiece: ${titleWithYear} by ${morningHero.artist}`}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 8,
  },
  sectionRule: {
    marginHorizontal: FOLIO_GUTTER,
    marginVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  header: {
    paddingHorizontal: FOLIO_GUTTER,
    marginBottom: 18,
  },
  heading: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: paper.inkMuted,
    fontWeight: "600",
  },
  tagline: {
    marginTop: 8,
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.15,
    color: paper.ink,
    fontStyle: "italic",
  },
  imageBleed: {
    marginHorizontal: -FOLIO_GUTTER,
  },
  imageFrame: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  copy: {
    paddingHorizontal: FOLIO_GUTTER,
    marginTop: 20,
    maxWidth: 560,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.25,
    color: paper.ink,
    fontWeight: "600",
  },
  artist: {
    marginTop: 8,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
  },
  about: {
    marginTop: 16,
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
  },
  attribution: {
    marginTop: 20,
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 0.15,
    color: paper.inkFaint,
  },
});
