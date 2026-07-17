import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { MorningHeroExperience } from "../lib/edition/heroArtwork/types";
import { heroFrameHeight } from "../lib/edition/heroArtwork/imageSpec";
import { homepageMasterpieceSummary } from "../lib/edition/heroArtwork/homeSummary";
import { masterpieceTitleLine } from "../lib/edition/heroArtwork/formatTitle";
import { MasterpieceFrame } from "./MasterpieceFrame";
import { kindredGold, masterpiece, paper } from "../lib/edition/newspaperTheme";

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
 * Today's Masterpiece — nearly full-bleed artwork with homepage teaser copy.
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
  const frameWidth = containerWidth - masterpiece.edgeMargin * 2;
  const imageInnerWidth = frameWidth - masterpiece.frameChrome;
  const heroHeight = heroFrameHeight(
    imageInnerWidth,
    morningHero.imageWidth,
    morningHero.imageHeight,
    morningHero.aspectRatio,
    520
  );

  const titleWithYear = masterpieceTitleLine(morningHero);

  const summary = homepageMasterpieceSummary(morningHero.aboutArtworkBody);

  const content = (
    <>
      <Text style={styles.heading} maxFontSizeMultiplier={1.1}>
        🎨 TODAY'S MASTERPIECE
      </Text>

      <View style={styles.frameWrap}>
        <MasterpieceFrame
          imageUri={imageUri}
          width={frameWidth}
          height={heroHeight}
          imageOpacity={imageOpacity}
          onImageError={onImageError}
          accessibilityLabel={`${titleWithYear} by ${morningHero.artist}`}
        />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} maxFontSizeMultiplier={1.15}>
          {titleWithYear}
        </Text>
        <Text style={styles.artist} maxFontSizeMultiplier={1.15}>
          {morningHero.artist}
        </Text>
        {summary ? (
          <Text style={styles.summary} maxFontSizeMultiplier={1.15}>
            {summary}
            {onOpenMasterpiece ? (
              <Text style={styles.readMore}> Read more →</Text>
            ) : null}
          </Text>
        ) : null}
      </View>
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
  heading: {
    paddingHorizontal: masterpiece.edgeMargin,
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: kindredGold.primary,
    fontWeight: "600",
    marginBottom: 24,
  },
  frameWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  copy: {
    paddingHorizontal: masterpiece.edgeMargin,
    marginTop: 28,
    maxWidth: 560,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 21,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: paper.ink,
    fontWeight: "600",
  },
  artist: {
    marginTop: 12,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
  },
  summary: {
    marginTop: 18,
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 27,
    color: paper.inkBody,
  },
  readMore: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 27,
    color: kindredGold.primary,
    letterSpacing: 0.1,
  },
});
