import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { MorningHeroExperience } from "../lib/edition/heroArtwork/types";
import { heroFrameHeight } from "../lib/edition/heroArtwork/imageSpec";
import { renderMasterpieceCreditLine } from "../lib/edition/heroArtwork/attribution";
import { renderMasterpieceDetail } from "../lib/edition/heroArtwork/detail";
import { paper, press, shadow } from "../lib/edition/newspaperTheme";

export type MasterpieceReaderProps = {
  morningHero: MorningHeroExperience;
  onBack: () => void;
  backLabel?: string;
};

/**
 * Today's Masterpiece detail — museum catalog meets morning newspaper.
 * Renders only pre-stored fields; no fetch or generation at open time.
 */
export function MasterpieceReader({
  morningHero,
  onBack,
  backLabel = "← Today's paper",
}: MasterpieceReaderProps) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, 680);
  const heroHeight = heroFrameHeight(
    contentWidth,
    morningHero.imageWidth,
    morningHero.imageHeight,
    morningHero.aspectRatio,
    520
  );

  const detail = renderMasterpieceDetail(morningHero);
  const creditLine = renderMasterpieceCreditLine(morningHero);
  const titleWithYear = morningHero.year
    ? `${morningHero.artworkTitle} (${morningHero.year})`
    : morningHero.artworkTitle;
  const artistLine = morningHero.year
    ? `${morningHero.artist} · ${morningHero.year}`
    : morningHero.artist;

  const visitUrl =
    detail?.officialArtworkUrl?.trim() ||
    detail?.officialMuseumUrl?.trim() ||
    morningHero.sourceUrl?.trim() ||
    null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={onBack}
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel={backLabel.replace(/^←\s*/, "Back to ")}
        >
          <Text style={styles.back}>{backLabel}</Text>
        </Pressable>

        <View style={styles.heroFrame}>
          <Image
            source={{ uri: morningHero.hostedUrl }}
            style={{ width: contentWidth, height: heroHeight }}
            resizeMode="cover"
            accessibilityLabel={`${morningHero.artworkTitle} by ${morningHero.artist}`}
          />
        </View>

        <View style={[styles.body, { maxWidth: contentWidth }]}>
          <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
            Today's Masterpiece
          </Text>

          <Text style={styles.title} maxFontSizeMultiplier={1.2}>
            {titleWithYear}
          </Text>

          <Text style={styles.artist} maxFontSizeMultiplier={1.15}>
            {artistLine}
          </Text>

          {creditLine ? (
            <Text style={styles.credit} maxFontSizeMultiplier={1.05}>
              {creditLine}
            </Text>
          ) : null}

          <View style={styles.rule} />

          <Text style={styles.intro} maxFontSizeMultiplier={1.15}>
            Every masterpiece has a story. Here's today's.
          </Text>

          {detail ? (
            <>
              <View style={styles.story}>
                {detail.longStoryParagraphs.map((paragraph, index) => (
                  <Text
                    key={`story-${index}`}
                    style={[
                      styles.paragraph,
                      index === 0 && styles.leadParagraph,
                    ]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {paragraph}
                  </Text>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>About the Artist</Text>
                <Text style={styles.paragraph} maxFontSizeMultiplier={1.2}>
                  {detail.artistBiography}
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Look Closer</Text>
                {detail.lookCloserItems.map((item, index) => (
                  <Text
                    key={`look-${index}`}
                    style={styles.observation}
                    maxFontSizeMultiplier={1.15}
                  >
                    {item}
                  </Text>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Did You Know?</Text>
                <Text style={styles.paragraph} maxFontSizeMultiplier={1.2}>
                  {detail.didYouKnow}
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Visit the Original</Text>
                <Text style={styles.museumName} maxFontSizeMultiplier={1.15}>
                  {detail.museumName}
                </Text>
                <Text style={styles.museumLocation} maxFontSizeMultiplier={1.15}>
                  {detail.museumLocation}
                </Text>
                {visitUrl ? (
                  <Pressable
                    onPress={() => {
                      void Linking.openURL(visitUrl).catch(() => {});
                    }}
                    style={({ pressed }) => [
                      styles.visitLink,
                      pressed && { opacity: press.opacity },
                    ]}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${detail.museumName} collection page`}
                  >
                    <Text style={styles.visitLinkText}>View at the museum</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.skeletonLineWide} />
              <View style={styles.skeletonLine} />
              <View style={styles.skeletonLine} />
              <View style={styles.skeletonLineShort} />
              <Text style={styles.placeholderCopy} maxFontSizeMultiplier={1.1}>
                The full story for this masterpiece is not yet available in
                today's edition.
              </Text>
            </View>
          )}

          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.returnRow,
              pressed && { opacity: press.opacity },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Return to today's paper"
          >
            <Text style={styles.returnText}>Return to today's paper</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: paper.page,
  },
  scroll: {
    paddingBottom: 72,
    alignItems: "center",
  },
  backRow: {
    alignSelf: "stretch",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  back: {
    fontSize: 15,
    color: paper.terracotta,
    letterSpacing: 0.2,
  },
  heroFrame: {
    alignSelf: "stretch",
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    ...shadow.photo,
  },
  body: {
    alignSelf: "stretch",
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  kicker: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: paper.inkMuted,
    fontWeight: "600",
    marginBottom: 14,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.35,
    color: paper.ink,
    fontWeight: "600",
  },
  artist: {
    marginTop: 10,
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 24,
    color: paper.inkMuted,
  },
  credit: {
    marginTop: 16,
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 0.15,
    color: paper.inkFaint,
  },
  rule: {
    marginTop: 28,
    marginBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  intro: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 28,
    fontStyle: "italic",
    color: paper.inkBody,
    marginBottom: 24,
    maxWidth: 520,
  },
  story: {
    marginBottom: 12,
  },
  paragraph: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 28,
    color: paper.inkBody,
    marginBottom: 18,
    maxWidth: 560,
  },
  leadParagraph: {
    fontSize: 18,
    lineHeight: 30,
  },
  section: {
    marginTop: 28,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  sectionLabel: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: paper.inkMuted,
    fontWeight: "600",
    marginBottom: 14,
  },
  observation: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
    marginBottom: 12,
    maxWidth: 540,
  },
  museumName: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    color: paper.ink,
    fontWeight: "600",
  },
  museumLocation: {
    marginTop: 4,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
    marginBottom: 12,
  },
  visitLink: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  visitLinkText: {
    fontSize: 15,
    lineHeight: 22,
    color: paper.terracotta,
    letterSpacing: 0.15,
    textDecorationLine: "underline",
  },
  placeholder: {
    marginTop: 8,
    marginBottom: 16,
  },
  skeletonLineWide: {
    height: 12,
    backgroundColor: paper.creamDeep,
    borderRadius: 2,
    marginBottom: 12,
    width: "92%",
  },
  skeletonLine: {
    height: 12,
    backgroundColor: paper.creamDeep,
    borderRadius: 2,
    marginBottom: 12,
    width: "88%",
  },
  skeletonLineShort: {
    height: 12,
    backgroundColor: paper.creamDeep,
    borderRadius: 2,
    marginBottom: 20,
    width: "54%",
  },
  placeholderCopy: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkMuted,
    maxWidth: 480,
  },
  returnRow: {
    marginTop: 36,
    paddingVertical: 12,
  },
  returnText: {
    fontSize: 15,
    lineHeight: 22,
    color: paper.terracotta,
    letterSpacing: 0.15,
  },
});
