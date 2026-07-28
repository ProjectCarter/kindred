import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { MorningHeroExperience } from "../lib/edition/heroArtwork/types";
import { resolveMasterpieceDisplayTitle } from "../lib/edition/heroArtwork/displayTitle";
import { resolveArtworkYear } from "../lib/edition/heroArtwork/resolveYear";
import { paper } from "../lib/edition/newspaperTheme";

/** Kindred purple — the "TODAY'S MASTERPIECE" label accent (tuned for dark). */
const MASTERPIECE_ACCENT = "#9B7BEA";
/**
 * Deeper, richer premium violet for the card frame — more presence against the
 * charcoal background than the label lavender, elegant and understated (never
 * neon or glowing). Matched to the reference border.
 */
const MASTERPIECE_BORDER = "#7357DE";
/** Subtle "tappable" affordance — quiet enough not to draw attention. */
const CHEVRON_COLOR = "#75777F";

/**
 * Wide, short "hero" presentation ratio (width ÷ height). The homepage card is a
 * teaser — a rectangular banner keeps the card compact so more Events/Activities
 * stay on screen, while the full artwork lives on the detail screen. Tuned to the
 * reference (~2:1). We never present *taller* than this: for tall/portrait art we
 * crop to this banner; for art that is naturally wider we honor its true ratio
 * (even shorter), so the frame is always at least this rectangular.
 */
const HERO_ASPECT_RATIO = 2;
/**
 * Safety cap so an unusually wide panorama can't get too short to read as a hero.
 */
const HERO_MAX_ASPECT_RATIO = 2.6;

/**
 * Presentation ratio for the banner: at least {@link HERO_ASPECT_RATIO} wide, and
 * honoring naturally wider artwork up to {@link HERO_MAX_ASPECT_RATIO}. Responsive
 * — paired with `width: "100%"` the height follows the card width on any device.
 */
function resolveHeroRatio(morningHero: MorningHeroExperience): number {
  const { imageWidth, imageHeight, aspectRatio } = morningHero;
  const naturalRatio =
    imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0
      ? imageWidth / imageHeight
      : aspectRatio && aspectRatio > 0
        ? aspectRatio
        : HERO_ASPECT_RATIO;

  return Math.min(HERO_MAX_ASPECT_RATIO, Math.max(HERO_ASPECT_RATIO, naturalRatio));
}

export type MasterpieceFeatureCardProps = {
  morningHero: MorningHeroExperience;
  imageUri: string;
  onOpenMasterpiece?: () => void;
  onImageError?: () => void;
};

/**
 * Today's Masterpiece — premium featured card: large artwork across the top,
 * masterpiece copy stacked below (purple label, serif title, artist · year),
 * a single chevron affordance, and the reserved Kindred purple border. The
 * entire card opens the full artwork reader.
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
    .join(" · ");
  const ratio = resolveHeroRatio(morningHero);

  const inner = (
    <>
      <Image
        source={{ uri: imageUri }}
        style={[styles.artwork, { aspectRatio: ratio }]}
        resizeMode="cover"
        onError={onImageError}
        accessibilityIgnoresInvertColors
      />

      <View style={styles.textRow}>
        <View style={styles.textCol}>
          <Text style={styles.label} maxFontSizeMultiplier={1.1}>
            TODAY'S MASTERPIECE
          </Text>
          <Text style={styles.title} maxFontSizeMultiplier={1.15} numberOfLines={3}>
            {displayTitle}
          </Text>
          {byline ? (
            <Text style={styles.byline} maxFontSizeMultiplier={1.15} numberOfLines={1}>
              {byline}
            </Text>
          ) : null}
        </View>

        <Text style={styles.chevron} maxFontSizeMultiplier={1.1} accessibilityElementsHidden>
          ›
        </Text>
      </View>
    </>
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
    borderWidth: 2.5,
    borderColor: MASTERPIECE_BORDER,
    borderRadius: 18,
    backgroundColor: paper.cream,
    padding: 8,
  },
  pressed: {
    opacity: 0.92,
  },
  artwork: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: paper.creamDeep,
  },
  textRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 2,
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    fontWeight: "700",
    color: MASTERPIECE_ACCENT,
    marginBottom: 3,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
    fontWeight: "700",
    color: paper.ink,
  },
  byline: {
    marginTop: 4,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 21,
    color: paper.inkMuted,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 26,
    color: CHEVRON_COLOR,
    marginLeft: 12,
    alignSelf: "center",
  },
});
