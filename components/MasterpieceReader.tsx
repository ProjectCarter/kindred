import { useMemo } from "react";
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
import { masterpieceTitleLine, masterpieceOriginalTitle } from "../lib/edition/heroArtwork/formatTitle";
import { resolveMasterpieceDisplayTitle } from "../lib/edition/heroArtwork/displayTitle";
import { resolveArtworkYear } from "../lib/edition/heroArtwork/resolveYear";
import { resolveMasterpieceDetail } from "../lib/edition/heroArtwork/detail";
import { MasterpieceFrame } from "./MasterpieceFrame";
import { ShareIconButton } from "./ShareIconButton";
import { kindredGold, masterpiece, paper, press } from "../lib/edition/newspaperTheme";
import { shareContent } from "../lib/share/shareContent";
import { articleBackRowInsets } from "../lib/navigation/articleBackLayout";

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

function TextSection({
  heading,
  paragraphs,
  lead = false,
}: {
  heading: string;
  paragraphs: string[];
  lead?: boolean;
}) {
  if (!paragraphs.length) return null;

  return (
    <EditorialSection heading={heading}>
      {paragraphs.map((paragraph, index) => (
        <Text
          key={`${heading}-${index}`}
          style={[
            styles.paragraph,
            lead && index === 0 ? styles.leadParagraph : null,
          ]}
          maxFontSizeMultiplier={1.2}
        >
          {paragraph}
        </Text>
      ))}
    </EditorialSection>
  );
}

function FullMasterpieceArticle({
  detail,
}: {
  detail: ReturnType<typeof resolveMasterpieceDetail>;
}) {
  const sectionByHeading = new Map(
    detail.sections.map((section) => [section.heading, section])
  );

  const story = sectionByHeading.get("The Story Behind the Artwork");
  const reflection =
    sectionByHeading.get("Editorial Reflection") ??
    sectionByHeading.get("Editorial Closing");

  return (
    <>
      <TextSection
        heading="Introduction"
        paragraphs={sectionByHeading.get("Introduction")?.paragraphs ?? []}
        lead
      />
      <TextSection
        heading="About the Artist"
        paragraphs={sectionByHeading.get("About the Artist")?.paragraphs ?? []}
      />
      {story ? (
        <TextSection heading={story.heading} paragraphs={story.paragraphs} />
      ) : null}

      {detail.lookingCloser.length > 0 ? (
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
      ) : null}

      <TextSection
        heading="Historical Context"
        paragraphs={sectionByHeading.get("Historical Context")?.paragraphs ?? []}
      />

      {detail.didYouKnow?.trim() ? (
        <EditorialSection heading="Did You Know?">
          <Text style={styles.paragraph} maxFontSizeMultiplier={1.2}>
            {detail.didYouKnow}
          </Text>
        </EditorialSection>
      ) : null}

      <TextSection
        heading="Legacy"
        paragraphs={sectionByHeading.get("Legacy")?.paragraphs ?? []}
      />

      {reflection ? (
        <TextSection heading="Editorial Reflection" paragraphs={reflection.paragraphs} />
      ) : null}
    </>
  );
}

/**
 * Today's Masterpiece reader — instant shell from frozen edition data.
 */
export function MasterpieceReader({
  morningHero,
  onBack,
  backLabel = "← Back to Homepage",
}: MasterpieceReaderProps) {
  const { width: windowWidth } = useWindowDimensions();
  const frameWidth = windowWidth - masterpiece.edgeMargin * 2;
  const heroHeight = heroFrameHeight(
    frameWidth - masterpiece.frameChrome,
    morningHero.imageWidth,
    morningHero.imageHeight,
    morningHero.aspectRatio,
    520
  );

  const detail = useMemo(
    () => resolveMasterpieceDetail(morningHero),
    [morningHero]
  );
  const credit = formatArtworkCreditBlock(morningHero);

  const titleWithYear = masterpieceTitleLine(morningHero);
  const originalTitle = masterpieceOriginalTitle(morningHero);

  const { displayTitle } = resolveMasterpieceDisplayTitle(
    morningHero.artworkTitle
  );
  const artworkYear = resolveArtworkYear(morningHero);

  async function handleShare() {
    // Failures resolve to an "error" result inside the helper — never throw
    // and never crash the reader.
    await shareContent({
      contentType: "masterpiece",
      title: displayTitle,
      creator: morningHero.artist,
      year: artworkYear,
      contentId: morningHero.artworkId,
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={onBack}
          style={[
            styles.backRow,
            articleBackRowInsets(0, { safeAreaAlreadyApplied: true }),
          ]}
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
            accessibilityLabel={`${titleWithYear} by ${morningHero.artist}`}
          />
        </View>

        <View style={[styles.body, { maxWidth: windowWidth }]}>
          <View style={styles.kickerRow}>
            <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
              🎨 TODAY'S MASTERPIECE
            </Text>
            <ShareIconButton
              onPress={() => void handleShare()}
              accessibilityLabel="Share this masterpiece"
              style={styles.shareButton}
            />
          </View>

          <Text style={styles.title} maxFontSizeMultiplier={1.2}>
            {titleWithYear}
          </Text>

          <Text style={styles.artist} maxFontSizeMultiplier={1.15}>
            {morningHero.artist}
          </Text>

          {originalTitle ? (
            <TextSection heading="Original Title" paragraphs={[originalTitle]} />
          ) : null}

          <FullMasterpieceArticle detail={detail} />

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

          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.returnRow,
              pressed && { opacity: press.opacity },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to Homepage"
          >
            <Text style={styles.returnText}>← Back to Homepage</Text>
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
  },
  backRow: {
    paddingHorizontal: masterpiece.edgeMargin,
    paddingBottom: 12,
  },
  back: {
    fontSize: 15,
    color: kindredGold.primary,
    letterSpacing: 0.2,
  },
  heroWrap: {
    paddingHorizontal: masterpiece.edgeMargin,
    marginBottom: 12,
  },
  body: {
    paddingHorizontal: masterpiece.edgeMargin,
    paddingTop: 20,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  kicker: {
    flexShrink: 1,
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: kindredGold.primary,
    fontWeight: "600",
  },
  shareButton: {
    paddingLeft: 12,
    paddingVertical: 2,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.4,
    color: paper.ink,
    fontWeight: "600",
    maxWidth: 560,
  },
  artist: {
    marginTop: 10,
    marginBottom: 6,
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 24,
    color: paper.inkMuted,
  },
  section: {
    marginTop: 28,
    paddingTop: 2,
  },
  sectionLabel: {
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: kindredGold.primary,
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
    fontSize: 19,
    lineHeight: 32,
  },
  observation: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 27,
    color: paper.inkBody,
    marginBottom: 12,
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
  returnRow: {
    marginTop: 24,
    paddingVertical: 10,
  },
  returnText: {
    fontSize: 15,
    lineHeight: 22,
    color: kindredGold.primary,
    letterSpacing: 0.15,
  },
});
