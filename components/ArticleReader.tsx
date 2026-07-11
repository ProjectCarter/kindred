import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Animated,
  Easing,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { KindredArticle } from "../lib/edition/article";
import { formatArticlePublishedAt } from "../lib/edition/article";
import {
  getArticleCompanion,
  type ArticleCompanion,
} from "../lib/edition/articleCompanion";
import { paper, type, reader, shadow, press } from "../lib/edition/newspaperTheme";
import { useArticleReadingSession } from "../lib/personalization";
import { EditorialNote } from "./EditorialNote";

type Props = {
  article: KindredArticle;
  onBack: () => void;
  editionId?: string | null;
  companion?: ArticleCompanion | null;
};

/**
 * Shared native article reader for every Kindred section.
 * Lead, Top Stories, Business, Science, Sports, Cooking, Cars —
 * all inherit this same premium reading experience.
 */
export function ArticleReader({
  article,
  onBack,
  editionId,
  companion: companionProp,
}: Props) {
  const companion =
    companionProp ?? getArticleCompanion(article.id) ?? null;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const readingWidth = Math.min(windowWidth - 48, reader.measure);
  // Soft side bleed for photography on narrow phones.
  const figureBleed = Math.min(12, Math.max(0, (windowWidth - readingWidth) / 2 - 4));

  const [contentHeight, setContentHeight] = useState(1);
  const [viewportHeight, setViewportHeight] = useState(1);
  const [progress, setProgress] = useState(0);
  const [heroFailed, setHeroFailed] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const enterOpacity = useRef(new Animated.Value(0)).current;
  const enterRise = useRef(new Animated.Value(14)).current;
  const originalPress = useRef(new Animated.Value(1)).current;

  useArticleReadingSession(article, progress, { editionId });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterRise, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [enterOpacity, enterRise]);

  const published = formatArticlePublishedAt(article.publishedAt);
  const metaParts = [
    published,
    article.estimatedReadMinutes
      ? article.estimatedReadMinutes === 1
        ? "A one-minute read"
        : `About ${article.estimatedReadMinutes} minutes`
      : null,
  ].filter(Boolean) as string[];

  const pullQuote = article.pullQuote;
  const pullIndex = useMemo(() => {
    if (!pullQuote || article.body.length < 2) return -1;
    // Settle the quote after the opening beat — roughly a third of the way in.
    return Math.min(
      Math.max(1, Math.floor(article.body.length * 0.33)),
      article.body.length - 1
    );
  }, [pullQuote, article.body.length]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      const scrollable = Math.max(
        contentSize.height - layoutMeasurement.height,
        1
      );
      const next = Math.min(1, Math.max(0, contentOffset.y / scrollable));
      progressAnim.setValue(next);
      setProgress(next);
    },
    [progressAnim]
  );

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    setContentHeight(Math.max(h, 1));
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(Math.max(event.nativeEvent.layout.height, 1));
  }, []);

  useEffect(() => {
    if (contentHeight <= viewportHeight + 8) {
      progressAnim.setValue(0);
    }
  }, [contentHeight, viewportHeight, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom * 0.35 },
      ]}
    >
      <View style={styles.progressTrack} accessibilityElementsHidden>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.topBar}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to the paper"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.sectionTag} numberOfLines={1}>
          {formatSectionLabel(article.section)}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 56 + insets.bottom },
        ]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        showsVerticalScrollIndicator={false}
        bounces
        decelerationRate="normal"
      >
        <Animated.View
          style={[
            styles.column,
            {
              width: readingWidth,
              opacity: enterOpacity,
              transform: [{ translateY: enterRise }],
            },
          ]}
        >
          <View style={styles.mastheadRule} />

          <Text style={styles.kicker}>
            {formatSectionLabel(article.section)}
          </Text>

          <Text style={styles.headline} maxFontSizeMultiplier={1.3}>
            {article.headline}
          </Text>

          {article.dek ? (
            <Text style={styles.dek} maxFontSizeMultiplier={1.25}>
              {article.dek}
            </Text>
          ) : null}

          <View style={styles.bylineBlock}>
            {article.byline ? (
              <Text style={styles.byline} maxFontSizeMultiplier={1.2}>
                {article.byline}
              </Text>
            ) : null}
            {metaParts.length > 0 ? (
              <Text style={styles.meta} maxFontSizeMultiplier={1.15}>
                {metaParts.join("  ·  ")}
              </Text>
            ) : null}
          </View>

          {companion?.whyThisMatters?.summary ? (
            <EditorialNote
              kicker={companion.whyThisMatters.title || "Why this matters"}
              body={companion.whyThisMatters.summary}
            />
          ) : null}

          {companion?.whyChosen ? (
            <EditorialNote
              kicker="Why it’s in your paper"
              body={companion.whyChosen}
              compact
            />
          ) : null}

          {article.heroImage?.uri && !heroFailed ? (
            <View
              style={[
                styles.figure,
                {
                  marginHorizontal: -figureBleed,
                  width: readingWidth + figureBleed * 2,
                },
              ]}
            >
              <View style={[styles.imageFrame, shadow.photo]}>
                <Image
                  source={{ uri: article.heroImage.uri }}
                  style={styles.image}
                  resizeMode="cover"
                  accessibilityLabel={
                    article.heroImage.caption || article.headline
                  }
                  onError={() => setHeroFailed(true)}
                />
              </View>
              {(article.heroImage.caption || article.heroImage.credit) && (
                <View style={styles.captionBlock}>
                  <View style={styles.captionRule} />
                  <View style={styles.captionCopy}>
                    {article.heroImage.caption ? (
                      <Text style={styles.caption} maxFontSizeMultiplier={1.2}>
                        {article.heroImage.caption}
                      </Text>
                    ) : null}
                    {article.heroImage.credit ? (
                      <Text style={styles.credit} maxFontSizeMultiplier={1.15}>
                        {article.heroImage.credit}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noImageRule} />
          )}

          {(article.body ?? []).map((paragraph, index) => (
            <View key={`p-${index}`}>
              <BodyParagraph
                text={paragraph}
                isLead={index === 0}
              />
              {pullQuote && index === pullIndex ? (
                <PullQuote text={pullQuote} />
              ) : null}
            </View>
          ))}

          <View style={styles.footer}>
            <View style={styles.footerRule} />
            <Text style={styles.endMark}>◆</Text>
            <Text style={styles.attribution}>
              From the edition  ·  {article.source}
            </Text>

            {article.sourceUrl ? (
              <Animated.View style={{ transform: [{ scale: originalPress }] }}>
                <Pressable
                  onPressIn={() => {
                    Animated.spring(originalPress, {
                      toValue: 0.97,
                      useNativeDriver: true,
                      friction: 7,
                    }).start();
                  }}
                  onPressOut={() => {
                    Animated.spring(originalPress, {
                      toValue: 1,
                      useNativeDriver: true,
                      friction: 7,
                    }).start();
                  }}
                  onPress={() => {
                    void Linking.openURL(article.sourceUrl!).catch(() => {
                      // Invalid / unsupported URL — leave the reader intact.
                    });
                  }}
                  accessibilityRole="link"
                  accessibilityLabel="View at the original source"
                  style={({ pressed }) => [
                    styles.originalButton,
                    pressed && styles.originalPressed,
                  ]}
                >
                  <Text style={styles.originalButtonText}>
                    View at the source
                  </Text>
                  <Text style={styles.originalChevron}>↗</Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function BodyParagraph({
  text,
  isLead,
}: {
  text: string;
  isLead: boolean;
}) {
  if (!isLead || text.length < 2) {
    return (
      <Text
        style={[styles.paragraph, isLead && styles.leadParagraph]}
        maxFontSizeMultiplier={1.3}
      >
        {text}
      </Text>
    );
  }

  const first = text.charAt(0);
  const rest = text.slice(1);

  return (
    <Text style={[styles.paragraph, styles.leadParagraph]} maxFontSizeMultiplier={1.3}>
      <Text style={styles.dropCap}>{first}</Text>
      {rest}
    </Text>
  );
}

function PullQuote({ text }: { text: string }) {
  return (
    <View style={styles.pullQuoteBlock} accessibilityRole="text">
      <Text style={styles.pullMark} accessible={false}>
        “
      </Text>
      <Text style={styles.pullQuote} maxFontSizeMultiplier={1.25}>
        {text.replace(/^["“]|["”]$/g, "")}
      </Text>
      <View style={styles.pullRule} />
    </View>
  );
}

function formatSectionLabel(section: string): string {
  const map: Record<string, string> = {
    lead: "The Lead",
    top_stories: "Top Stories",
    business: "Business",
    science: "Science",
    cooking: "Cooking",
    cars: "Cars",
    sports: "Sports",
    health: "Health",
    culture: "Culture",
    technology: "Technology",
    recommendations: "Recommendations",
  };
  if (map[section]) return map[section];
  return section
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: paper.cream,
  },
  progressTrack: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: paper.inkRule,
  },
  progressFill: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: paper.terracottaSoft,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
    backgroundColor: paper.cream,
  },
  back: {
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.inkMuted,
    letterSpacing: 0.2,
  },
  sectionTag: {
    ...type.kicker,
    color: paper.terracotta,
    maxWidth: "55%",
    textAlign: "right",
    letterSpacing: 1.7,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingTop: 20,
    paddingHorizontal: 24,
  },
  column: {
    maxWidth: reader.measure,
  },
  mastheadRule: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 22,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2,
    marginBottom: 14,
  },
  headline: {
    ...reader.headline,
    color: paper.ink,
    marginBottom: 16,
  },
  dek: {
    ...reader.dek,
    color: paper.inkBody,
    marginBottom: 18,
  },
  bylineBlock: {
    marginBottom: 28,
    gap: 6,
  },
  byline: {
    ...reader.byline,
    color: paper.inkMuted,
  },
  meta: {
    ...reader.meta,
    color: paper.inkFaint,
  },
  figure: {
    marginBottom: 36,
    alignSelf: "center",
  },
  imageFrame: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  image: {
    width: "100%",
    height: "114%",
    marginTop: "-7%",
  },
  captionBlock: {
    flexDirection: "row",
    marginTop: 12,
    paddingRight: 4,
    gap: 12,
  },
  captionRule: {
    width: 1.5,
    backgroundColor: paper.terracotta,
    opacity: press.opacity,
    borderRadius: 1,
  },
  captionCopy: {
    flex: 1,
    gap: 3,
    paddingTop: 1,
  },
  caption: {
    ...reader.caption,
    color: paper.inkMuted,
  },
  credit: {
    ...reader.credit,
    color: paper.inkFaint,
    textTransform: "uppercase",
  },
  noImageRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 28,
  },
  paragraph: {
    ...reader.body,
    color: paper.inkBody,
    marginBottom: 26,
  },
  leadParagraph: {
    marginBottom: 28,
  },
  dropCap: {
    ...reader.dropCap,
    color: paper.ink,
  },
  pullQuoteBlock: {
    marginTop: 8,
    marginBottom: 36,
    paddingHorizontal: 4,
  },
  pullMark: {
    fontFamily: "Georgia",
    fontSize: 64,
    lineHeight: 56,
    color: paper.terracotta,
    opacity: 0.4,
    marginBottom: -8,
    marginLeft: -4,
  },
  pullQuote: {
    ...reader.pullQuote,
    color: paper.ink,
    marginBottom: 18,
  },
  pullRule: {
    width: 48,
    height: 1.5,
    backgroundColor: paper.terracotta,
    opacity: press.opacity,
  },
  footer: {
    marginTop: 12,
    alignItems: "flex-start",
    gap: 14,
  },
  footerRule: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 8,
  },
  endMark: {
    alignSelf: "center",
    fontSize: 11,
    color: paper.inkFaint,
    letterSpacing: 1,
    marginBottom: 4,
  },
  attribution: {
    ...reader.meta,
    color: paper.inkMuted,
    letterSpacing: 0.45,
    textTransform: "uppercase",
  },
  originalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkMuted,
    borderRadius: 2,
    backgroundColor: paper.creamDeep,
  },
  originalPressed: {
    backgroundColor: paper.cream,
  },
  originalButtonText: {
    fontSize: 13,
    letterSpacing: 0.5,
    color: paper.ink,
    fontWeight: "500",
  },
  originalChevron: {
    fontSize: 13,
    color: paper.terracotta,
  },
  pressed: {
    opacity: press.opacity,
  },
});
