import type { ReactNode } from "react";
import {
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
import { formatArtworkCreditBlock } from "../lib/edition/heroArtwork/credits";
import { renderMasterpieceDetail } from "../lib/edition/heroArtwork/detail";
import { MasterpieceFrame } from "./MasterpieceFrame";
import { MasterpieceLoading } from "./MasterpieceLoading";
import { kindredGold, paper, press, space } from "../lib/edition/newspaperTheme";

export type MasterpieceReaderProps = {
  morningHero: MorningHeroExperience;
  onBack: () => void;
  backLabel?: string;
};

function EditorialSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel} maxFontSizeMultiplier={1.1}>
        {heading}
      </Text>
      {children}
    </View>
  );
}

/**
 * Today's Masterpiece 2.0 — Smithsonian-caliber editorial on Kindred paper.
 */
export function MasterpieceReader({
  morningHero,
  onBack,
  backLabel = "← Today's paper",
}: MasterpieceReaderProps) {
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, 680);
  const frameWidth = contentWidth - space.folioGutter * 2;
  const heroHeight = heroFrameHeight(
    frameWidth - 32,
    morningHero.imageWidth,
    morningHero.imageHeight,
    morningHero.aspectRatio,
    480
  );

  const detail = renderMasterpieceDetail(morningHero);
  const credit = formatArtworkCreditBlock(morningHero);

  const titleWithYear = morningHero.year
    ? `${morningHero.artworkTitle} (${morningHero.year})`
    : morningHero.artworkTitle;

  if (!detail) {
    return <MasterpieceLoading backLabel={backLabel} onBack={onBack} />;
  }

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

        <View style={styles.heroWrap}>
          <MasterpieceFrame
            imageUri={morningHero.hostedUrl}
            width={frameWidth}
            height={heroHeight}
            accessibilityLabel={`${morningHero.artworkTitle} by ${morningHero.artist}`}
          />
        </View>

        <View style={[styles.body, { maxWidth: contentWidth }]}>
          <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
            TODAY'S MASTERPIECE
          </Text>

          <Text style={styles.title} maxFontSizeMultiplier={1.2}>
            {titleWithYear}
          </Text>

          <Text style={styles.artist} maxFontSizeMultiplier={1.15}>
            {morningHero.artist}
          </Text>

          <View style={styles.goldRule} />

          {detail.sections.map((section) => (
            <EditorialSection key={section.heading} heading={section.heading}>
              {section.paragraphs.map((paragraph, index) => (
                <Text
                  key={`${section.heading}-${index}`}
                  style={[
                    styles.paragraph,
                    section.heading === "Introduction" && index === 0
                      ? styles.leadParagraph
                      : null,
                  ]}
                  maxFontSizeMultiplier={1.2}
                >
                  {paragraph}
                </Text>
              ))}
            </EditorialSection>
          ))}

          <EditorialSection heading="Looking Closer">
            {detail.lookingCloser.map((item, index) => (
              <Text
                key={`look-${index}`}
                style={styles.observation}
                maxFontSizeMultiplier={1.15}
              >
                {item}
              </Text>
            ))}
          </EditorialSection>

          <EditorialSection heading="Did You Know?">
            <Text style={styles.paragraph} maxFontSizeMultiplier={1.2}>
              {detail.didYouKnow}
            </Text>
          </EditorialSection>

          <EditorialSection heading="Artwork Credit">
            <Text style={styles.creditTitle} maxFontSizeMultiplier={1.1}>
              {credit.title}
            </Text>
            <Text style={styles.creditLine} maxFontSizeMultiplier={1.1}>
              {credit.artist}
            </Text>
            <Text style={styles.creditLine} maxFontSizeMultiplier={1.1}>
              {credit.institution}
            </Text>
            <Text style={styles.creditLine} maxFontSizeMultiplier={1.1}>
              {credit.licenseLabel}
            </Text>
            {credit.sourceUrl ? (
              <Pressable
                onPress={() => {
                  void Linking.openURL(credit.sourceUrl!).catch(() => {});
                }}
                style={({ pressed }) => [
                  styles.sourceLink,
                  pressed && { opacity: press.opacity },
                ]}
                accessibilityRole="link"
                accessibilityLabel="Open source"
              >
                <Text style={styles.sourceLinkText}>Source Available</Text>
              </Pressable>
            ) : null}
          </EditorialSection>

          <EditorialSection heading="Visit the Original">
            <Text style={styles.museumName} maxFontSizeMultiplier={1.15}>
              {detail.museumName}
            </Text>
            <Text style={styles.museumLocation} maxFontSizeMultiplier={1.15}>
              {detail.museumLocation}
            </Text>
          </EditorialSection>

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
    paddingHorizontal: space.folioGutter,
    paddingVertical: 12,
  },
  back: {
    fontSize: 15,
    color: kindredGold.primary,
    letterSpacing: 0.2,
  },
  heroWrap: {
    paddingHorizontal: space.folioGutter,
    marginBottom: 8,
  },
  body: {
    alignSelf: "stretch",
    paddingHorizontal: space.folioGutter,
    paddingTop: 20,
  },
  kicker: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: kindredGold.deep,
    fontWeight: "600",
    marginBottom: 12,
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
    marginTop: 8,
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 24,
    color: paper.inkMuted,
  },
  goldRule: {
    marginTop: 24,
    marginBottom: 8,
    height: 2,
    backgroundColor: kindredGold.rule,
    borderRadius: 1,
  },
  section: {
    marginTop: 24,
    paddingTop: 4,
  },
  sectionLabel: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: kindredGold.deep,
    fontWeight: "600",
    marginBottom: 12,
  },
  paragraph: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 28,
    color: paper.inkBody,
    marginBottom: 16,
    maxWidth: 560,
  },
  leadParagraph: {
    fontSize: 18,
    lineHeight: 30,
  },
  observation: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
    marginBottom: 10,
    maxWidth: 540,
  },
  creditTitle: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.ink,
    fontWeight: "600",
  },
  creditLine: {
    marginTop: 4,
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    color: paper.inkMuted,
  },
  sourceLink: {
    marginTop: 10,
    alignSelf: "flex-start",
  },
  sourceLinkText: {
    fontSize: 14,
    lineHeight: 20,
    color: kindredGold.primary,
    letterSpacing: 0.2,
    textDecorationLine: "underline",
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
  },
  returnRow: {
    marginTop: 32,
    paddingVertical: 12,
  },
  returnText: {
    fontSize: 15,
    lineHeight: 22,
    color: kindredGold.primary,
    letterSpacing: 0.15,
  },
});
