import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { MorningHeroExperience } from "../lib/edition/heroArtwork/types";
import { heroFrameHeight } from "../lib/edition/heroArtwork/imageSpec";
import { MasterpieceFrame } from "./MasterpieceFrame";
import { kindredGold, paper, space } from "../lib/edition/newspaperTheme";

const FOLIO_GUTTER = space.folioGutter;

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
 * Today's Masterpiece — homepage teaser only.
 * Artwork, title, artist. Full editorial story opens on tap.
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
  const imageWidth = containerWidth - FOLIO_GUTTER * 2;
  const heroHeight = heroFrameHeight(
    imageWidth,
    morningHero.imageWidth,
    morningHero.imageHeight,
    morningHero.aspectRatio
  );

  const titleWithYear = morningHero.year
    ? `${morningHero.artworkTitle} (${morningHero.year})`
    : morningHero.artworkTitle;

  const content = (
    <>
      <Text style={styles.heading} maxFontSizeMultiplier={1.1}>
        🎨 TODAY'S MASTERPIECE
      </Text>

      <View style={styles.frameWrap}>
        <MasterpieceFrame
          imageUri={imageUri}
          width={imageWidth}
          height={heroHeight}
          imageOpacity={imageOpacity}
          onImageError={onImageError}
          accessibilityLabel={`${morningHero.artworkTitle} by ${morningHero.artist}`}
        />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title} maxFontSizeMultiplier={1.15}>
          {titleWithYear}
        </Text>
        <Text style={styles.artist} maxFontSizeMultiplier={1.15}>
          {morningHero.artist}
        </Text>
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
    paddingHorizontal: FOLIO_GUTTER,
    marginBottom: 4,
  },
  heading: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: kindredGold.deep,
    fontWeight: "600",
    marginBottom: 14,
  },
  frameWrap: {
    alignItems: "center",
  },
  copy: {
    marginTop: 16,
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
    marginTop: 6,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
  },
});
